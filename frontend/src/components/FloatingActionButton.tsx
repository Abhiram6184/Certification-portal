import React, { ReactNode } from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  ariaLabel: string;
  position?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, children, ariaLabel, position = 'bottom-8 right-8' }) => {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`fixed ${position} z-40 h-14 w-14 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95 flex items-center justify-center`}
    >
      {children}
    </button>
  );
};

export default FloatingActionButton;