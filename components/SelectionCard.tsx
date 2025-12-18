import React from 'react';

interface SelectionCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({ label, selected, onClick, icon }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4
        ${selected 
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md transform scale-[1.02]' 
          : 'border-slate-100 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
        }
      `}
    >
      {icon && <div className={`p-2 rounded-full ${selected ? 'bg-indigo-200' : 'bg-slate-100'}`}>{icon}</div>}
      <span className="font-semibold text-lg">{label}</span>
      {selected && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-auto text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
};