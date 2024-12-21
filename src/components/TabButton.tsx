import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TabButtonProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function TabButton({ icon: Icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 rounded-lg ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-5 w-5 mr-2" />
      {label}
    </button>
  );
}