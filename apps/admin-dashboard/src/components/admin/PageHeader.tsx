import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * The AppShell already shows the page title as a large heading, so this renders the title for
 * screen readers only and shows the description and primary action.
 */
export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 className="sr-only">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
