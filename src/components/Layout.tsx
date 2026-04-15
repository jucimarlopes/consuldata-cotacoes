import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, FileText, Search, Home } from 'lucide-react';

export const Layout: React.FC = () => {
  const { appUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-consul-light">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                <img 
                  src="https://www.consuldata.com.br/wp-content/uploads/2022/08/LOGO-SITE-1.png" 
                  alt="ConsulData Logo" 
                  className="h-10 object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="font-bold text-xl text-consul-dark hidden sm:block ml-2 border-l-2 border-gray-200 pl-2">
                  Cotações
                </span>
              </Link>
              
              {appUser && (
                <nav className="ml-6 flex space-x-4">
                  <Link to="/" className="text-consul-gray hover:text-consul-blue px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1">
                    <Home size={18} /> <span className="hidden sm:inline">Início</span>
                  </Link>
                  <Link to="/search" className="text-consul-gray hover:text-consul-blue px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1">
                    <Search size={18} /> <span className="hidden sm:inline">Buscar</span>
                  </Link>
                  {(appUser.role === 'admin' || appUser.role === 'uploader') && (
                    <Link to="/import" className="text-consul-gray hover:text-consul-blue px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1">
                      <FileText size={18} /> <span className="hidden sm:inline">Importar</span>
                    </Link>
                  )}
                </nav>
              )}
            </div>
            
            {appUser && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-right hidden md:block">
                  <p className="font-medium text-consul-dark">{appUser.name}</p>
                  <p className="text-xs text-consul-gray">{appUser.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-consul-gray hover:text-consul-coral rounded-full hover:bg-gray-100 transition-colors"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center text-sm text-consul-gray">
          <p>
            &copy; {new Date().getFullYear()} Todos os direitos reservados a{' '}
            <a href="https://personalsupport.tec.br" target="_blank" rel="noopener noreferrer" className="text-consul-blue hover:underline font-medium">
              Jucimar Lopes
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
