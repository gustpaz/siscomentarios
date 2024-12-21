import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../services/api';

interface AuthContextData {
  signed: boolean;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setSigned(true);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, senha: string) => {
    try {
      const response = await apiLogin(email, senha);
      localStorage.setItem('token', response.token);
      setSigned(true);
    } catch (error) {
      console.error('Erro no login:', error);
      throw new Error('Falha no login');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setSigned(false);
    window.location.href = '/login';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ signed, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};