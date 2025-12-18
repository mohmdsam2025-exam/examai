
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
  themeColor?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading = false,
  themeColor = 'indigo',
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyle = "px-6 py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const colorMap = {
    indigo: {
      bg: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
      text: "text-indigo-600",
      border: "border-indigo-500",
      hoverText: "hover:text-indigo-600",
      hoverBorder: "hover:border-indigo-500"
    },
    emerald: {
      bg: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
      text: "text-emerald-600",
      border: "border-emerald-500",
      hoverText: "hover:text-emerald-600",
      hoverBorder: "hover:border-emerald-500"
    },
    rose: {
      bg: "bg-rose-600 hover:bg-rose-700 shadow-rose-200",
      text: "text-rose-600",
      border: "border-rose-500",
      hoverText: "hover:text-rose-600",
      hoverBorder: "hover:border-rose-500"
    },
    amber: {
      bg: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
      text: "text-amber-600",
      border: "border-amber-500",
      hoverText: "hover:text-amber-600",
      hoverBorder: "hover:border-amber-500"
    },
    slate: {
      bg: "bg-slate-700 hover:bg-slate-800 shadow-slate-200",
      text: "text-slate-700",
      border: "border-slate-500",
      hoverText: "hover:text-slate-700",
      hoverBorder: "hover:border-slate-500"
    }
  };

  const selectedColor = colorMap[themeColor];

  const variants = {
    primary: `${selectedColor.bg} text-white shadow-lg dark:shadow-none`,
    secondary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none",
    outline: `border-2 border-slate-200 ${selectedColor.hoverBorder} ${selectedColor.hoverText} text-slate-600 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300`,
    danger: "bg-red-500 hover:bg-red-600 text-white",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>جاري المعالجة...</span>
        </>
      ) : children}
    </button>
  );
};
