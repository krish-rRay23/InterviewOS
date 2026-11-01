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
      className={`bg-cardBg border-2 border-borderCol rounded-none shadow-pixel-sm overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div
          className={`px-5 py-3.5 border-b-2 border-borderCol bg-cardSurface/50 flex items-center justify-between gap-4 ${headerClassName}`}
        >
          <div>
            {title && <h3 className="font-pixel text-[10px] text-zinc-100 uppercase tracking-wider">{title}</h3>}
            {subtitle && <p className="font-mono text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
