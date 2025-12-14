import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  type = 'button', // Default to button to prevent accidental form submits
  ...props 
}) => {
  const baseStyles = "px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md tracking-wide select-none active:scale-95";
  
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 border border-transparent shadow-brand-900/20",
    secondary: "bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 hover:text-white focus:ring-neutral-500",
    danger: "bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 hover:text-red-300 focus:ring-red-500",
    ghost: "bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white border-transparent shadow-none"
  };

  return (
    <button 
      type={type}
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;