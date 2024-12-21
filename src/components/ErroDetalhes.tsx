import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import type { ErroAutomacao } from '../services/api';

interface ErroDetalhesProps {
  erro: ErroAutomacao;
  onResolver: (id: string) => void;
}

export function ErroDetalhes({ erro, onResolver }: ErroDetalhesProps) {
  const [expandido, setExpandido] = useState(false);
  const [secaoExpandida, setSecaoExpandida] = useState<string | null>(null);

  // Parse das seções do erro
  const secoes = {
    principal: erro.erro.split('\n\n')[0],
    stackTrace: erro.erro.match(/Stack Trace:\n([\s\S]*?)(?=\n\nInformações do Sistema:|$)/)?.[1] || '',
    infoSistema: erro.erro.match(/Informações do Sistema:\n([\s\S]*?)(?=\n\nLogs do Chrome:|$)/)?.[1] || '',
    logsChrome: erro.erro.match(/Logs do Chrome:\n([\s\S]*?)(?=\n\n|$)/)?.[1] || ''
  };

  const alternarSecao = (secao: string) => {
    if (secaoExpandida === secao) {
      setSecaoExpandida(null);
    } else {
      setSecaoExpandida(secao);
    }
  };

  return (
    <div className={`border rounded-lg ${
      erro.resolvido ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    }`}>
      {/* Cabeçalho do Erro - Sempre Visível */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              {erro.resolvido ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium text-gray-900">{erro.nome_usuario}</h3>
                <span className="text-sm text-gray-500">({erro.email})</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{secoes.principal}</p>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                <time dateTime={erro.data}>
                  {new Date(erro.data).toLocaleString('pt-BR', {
                    dateStyle: 'long',
                    timeStyle: 'medium'
                  })}
                </time>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!erro.resolvido && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolver(erro.id);
                }}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Marcar como resolvido
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandido(!expandido);
              }}
              className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-500 hover:bg-gray-50"
            >
              {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Detalhes do Erro - Expandível */}
      {expandido && (
        <div className="border-t border-gray-200 px-4 py-3">
          {/* Stack Trace */}
          {secoes.stackTrace && (
            <div className="mb-3">
              <button
                onClick={() => alternarSecao('stackTrace')}
                className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Stack Trace</span>
                {secaoExpandida === 'stackTrace' ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {secaoExpandida === 'stackTrace' && (
                <pre className="mt-2 p-3 bg-gray-800 text-gray-200 rounded-md text-xs overflow-x-auto">
                  {secoes.stackTrace}
                </pre>
              )}
            </div>
          )}

          {/* Informações do Sistema */}
          {secoes.infoSistema && (
            <div className="mb-3">
              <button
                onClick={() => alternarSecao('infoSistema')}
                className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Informações do Sistema</span>
                {secaoExpandida === 'infoSistema' ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {secaoExpandida === 'infoSistema' && (
                <pre className="mt-2 p-3 bg-gray-100 rounded-md text-xs overflow-x-auto">
                  {secoes.infoSistema}
                </pre>
              )}
            </div>
          )}

          {/* Logs do Chrome */}
          {secoes.logsChrome && (
            <div className="mb-3">
              <button
                onClick={() => alternarSecao('logsChrome')}
                className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Logs do Chrome</span>
                {secaoExpandida === 'logsChrome' ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {secaoExpandida === 'logsChrome' && (
                <pre className="mt-2 p-3 bg-gray-100 rounded-md text-xs overflow-x-auto">
                  {secoes.logsChrome}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
