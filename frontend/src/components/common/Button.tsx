import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-none transition-all duration-100 focus:outline-none focus:ring-1 focus:ring-accentCyan/50 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary: 'bg-accentCyan hover:bg-[#38f9d7] text-darkBg font-mono font-semibold shadow-pixel-sm active:translate-y-0.5 border border-accentCyan',
    secondary: 'bg-cardSurface hover:bg-[#152033] text-zinc-100 border border-borderCol shadow-pixel-sm active:translate-y-0.5 font-mono',
    outline: 'border border-borderCol text-zinc-300 hover:bg-cardSurface hover:border-accentCyan hover:text-accentCyan rounded-none font-mono',
    danger: 'bg-accentRose hover:bg-[#fb7185] text-white shadow-pixel-sm active:translate-y-0.5 border border-accentRose font-mono',
    ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-cardSurface rounded-none font-mono',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : icon}
      {children}
    </button>
  );
};
