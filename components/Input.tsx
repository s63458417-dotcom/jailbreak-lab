import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full mb-4">
      {label && <label className="block text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1.5">{label}</label>}
      <input
        className={`w-full bg-neutral-900 border ${error ? 'border-brand-600 focus:ring-brand-900' : 'border-neutral-800 focus:border-brand-600 focus:ring-brand-900/20'} text-neutral-200 rounded-md px-3.5 py-2.5 outline-none transition-all shadow-sm focus:ring-2 placeholder:text-neutral-600 ${className}`}
        {...props}
      />
      {error && <p className="text-brand-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default Input;