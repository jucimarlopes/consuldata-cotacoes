import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { user, login, register, loading } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-consul-light">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-consul-blue"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        if (!name) throw new Error('Por favor, informe seu nome.');
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por e-mail e senha não está ativado no Firebase. Siga as instruções para ativar.');
      } else {
        setError(err.message || 'Ocorreu um erro ao autenticar.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-consul-light px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl">
        <div className="text-center">
          <img 
            src="https://www.consuldata.com.br/wp-content/uploads/2022/08/LOGO-SITE-1.png" 
            alt="ConsulData Logo" 
            className="mx-auto h-16 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <h2 className="mt-6 text-2xl font-bold text-consul-dark">
            Sistema de <span className="text-consul-orange">Cotações</span>
          </h2>
          <p className="mt-2 text-sm text-consul-gray">
            Acesso restrito para colaboradores @consuldata.com.br
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-consul-coral p-4 flex items-start gap-3">
              <AlertCircle className="text-consul-coral flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-consul-gray mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-consul-blue focus:border-consul-blue"
                  placeholder="Seu nome"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-consul-gray mb-1">E-mail Corporativo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-consul-blue focus:border-consul-blue"
                placeholder="email@consuldata.com.br"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-consul-gray mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-consul-blue focus:border-consul-blue"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-consul-blue hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-consul-blue transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              {isRegistering ? (
                <UserPlus className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
              ) : (
                <LogIn className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
              )}
            </span>
            {isSubmitting ? 'Aguarde...' : isRegistering ? 'Criar Conta' : 'Entrar'}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-sm text-consul-blue hover:text-consul-orange transition-colors font-medium"
            >
              {isRegistering ? 'Já tenho uma conta. Fazer login.' : 'Primeiro acesso? Criar conta.'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
