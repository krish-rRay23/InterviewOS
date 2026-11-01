import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    neutral: 'bg-cardSurface text-zinc-300 border-borderCol',
    success: 'bg-cardSurface text-accentTeal border-accentTeal/60',
    warning: 'bg-cardSurface text-accentAmber border-accentAmber/60',
    danger: 'bg-cardSurface text-accentRose border-accentRose/60',
    info: 'bg-cardSurface text-accentCyan border-accentCyan/60',
    purple: 'bg-cardSurface text-purple-400 border-purple-500/60',
  };

  const sizeStyles = {
    sm: 'text-[9px] px-2 py-0.5',
    md: 'text-[10px] font-medium px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-none border font-pixel uppercase tracking-wider ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
