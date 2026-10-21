import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Video, ShieldCheck, Sun, Moon, LogOut, Home, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isDashboard = location.pathname === '/dashboard';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-all duration-300">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
              Aether<span className="text-brand-400">Meet</span>
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> WebRTC Secure
            </span>
          </div>
        </Link>

        {/* Center / Navigation Links (Home & Dashboard) */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/"
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
              isHome
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
            )}
            title="Go to Home"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          <Link
            to="/dashboard"
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
              isDashboard
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
            )}
            title="Go to Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </nav>

        {/* Action Controls & User Nav */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/70 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300 font-semibold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline-block text-sm font-medium text-gray-200">
                {user.name}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm font-medium text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded-lg shadow-sm hover:shadow-brand-500/25 transition-all"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
