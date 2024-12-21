import React, { useState, useMemo } from 'react';
import { Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Usuario } from '../services/api';

interface UsersTableProps {
  users: Usuario[];
  onEdit: (user: Usuario) => void;
  onToggleStatus: (user: Usuario) => void;
  onDelete: (user: Usuario) => void;
}

export function UsersTable({ users, onEdit, onToggleStatus, onDelete }: UsersTableProps) {
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos' as 'todos' | 'ativo' | 'inativo',
    dataInicio: '',
    dataFim: '',
    temAcesso: 'todos' as 'todos' | 'sim' | 'nao'
  });

  const usuariosPorPagina = 10;

  // Filtra os usuários com base nos critérios selecionados
  const usuariosFiltrados = useMemo(() => {
    return users.filter(user => {
      // Filtro por status
      if (filtros.status !== 'todos' && user.status !== filtros.status) return false;

      // Filtro por acesso ativo
      if (filtros.temAcesso !== 'todos') {
        const temAcessoAtivo = !!user.ativo;
        if (filtros.temAcesso === 'sim' && !temAcessoAtivo) return false;
        if (filtros.temAcesso === 'nao' && temAcessoAtivo) return false;
      }

      // Filtro por data de validade
      const dataValidade = new Date(user.validade);
      if (filtros.dataInicio && dataValidade < new Date(filtros.dataInicio)) return false;
      if (filtros.dataFim && dataValidade > new Date(filtros.dataFim)) return false;

      // Filtro por texto
      if (filtros.busca) {
        const termoBusca = filtros.busca.toLowerCase();
        return (
          user.nome.toLowerCase().includes(termoBusca) ||
          user.email.toLowerCase().includes(termoBusca)
        );
      }

      return true;
    });
  }, [users, filtros]);

  // Pagina os usuários filtrados
  const usuariosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * usuariosPorPagina;
    const fim = inicio + usuariosPorPagina;
    return usuariosFiltrados.slice(inicio, fim);
  }, [usuariosFiltrados, paginaAtual]);

  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);

  const limparFiltros = () => {
    setFiltros({
      busca: '',
      status: 'todos',
      dataInicio: '',
      dataFim: '',
      temAcesso: 'todos'
    });
    setPaginaAtual(1);
  };

  return (
    <div>
      {/* Cabeçalho com Filtros */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-sm text-gray-700">
            Total: {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
          </button>
        </div>
      </div>

      {/* Painel de Filtros */}
      {mostrarFiltros && (
        <div className="mb-4 p-4 bg-gray-50 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Buscar</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filtros.busca}
                  onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Buscar usuários..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={filtros.status}
                onChange={e => setFiltros(f => ({ ...f, status: e.target.value as typeof filtros.status }))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Acesso</label>
              <select
                value={filtros.temAcesso}
                onChange={e => setFiltros(f => ({ ...f, temAcesso: e.target.value as typeof filtros.temAcesso }))}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="todos">Todos</option>
                <option value="sim">Com Acesso</option>
                <option value="nao">Sem Acesso</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Validade</label>
              <div className="mt-1 flex space-x-2">
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={limparFiltros}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Tabela de Usuários */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Validade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Atividade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {usuariosPaginados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Nenhum usuário encontrado com os filtros selecionados
                </td>
              </tr>
            ) : (
              usuariosPaginados.map((user) => (
                <tr key={user.id} className={user.ativo ? 'bg-green-50' : undefined}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.nome}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.status === 'ativo' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.validade).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.ativo ? (
                      <div className="flex items-center">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></span>
                        <span>Online desde {new Date(user.ativo.ultimo_acesso).toLocaleString('pt-BR')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-300 mr-2"></span>
                        <span>Offline</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => onEdit(user)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => onToggleStatus(user)}
                      className={`${
                        user.status === 'ativo' 
                          ? 'text-red-600 hover:text-red-900'
                          : 'text-green-600 hover:text-green-900'
                      } mr-4`}
                    >
                      {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
                          onDelete(user);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginação */}
      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-700">
              Página <span className="font-medium">{paginaAtual}</span> de{' '}
              <span className="font-medium">{totalPaginas}</span>
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                paginaAtual === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                paginaAtual === totalPaginas
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
