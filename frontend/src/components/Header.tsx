import React from 'react';
import { User, UserRole } from '../types';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  currentUser: User;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, theme, onToggleTheme }) => {
  // Determine the home link based on user role
  const homeUrl = currentUser.role === UserRole.Admin ? '#admin/requests' : '#';

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between h-16">
          <a href={homeUrl} aria-label="Go to homepage">
            <Logo theme={theme} />
          </a>
          <div className="flex items-center space-x-4">
             <span className="text-sm text-gray-600 dark:text-gray-400">
                Welcome, <span className="font-semibold text-gray-900 dark:text-gray-100">{currentUser.name}</span>
             </span>
             <ThemeToggle theme={theme} onToggle={onToggleTheme} />
             <button
              onClick={onLogout}
              className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600 dark:border-slate-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
