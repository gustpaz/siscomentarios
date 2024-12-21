import React from 'react';
import type { Stats } from '../services/api';
import { Users, UserCheck, UserX, Clock, Wifi } from 'lucide-react';

interface StatsPanelProps {
  stats: Stats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const statItems = [
    {
      label: 'Total de Usuários',
      value: stats.totalUsuarios,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      label: 'Usuários Ativos',
      value: stats.usuariosAtivos,
      icon: UserCheck,
      color: 'bg-green-500'
    },
    {
      label: 'Usuários Inativos',
      value: stats.usuariosInativos,
      icon: UserX,
      color: 'bg-red-500'
    },
    {
      label: 'Licenças Expiradas',
      value: stats.licencasExpiradas,
      icon: Clock,
      color: 'bg-yellow-500'
    },
    {
      label: 'Usuários Online',
      value: stats.usuariosOnline,
      icon: Wifi,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {statItems.map((item) => (
        <div key={item.label} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className={`${item.color} p-3 rounded-full`}>
              <item.icon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">{item.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
