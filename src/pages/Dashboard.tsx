import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FileText, Search, Package, Users, ArrowRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ products: 0, suppliers: 0 });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products to count them and extract unique suppliers
        // Note: In a real large-scale app, we'd use aggregation queries.
        // For this prototype, we'll fetch a limited set or use a counter document.
        // Let's use a simple getDocs for now, assuming small initial dataset.
        const productsRef = collection(db, 'products');
        const q = query(productsRef, limit(1000));
        const snapshot = await getDocs(q);
        
        const uniqueSuppliers = new Set<string>();
        snapshot.docs.forEach(doc => {
          uniqueSuppliers.add(doc.data().supplier);
        });

        setStats({
          products: snapshot.size,
          suppliers: uniqueSuppliers.size
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-consul-dark">
          Olá, <span className="text-consul-blue">{appUser?.name.split(' ')[0]}</span>!
        </h1>
        <p className="mt-2 text-consul-gray text-lg">
          Bem-vindo ao Banco de Cotações da ConsulData. O que você deseja fazer hoje?
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-6 transition-transform hover:scale-[1.02]">
          <div className="w-16 h-16 bg-blue-50 text-consul-blue rounded-2xl flex items-center justify-center">
            <Package size={32} />
          </div>
          <div>
            <p className="text-sm font-medium text-consul-gray uppercase tracking-wider">Produtos Cotados</p>
            <p className="text-4xl font-bold text-consul-dark">{stats.products}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-6 transition-transform hover:scale-[1.02]">
          <div className="w-16 h-16 bg-orange-50 text-consul-orange rounded-2xl flex items-center justify-center">
            <Users size={32} />
          </div>
          <div>
            <p className="text-sm font-medium text-consul-gray uppercase tracking-wider">Fornecedores</p>
            <p className="text-4xl font-bold text-consul-dark">{stats.suppliers}</p>
          </div>
        </div>
      </div>

      {/* Big Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(appUser?.role === 'admin' || appUser?.role === 'uploader') && (
          <Link 
            to="/import"
            className="group bg-gradient-to-br from-consul-orange to-orange-600 rounded-2xl p-8 text-white shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[200px]"
          >
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <FileText size={28} />
            </div>
            <div className="mt-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                Importar Cotação
                <ArrowRight className="opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="mt-2 text-orange-100">Faça upload de PDFs, planilhas ou imagens e deixe a IA extrair os dados.</p>
            </div>
          </Link>
        )}

        <Link 
          to="/search"
          className={`group bg-gradient-to-br from-consul-blue to-blue-700 rounded-2xl p-8 text-white shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[200px] ${(appUser?.role !== 'admin' && appUser?.role !== 'uploader') ? 'md:col-span-2' : ''}`}
        >
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Search size={28} />
          </div>
          <div className="mt-8">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              Ver Cotações
              <ArrowRight className="opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="mt-2 text-blue-100">Busque produtos, compare preços e gere pré-pedidos em PDF ou Excel.</p>
          </div>
        </Link>
      </div>

      {/* Global Search Bar */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold text-consul-dark mb-4">Busca Rápida</h3>
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-consul-gray" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-0 focus:border-consul-blue transition-colors text-lg"
            placeholder="Buscar por descrição, marca ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            type="submit"
            className="absolute inset-y-2 right-2 px-6 bg-consul-blue text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>
    </div>
  );
};
