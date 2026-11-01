import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  headerClassName = '',
}) => {
  return (
    <div
      className={`bg-cardBg border border-borderCol rounded-xl shadow-md shadow-black/20 overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div
          className={`px-5 py-4 border-b border-borderCol/80 flex items-center justify-between gap-4 ${headerClassName}`}
        >
          <div>
            {title && <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
