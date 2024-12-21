import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, X, Search } from 'lucide-react';
import { ErroDetalhes } from './ErroDetalhes';
import type { ErroAutomacao } from '../services/api';

interface ErrosAutomacaoProps {
  erros: ErroAutomacao[];
  onResolver: (id: string) => void;
}

export function ErrosAutomacao({ erros, onResolver }: ErrosAutomacaoProps) {
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [filtros, setFiltros] = useState({
    busca: '',
    dataInicio: '',
    dataFim: '',
    status: 'todos' as 'todos' | 'ativos' | 'resolvidos',
    tipoErro: 'todos' as 'todos' | 'timeout' | 'acesso' | 'outros'
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  
  const errosPorPagina = 5;

  // Função para extrair o tipo de erro da mensagem
  const getTipoErro = (erro: string): 'timeout' | 'acesso' | 'outros' => {
    if (erro.toLowerCase().includes('timeout') || erro.toLowerCase().includes('timed out')) {
      return 'timeout';
    }
    if (erro.toLowerCase().includes('acesso') || erro.toLowerCase().includes('access')) {
      return 'acesso';
    }
    return 'outros';
  };

  // Filtra os erros com base nos critérios selecionados
  const errosFiltrados = useMemo(() => {
    return erros.filter(erro => {
      // Filtro por status
      if (filtros.status === 'ativos' && erro.resolvido) return false;
      if (filtros.status === 'resolvidos' && !erro.resolvido) return false;

      // Filtro por tipo de erro
      if (filtros.tipoErro !== 'todos' && getTipoErro(erro.erro) !== filtros.tipoErro) return false;

      // Filtro por data
      const dataErro = new Date(erro.data);
      if (filtros.dataInicio && dataErro < new Date(filtros.dataInicio)) return false;
      if (filtros.dataFim && dataErro > new Date(filtros.dataFim)) return false;

      // Filtro por texto
      if (filtros.busca) {
        const termoBusca = filtros.busca.toLowerCase();
        return (
          erro.erro.toLowerCase().includes(termoBusca) ||
          erro.email.toLowerCase().includes(termoBusca) ||
          erro.nome_usuario.toLowerCase().includes(termoBusca)
        );
      }

      return true;
    });
  }, [erros, filtros]);

  // Pagina os erros filtrados
  const errosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * errosPorPagina;
    const fim = inicio + errosPorPagina;
    return errosFiltrados.slice(inicio, fim);
  }, [errosFiltrados, paginaAtual]);

  const totalPaginas = Math.ceil(errosFiltrados.length / errosPorPagina);

  const limparFiltros = () => {
    setFiltros({
      busca: '',
      dataInicio: '',
      dataFim: '',
      status: 'todos',
      tipoErro: 'todos'
    });
    setPaginaAtual(1);
  };

  if (erros.length === 0) {
    return null;
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Erros da Automação
            </h3>
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
              {errosFiltrados.length} {errosFiltrados.length === 1 ? 'erro' : 'erros'}
            </span>
          </div>
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
          </button>
        </div>

        {/* Painel de Filtros */}
        {mostrarFiltros && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
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
                    placeholder="Buscar nos erros..."
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
                  <option value="ativos">Ativos</option>
                  <option value="resolvidos">Resolvidos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Erro</label>
                <select
                  value={filtros.tipoErro}
                  onChange={e => setFiltros(f => ({ ...f, tipoErro: e.target.value as typeof filtros.tipoErro }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="todos">Todos</option>
                  <option value="timeout">Timeout</option>
                  <option value="acesso">Acesso</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Data</label>
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
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 mr-2"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-5 sm:p-6">
        <div className="space-y-4">
          {errosPaginados.map(erro => (
            <ErroDetalhes 
              key={erro.id} 
              erro={erro} 
              onResolver={onResolver}
            />
          ))}

          {errosFiltrados.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              Nenhum erro encontrado com os filtros selecionados
            </div>
          )}
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
    </div>
  );
}
