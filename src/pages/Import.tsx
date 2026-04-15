import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import { extractQuotationData, extractQuotationDataFromText, ExtractedQuotation } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';
import { UploadCloud, CheckCircle, AlertCircle, X, Save, Edit2, FileText, Package, Type as TypeIcon, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Import: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedQuotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
      setExtractedData(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  } as any);

  const handleExtract = async () => {
    if (importMode === 'file' && !file) return;
    if (importMode === 'text' && !textInput.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      let data;
      if (importMode === 'file') {
        data = await extractQuotationData(file!);
      } else {
        data = await extractQuotationDataFromText(textInput);
      }
      setExtractedData(data);
    } catch (err: any) {
      setError(err.message || "Erro ao processar os dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData || !appUser) return;
    
    // Skip duplicate check if quoteNumber is generic or empty
    if (!extractedData.quoteNumber || extractedData.quoteNumber.toUpperCase() === 'WHATSAPP') {
      executeSave();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Check for duplicates
      const q = query(
        collection(db, 'quotations'),
        where('quoteNumber', '==', extractedData.quoteNumber),
        where('supplier', '==', extractedData.supplier)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setDuplicateWarning(true);
        setSaving(false);
        return;
      }

      // If no duplicate, proceed with saving
      executeSave();
    } catch (err: any) {
      console.error("Erro ao verificar duplicidade:", err);
      setError("Erro ao verificar cotação no banco de dados.");
      setSaving(false);
    }
  };

  const executeSave = async () => {
    if (!extractedData || !appUser) return;
    setSaving(true);
    setError(null);
    setDuplicateWarning(false);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Create Quotation Document
      const quotationRef = doc(collection(db, 'quotations'));
      const quotationData = {
        supplier: extractedData.supplier,
        date: new Date(extractedData.date),
        quoteNumber: extractedData.quoteNumber,
        type: extractedData.type,
        authorUid: appUser.uid,
        createdAt: serverTimestamp(),
      };
      batch.set(quotationRef, quotationData);

      // 2. Create Product Documents
      extractedData.products.forEach((prod) => {
        const productRef = doc(collection(db, 'products'));
        
        const itemSupplier = prod.supplier || extractedData.supplier;

        // Generate search terms for simple text search
        const searchTerms = [
          ...prod.description.toLowerCase().split(' '),
          itemSupplier.toLowerCase(),
          prod.brand?.toLowerCase() || '',
          ...(prod.semanticTags || []).map(tag => tag.toLowerCase())
        ].filter(Boolean);

        const productData = {
          quotationId: quotationRef.id,
          supplier: itemSupplier,
          date: new Date(extractedData.date),
          description: prod.description,
          brand: prod.brand || '',
          unitOfMeasure: prod.unitOfMeasure,
          unitPrice: prod.unitPrice,
          totalPrice: prod.totalPrice,
          authorUid: appUser.uid,
          createdAt: serverTimestamp(),
          searchTerms,
        };
        batch.set(productRef, productData);
      });

      await batch.commit();
      alert("Cotação importada com sucesso!");
      navigate('/search');
      
    } catch (err: any) {
      console.error(err);
      setError("Erro ao salvar no banco de dados. Verifique suas permissões.");
    } finally {
      setSaving(false);
    }
  };

  const updateProductField = (index: number, field: keyof typeof extractedData.products[0], value: any) => {
    if (!extractedData) return;
    const newProducts = [...extractedData.products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setExtractedData({ ...extractedData, products: newProducts });
  };

  const updateHeaderField = (field: keyof Omit<ExtractedQuotation, 'products'>, value: string) => {
    if (!extractedData) return;
    setExtractedData({ ...extractedData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-consul-dark flex items-center gap-2">
          <UploadCloud className="text-consul-blue" />
          Importar Cotação
        </h1>
        <p className="mt-2 text-consul-gray">
          Faça upload de um arquivo (PDF, Imagem, Excel) ou cole o texto para que a Inteligência Artificial extraia os dados automaticamente.
        </p>

        {!extractedData && (
          <div className="mt-8">
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                  importMode === 'file'
                    ? 'border-consul-blue text-consul-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setImportMode('file')}
              >
                <div className="flex items-center gap-2">
                  <UploadCloud size={18} />
                  Upload de Arquivo
                </div>
              </button>
              <button
                className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                  importMode === 'text'
                    ? 'border-consul-blue text-consul-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setImportMode('text')}
              >
                <div className="flex items-center gap-2">
                  <TypeIcon size={18} />
                  Colar Texto
                </div>
              </button>
            </div>

            {importMode === 'file' ? (
              <>
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-consul-blue bg-blue-50' : 'border-gray-300 hover:border-consul-blue hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-lg text-consul-dark font-medium">
                    {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste e solte um arquivo, ou clique para selecionar'}
                  </p>
                  <p className="mt-2 text-sm text-consul-gray">
                    Suporta PDF, PNG, JPG, XLSX (Máx 1 arquivo)
                  </p>
                </div>

                {file && (
                  <div className="mt-6 flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <FileText className="text-consul-blue" />
                      <span className="font-medium text-consul-dark">{file.name}</span>
                      <span className="text-sm text-consul-gray">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button 
                      onClick={() => setFile(null)}
                      className="p-1 text-gray-400 hover:text-consul-coral rounded-full hover:bg-gray-200"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full">
                <label className="block text-sm font-medium text-consul-dark mb-2">
                  Cole o texto da cotação (ex: mensagens do WhatsApp, corpo de e-mail)
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Cole aqui os dados da cotação..."
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-consul-blue focus:border-transparent resize-y"
                />
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-50 border-l-4 border-consul-coral p-4 flex items-start gap-3">
                <AlertCircle className="text-consul-coral flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleExtract}
                disabled={(importMode === 'file' && !file) || (importMode === 'text' && !textInput.trim()) || loading}
                className={`px-6 py-3 rounded-lg font-medium text-white transition-all shadow-md flex items-center gap-2 ${
                  ((importMode === 'file' && !file) || (importMode === 'text' && !textInput.trim()) || loading)
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-consul-orange hover:bg-orange-600 hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Analisando documento...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Extrair Dados com IA
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Validation Grid */}
        {extractedData && (
          <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
              <h3 className="text-lg font-bold text-consul-dark mb-4 flex items-center gap-2">
                <Edit2 size={18} className="text-consul-blue" />
                Revisão do Cabeçalho
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-consul-gray mb-1">Fornecedor</label>
                  <input 
                    type="text" 
                    value={extractedData.supplier} 
                    onChange={(e) => updateHeaderField('supplier', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-consul-blue focus:border-consul-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-consul-gray mb-1">Data</label>
                  <input 
                    type="date" 
                    value={extractedData.date} 
                    onChange={(e) => updateHeaderField('date', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-consul-blue focus:border-consul-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-consul-gray mb-1">Nº Cotação</label>
                  <input 
                    type="text" 
                    value={extractedData.quoteNumber} 
                    onChange={(e) => updateHeaderField('quoteNumber', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-consul-blue focus:border-consul-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-consul-gray mb-1">Tipo</label>
                  <select 
                    value={extractedData.type} 
                    onChange={(e) => updateHeaderField('type', e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-consul-blue focus:border-consul-blue bg-white"
                  >
                    <option value="proposta">Proposta</option>
                    <option value="pedido">Pedido</option>
                    <option value="orçamento">Orçamento</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-consul-dark mb-4 flex items-center gap-2">
                <Package size={18} className="text-consul-blue" />
                Produtos Extraídos ({extractedData.products.length})
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider w-32">Fornecedor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider w-32">Marca</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-consul-gray uppercase tracking-wider w-24">UN</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-consul-gray uppercase tracking-wider w-32">Preço Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-consul-gray uppercase tracking-wider w-32">Preço Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {extractedData.products.map((prod, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            value={prod.description} 
                            onChange={(e) => updateProductField(idx, 'description', e.target.value)}
                            className="w-full p-1 border-transparent focus:border-consul-blue focus:ring-0 bg-transparent"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            value={prod.supplier || ''} 
                            onChange={(e) => updateProductField(idx, 'supplier', e.target.value)}
                            className="w-full p-1 border-transparent focus:border-consul-blue focus:ring-0 bg-transparent"
                            placeholder={extractedData.supplier}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            value={prod.brand || ''} 
                            onChange={(e) => updateProductField(idx, 'brand', e.target.value)}
                            className="w-full p-1 border-transparent focus:border-consul-blue focus:ring-0 bg-transparent"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            value={prod.unitOfMeasure} 
                            onChange={(e) => updateProductField(idx, 'unitOfMeasure', e.target.value)}
                            className="w-full p-1 border-transparent focus:border-consul-blue focus:ring-0 bg-transparent"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="number" 
                            step="0.01"
                            value={prod.unitPrice} 
                            onChange={(e) => updateProductField(idx, 'unitPrice', parseFloat(e.target.value))}
                            className="w-full p-1 border-transparent focus:border-consul-blue focus:ring-0 bg-transparent text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="number" 
                            step="0.01"
                            value={prod.totalPrice} 
                            onChange={(e) => updateProductField(idx, 'totalPrice', parseFloat(e.target.value))}
                            className="w-full p-1 border-transparent focus:border-consul-blue focus:ring-0 bg-transparent text-right"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <button
                onClick={() => setExtractedData(null)}
                className="px-6 py-2 text-consul-gray hover:text-consul-dark font-medium transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-8 py-3 rounded-lg font-medium text-white transition-all shadow-md flex items-center gap-2 ${
                  saving 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-consul-green hover:bg-green-600 hover:shadow-lg'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Validar e Salvar Cotação
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Warning Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4 text-consul-orange">
              <AlertTriangle size={28} />
              <h3 className="text-xl font-bold text-consul-dark">Possível Duplicidade</h3>
            </div>
            
            <p className="text-consul-gray mb-6">
              Já existe uma cotação no sistema com o número <strong className="text-consul-dark">{extractedData?.quoteNumber}</strong> do fornecedor <strong className="text-consul-dark">{extractedData?.supplier}</strong>.
              <br /><br />
              Deseja importar e salvar esta cotação mesmo assim?
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDuplicateWarning(false)}
                className="px-4 py-2 text-consul-gray hover:bg-gray-100 rounded-lg font-medium transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                onClick={executeSave}
                className="px-4 py-2 bg-consul-orange text-white hover:bg-orange-600 rounded-lg font-medium transition-colors flex items-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <Save size={18} />
                )}
                Importar Mesmo Assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
