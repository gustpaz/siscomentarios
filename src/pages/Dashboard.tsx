import React, { useState, useEffect } from 'react';
import { Users, Activity } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { TabButton } from '../components/TabButton';
import { UserModal } from '../components/UserModal';
import { UsersTable } from '../components/UsersTable';
import { ActivityLog } from '../components/ActivityLog';
import { StatsPanel } from '../components/StatsPanel';
import { ErrosAutomacao } from '../components/ErrosAutomacao';
import { 
  getUsuarios, 
  createUsuario, 
  updateUsuario, 
  toggleUsuarioStatus, 
  getLogs, 
  deleteUsuario, 
  getStats,
  getErrosAutomacao,
  resolverErroAutomacao,
  type Usuario, 
  type LogEntry, 
  type Stats,
  type ErroAutomacao
} from '../services/api';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('usuarios');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [erros, setErros] = useState<ErroAutomacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    try {
      setLoading(true);
      if (activeTab === 'usuarios') {
        const [userData, statsData, errosData] = await Promise.all([
          getUsuarios(),
          getStats(),
          getErrosAutomacao()
        ]);
        setUsers(userData);
        setStats(statsData);
        setErros(errosData);
      } else {
        const logsData = await getLogs();
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // Atualizar dados a cada 30 segundos
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleUserSubmit = async (data: Omit<Usuario, 'id' | 'status'>) => {
    try {
      if (editingUser) {
        const usuarioAtualizado = await updateUsuario(editingUser.id, {
          ...data,
          status: editingUser.status
        });
        setUsers(users.map(user => 
          user.id === editingUser.id ? usuarioAtualizado : user
        ));
      } else {
        const novoUsuario = await createUsuario(data);
        setUsers(prev => [...prev, novoUsuario]);
      }
      setIsModalOpen(false);
      setEditingUser(null);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      throw error;
    }
  };

  const handleEdit = (user: Usuario) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (user: Usuario) => {
    try {
      await toggleUsuarioStatus(user.id);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleDelete = async (user: Usuario) => {
    try {
      await deleteUsuario(user.id);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
    }
  };

  const handleResolverErro = async (id: string) => {
    try {
      await resolverErroAutomacao(id);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao resolver erro:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-4 mb-8">
          <TabButton
            icon={Users}
            label="Usuários"
            active={activeTab === 'usuarios'}
            onClick={() => setActiveTab('usuarios')}
          />
          <TabButton
            icon={Activity}
            label="Atividade"
            active={activeTab === 'atividade'}
            onClick={() => setActiveTab('atividade')}
          />
        </div>

        {activeTab === 'usuarios' ? (
          <>
            {stats && <StatsPanel stats={stats} />}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Gerenciamento de Usuários
                    </h3>
                    <button 
                      onClick={() => {
                        setEditingUser(null);
                        setIsModalOpen(true);
                      }}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                      type="button"
                    >
                      Novo Usuário
                    </button>
                  </div>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  {loading ? (
                    <div className="text-center py-4">Carregando...</div>
                  ) : (
                    <UsersTable
                      users={users}
                      onEdit={handleEdit}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDelete}
                    />
                  )}
                </div>
              </div>

              <ErrosAutomacao 
                erros={erros} 
                onResolver={handleResolverErro} 
              />
            </div>
          </>
        ) : (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Log de Atividades
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              {loading ? (
                <div className="text-center py-4">Carregando...</div>
              ) : (
                <ActivityLog entries={logs} />
              )}
            </div>
          </div>
        )}
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleUserSubmit}
        editingUser={editingUser}
      />
    </div>
  );
}
