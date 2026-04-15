import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FileText, Trash2, Eye, Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Quotation {
  id: string;
  supplier: string;
  date: any;
  quoteNumber: string;
  type: string;
  authorUid: string;
  createdAt: any;
}

export const Quotations: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { appUser } = useAuth();

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quotation[];
      
      setQuotations(fetched);
    } catch (error) {
      console.error("Error fetching quotations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta cotação? TODOS os produtos vinculados a ela também serão excluídos permanentemente.")) {
      try {
        // 1. Find all products for this quotation
        const productsQuery = query(collection(db, 'products'), where('quotationId', '==', id));
        const productsSnapshot = await getDocs(productsQuery);
        
        // 2. Delete all products and the quotation in a batch
        const batch = writeBatch(db);
        
        productsSnapshot.docs.forEach((productDoc) => {
          batch.delete(doc(db, 'products', productDoc.id));
        });
        
        batch.delete(doc(db, 'quotations', id));
        
        await batch.commit();
        
        // 3. Update local state
        setQuotations(prev => prev.filter(q => q.id !== id));
        alert("Cotação e produtos excluídos com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir cotação:", error);
        alert("Erro ao excluir cotação. Verifique suas permissões.");
      }
    }
  };

  const filteredQuotations = quotations.filter(q => 
    q.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-consul-dark flex items-center gap-2">
          <FileText className="text-consul-blue" />
          Gerenciar Cotações
        </h1>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por fornecedor ou número da cotação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-consul-blue focus:border-transparent outline-none transition-all"
          />
          <SearchIcon className="absolute left-3 top-3.5 text-gray-400" size={20} />
        </div>
      </div>

      {/* Quotations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-consul-gray">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-consul-blue mx-auto mb-4"></div>
            Carregando cotações...
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="p-8 text-center text-consul-gray">
            Nenhuma cotação encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Fornecedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Nº Cotação</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-consul-gray uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-consul-dark">{quotation.supplier}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-consul-gray">
                      {quotation.quoteNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-consul-gray">
                      {quotation.date?.toDate ? quotation.date.toDate().toLocaleDateString('pt-BR') : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                        {quotation.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/search?quotationId=${quotation.id}`)}
                          className="p-2 text-consul-blue hover:bg-blue-50 rounded-lg transition-colors"
                          title="Visualizar Itens"
                        >
                          <Eye size={18} />
                        </button>
                        {(appUser?.role === 'admin' || appUser?.uid === quotation.authorUid) && (
                          <button
                            onClick={() => handleDelete(quotation.id)}
                            className="p-2 text-consul-coral hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Cotação e Itens"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
