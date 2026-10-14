import React, { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4 bg-white rounded-lg shadow">
      <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}