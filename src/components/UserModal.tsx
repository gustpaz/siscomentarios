import React from 'react';
import { X } from 'lucide-react';

interface User {
  id?: string;
  nome: string;
  email: string;
  senha?: string;
  validade: string;
  status?: 'ativo' | 'inativo';
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: User) => Promise<void>;
  editingUser?: User | null;
}

export function UserModal({ isOpen, onClose, onSubmit, editingUser }: UserModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data: User = {
        nome: formData.get('nome') as string,
        email: formData.get('email') as string,
        validade: formData.get('validade') as string,
        status: editingUser?.status || 'ativo'
      };

      const senha = formData.get('senha') as string;
      if (senha) {
        data.senha = senha;
      }

      await onSubmit(data);
      onClose();
    } catch (err) {
      setError('Erro ao salvar usuário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-500"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
              Nome
            </label>
            <input
              type="text"
              name="nome"
              id="nome"
              defaultValue={editingUser?.nome}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              defaultValue={editingUser?.email}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700">
              {editingUser ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha'}
            </label>
            <input
              type="password"
              name="senha"
              id="senha"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required={!editingUser}
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="validade" className="block text-sm font-medium text-gray-700">
              Data de Validade
            </label>
            <input
              type="date"
              name="validade"
              id="validade"
              defaultValue={editingUser?.validade?.split('T')[0]}
              min={new Date().toISOString().split('T')[0]}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Salvando...' : editingUser ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}