import React from 'react';
import { Activity } from 'lucide-react';

interface LogEntry {
  id: string;
  tipo: string;
  usuario: string;
  ip: string;
  data: string;
}

interface ActivityLogProps {
  entries: LogEntry[];
}

export function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-gray-500" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {entry.tipo}
            </p>
            <p className="text-sm text-gray-500">
              {entry.usuario} - IP: {entry.ip}
            </p>
          </div>
          <div className="flex-shrink-0 text-sm text-gray-500">
            {new Date(entry.data).toLocaleString('pt-BR')}
          </div>
        </div>
      ))}
    </div>
  );
}