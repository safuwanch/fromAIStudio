import React from 'react';
import { ExternalLink, LogOut, HelpCircle, ShieldCheck } from 'lucide-react';
import { GoogleUserProfile } from '../types';

interface HeaderProps {
  user: GoogleUserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  selectedDirectoryName: string | null;
  onOpenVerificationGuide?: () => void;
  hasCustomToken?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  selectedDirectoryName,
  onOpenVerificationGuide,
  hasCustomToken,
}) => {
  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Brand & App Name */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-base shadow-xs">
          D
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            DriveFetch Pro
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Workspace
            </span>
          </h1>
        </div>
      </div>

      {/* Status & Profile */}
      <div className="flex items-center gap-3 text-sm">
        {/* Verification / Help button */}
        {onOpenVerificationGuide && (
          <button
            onClick={onOpenVerificationGuide}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
            title="Having issues with Google Sign-in Verification? View solutions"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Verification Help</span>
          </button>
        )}

        {/* System Ready Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>
            {user ? 'Authenticated' : hasCustomToken ? 'Custom Token' : 'Public & Direct Mode'}
          </span>
        </div>

        {/* Open in Tab */}
        <button
          onClick={openInNewTab}
          title="Open in new window (enables unrestricted native local directory access)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Open in Tab</span>
        </button>

        {/* User Auth */}
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google user'}
                  className="w-7 h-7 rounded-full object-cover border border-slate-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left hidden lg:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight max-w-[130px] truncate">
                  {user.displayName || 'User'}
                </p>
                <p className="text-[10px] text-slate-500 leading-none truncate max-w-[130px]">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign out of Google"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        )}
      </div>
    </header>
  );
};

