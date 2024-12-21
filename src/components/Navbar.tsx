import React from 'react';
import { Key, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { logout } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Key className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900">Sistema de Licenças</span>
          </div>
          <div className="flex items-center">
            <button 
              onClick={logout}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}