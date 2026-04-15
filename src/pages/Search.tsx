import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search as SearchIcon, ShoppingCart, Download, FileText, Plus, Minus, Trash2, X, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToPDF, exportToExcel, CartItem } from '../lib/export';

interface Product {
  id: string;
  quotationId: string;
  supplier: string;
  date: any; // Firestore timestamp
  description: string;
  brand: string;
  unitOfMeasure: string;
  unitPrice: number;
  totalPrice: number;
  searchTerms: string[];
}

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const quotationIdFilter = searchParams.get('quotationId') || null;
  
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [globalMarkup, setGlobalMarkup] = useState<number>(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Edit state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, orderBy('date', 'desc'), limit(1000));
      const snapshot = await getDocs(q);
      
      const fetchedProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products;
    
    if (quotationIdFilter) {
      result = result.filter(p => p.quotationId === quotationIdFilter);
    }

    if (!searchTerm.trim()) return result;
    
    const terms = searchTerm.toLowerCase().split(' ').filter(Boolean);
    return result.filter(p => {
      const searchableText = `${p.description} ${p.brand} ${p.supplier} ${(p.searchTerms || []).join(' ')}`.toLowerCase();
      return terms.every(term => searchableText.includes(term));
    });
  }, [products, searchTerm, quotationIdFilter]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, quotationIdFilter]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: any = {};
    if (searchTerm) params.q = searchTerm;
    if (quotationIdFilter) params.quotationId = quotationIdFilter;
    setSearchParams(params);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        await deleteDoc(doc(db, 'products', id));
        setProducts(prev => prev.filter(p => p.id !== id));
        // Remove from cart if it's there
        setCart(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error("Erro ao excluir produto:", error);
        alert("Erro ao excluir produto.");
      }
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      description: product.description,
      brand: product.brand,
      supplier: product.supplier,
      unitOfMeasure: product.unitOfMeasure,
      unitPrice: product.unitPrice,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    
    try {
      const productRef = doc(db, 'products', editingProduct.id);
      
      // Update search terms based on new values
      const searchTerms = [
        ...(editForm.description || '').toLowerCase().split(' '),
        (editForm.supplier || '').toLowerCase(),
        (editForm.brand || '').toLowerCase(),
        ...(editingProduct.searchTerms || []).filter(t => !editingProduct.description.toLowerCase().includes(t)) // Keep semantic tags
      ].filter(Boolean);

      const updatedData = {
        ...editForm,
        searchTerms
      };

      await updateDoc(productRef, updatedData);
      
      // Update local state
      setProducts(prev => prev.map(p => 
        p.id === editingProduct.id ? { ...p, ...updatedData } : p
      ));
      
      // Update cart if item is in cart
      setCart(prev => prev.map(item => 
        item.id === editingProduct.id ? { ...item, ...editForm } : item
      ));

      setEditingProduct(null);
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      alert("Erro ao atualizar produto.");
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        id: product.id,
        description: product.description,
        brand: product.brand,
        supplier: product.supplier,
        unitOfMeasure: product.unitOfMeasure,
        unitPrice: product.unitPrice,
        quantity: 1,
        date: product.date?.toDate ? product.date.toDate() : new Date(product.date)
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const updateItemMarkup = (id: string, markup: number) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, markup } : item
    ));
  };

  const applyGlobalMarkup = () => {
    setCart(prev => prev.map(item => ({ ...item, markup: globalMarkup })));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const cartFinalTotal = cart.reduce((sum, item) => sum + (item.unitPrice * (1 + (item.markup || 0) / 100) * item.quantity), 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative">
      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-consul-dark">Editar Produto</h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-consul-dark">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-consul-gray mb-1">Descrição</label>
                <input 
                  type="text" 
                  value={editForm.description || ''} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-consul-blue focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-consul-gray mb-1">Fornecedor</label>
                <input 
                  type="text" 
                  value={editForm.supplier || ''} 
                  onChange={e => setEditForm({...editForm, supplier: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-consul-blue focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-consul-gray mb-1">Marca</label>
                  <input 
                    type="text" 
                    value={editForm.brand || ''} 
                    onChange={e => setEditForm({...editForm, brand: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-consul-blue focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-consul-gray mb-1">Unidade</label>
                  <input 
                    type="text" 
                    value={editForm.unitOfMeasure || ''} 
                    onChange={e => setEditForm({...editForm, unitOfMeasure: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-consul-blue focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-consul-gray mb-1">Preço Unitário (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={editForm.unitPrice || 0} 
                  onChange={e => setEditForm({...editForm, unitPrice: parseFloat(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-consul-blue focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 text-consul-gray hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-consul-blue text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 space-y-6 ${isCartOpen ? 'hidden lg:block' : 'block'}`}>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-consul-dark flex items-center gap-2">
            <SearchIcon className="text-consul-blue" />
            {quotationIdFilter ? 'Itens da Cotação' : 'Buscar Cotações'}
          </h1>
          
          <form onSubmit={handleSearch} className="relative w-full sm:w-96">
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-consul-blue focus:border-transparent"
              placeholder="Produto, marca, fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </form>

          <button 
            onClick={() => setIsCartOpen(true)}
            className="lg:hidden relative p-2 text-consul-dark hover:bg-gray-100 rounded-full"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-consul-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {quotationIdFilter && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-consul-blue">
              <FileText size={20} />
              <span className="font-medium">Visualizando itens de uma cotação específica.</span>
            </div>
            <button 
              onClick={() => {
                setSearchParams(searchTerm ? { q: searchTerm } : {});
              }}
              className="px-4 py-2 bg-white text-consul-blue border border-blue-200 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
            >
              Ver Todas as Cotações
            </button>
          </div>
        )}

        {/* Results Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-consul-blue"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-consul-gray">
              <SearchIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-lg">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Produto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Fornecedor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Data</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-consul-gray uppercase tracking-wider">Preço Unit.</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-consul-gray uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedProducts.map((product) => {
                      const dateObj = product.date?.toDate ? product.date.toDate() : new Date(product.date);
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-consul-dark">{product.description}</div>
                            <div className="text-xs text-consul-gray">{product.brand || 'Sem marca'} • {product.unitOfMeasure}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-consul-dark">{product.supplier}</td>
                          <td className="px-6 py-4 text-sm text-consul-gray">
                            {dateObj.toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-consul-dark text-right">
                            R$ {product.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditClick(product)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-consul-blue hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                                title="Editar"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                onClick={() => addToCart(product)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-consul-blue hover:bg-consul-blue hover:text-white transition-colors ml-2"
                                title="Adicionar à Prévia"
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-consul-gray">
                    Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> até <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> de <span className="font-medium">{filteredProducts.length}</span> resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded-md text-consul-dark hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-medium text-consul-dark px-2">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded-md text-consul-dark hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cart / Pre-Quote Sidebar */}
      <div className={`lg:w-96 flex-shrink-0 lg:sticky lg:top-24 lg:self-start lg:h-fit ${!isCartOpen ? 'hidden lg:block' : 'block w-full z-10'}`}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-consul-dark flex items-center gap-2">
              <ShoppingCart className="text-consul-orange" />
              Prévia de Pedido
            </h2>
            <button 
              onClick={() => setIsCartOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-consul-dark"
            >
              <X size={20} />
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-consul-gray">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-200 mb-3" />
              <p>Sua prévia está vazia.</p>
              <p className="text-sm mt-1">Adicione produtos da lista ao lado.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-consul-blue mb-1">Margem Global (%)</label>
                  <input
                    type="number"
                    min="0"
                    value={globalMarkup}
                    onChange={(e) => setGlobalMarkup(Number(e.target.value))}
                    className="w-full p-2 text-sm border border-blue-200 rounded-md focus:ring-1 focus:ring-consul-blue focus:border-transparent"
                  />
                </div>
                <button
                  onClick={applyGlobalMarkup}
                  className="px-3 py-2 bg-consul-blue text-white text-sm font-medium rounded-md hover:bg-blue-800 transition-colors"
                >
                  Aplicar a Todos
                </button>
              </div>

              <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-2">
                {cart.map(item => {
                  const finalPrice = item.unitPrice * (1 + (item.markup || 0) / 100);
                  const finalSubtotal = finalPrice * item.quantity;
                  return (
                    <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-consul-dark line-clamp-2 pr-2">{item.description}</p>
                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-consul-coral">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md">
                          <button onClick={() => updateQuantity(item.id, -1)} className="px-2 py-1 text-gray-500 hover:text-consul-blue">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="px-2 py-1 text-gray-500 hover:text-consul-blue">
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-consul-gray">Margem:</span>
                          <input
                            type="number"
                            min="0"
                            value={item.markup || 0}
                            onChange={(e) => updateItemMarkup(item.id, Number(e.target.value))}
                            className="w-16 p-1 text-xs text-right border border-gray-300 rounded-md focus:ring-1 focus:ring-consul-blue focus:border-transparent"
                          />
                          <span className="text-xs font-medium text-consul-gray">%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-200">
                        <div className="flex flex-col">
                          <span className="text-xs text-consul-gray">Forn: R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                        </div>
                        <span className="text-sm font-bold text-consul-dark">
                          Final: R$ {finalSubtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-consul-gray font-medium">Total Fornecedor</span>
                  <span className="text-sm font-bold text-consul-gray">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-consul-dark font-bold">Total Final</span>
                  <span className="text-xl font-bold text-consul-blue">R$ {cartFinalTotal.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => exportToPDF(cart, cartTotal)}
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors text-sm"
                  >
                    <FileText size={16} />
                    Gerar PDF
                  </button>
                  <button
                    onClick={() => exportToExcel(cart, cartTotal)}
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-medium transition-colors text-sm"
                  >
                    <Download size={16} />
                    Gerar Excel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
