
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import Button from './Button';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  isChatMode?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, title, isChatMode = false }) => {
  const { user, logout, isAdmin } = useAuth();
  const { personas, config } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const activePersonaId = currentHash.startsWith('#/chat/') ? currentHash.split('/chat/')[1] : null;

  const handleNav = (hash: string) => {
    window.location.hash = hash;
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex bg-neutral-950 text-neutral-200 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[70] w-64 bg-neutral-900 border-r border-neutral-800 
        transform transition-transform duration-300 flex flex-col flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-5 border-b border-neutral-800 bg-neutral-900 flex-shrink-0">
             <div className="flex items-center gap-3 select-none cursor-pointer" onClick={() => handleNav('#/dashboard')}>
                <div className="w-8 h-8 bg-brand-600 rounded flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand-900/50">
                  {config.appName.charAt(0)}
                </div>
                <span className="font-bold text-lg tracking-tight text-white truncate max-w-[150px]">{config.appName}</span>
            </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
            <button
                onClick={() => handleNav('#/dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer ${
                  currentHash === '#/dashboard' || currentHash === '' || currentHash === '#' 
                  ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/5' 
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                }`}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Jailbroken AIs
            </button>

            {isAdmin && (
                <button
                    onClick={() => handleNav('#/admin')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer ${
                      currentHash === '#/admin' 
                      ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/5' 
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Admin Console
                </button>
            )}

            <div className="pt-6 pb-3 px-3 text-xs font-bold text-neutral-600 uppercase tracking-widest">
                Uplinks
            </div>
            
            {personas && personas.length > 0 ? personas.map(p => (
                 <button 
                    key={p.id}
                    onClick={() => handleNav(`#/chat/${p.id}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group cursor-pointer ${
                      activePersonaId === p.id 
                      ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/5' 
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                    }`}
                >
                    <span className="truncate flex-1 font-medium text-left">{p.name}</span>
                </button>
            )) : (
              <div className="px-3 py-2 text-xs text-neutral-600 italic">No personas.</div>
            )}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex-shrink-0">
            <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => handleNav('#/profile')}>
                <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 text-sm font-bold text-neutral-300 shadow-sm overflow-hidden">
                    {user?.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                </div>
            </div>
            <Button variant="secondary" fullWidth onClick={logout} className="text-xs h-8 py-0">
               Terminate Session
            </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative bg-neutral-950">
        {/* Mobile Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur lg:hidden flex-shrink-0 z-30 sticky top-0">
             <div className="flex items-center gap-3">
                 <button onClick={() => setSidebarOpen(true)} className="text-neutral-400 hover:text-white p-2 -ml-2 rounded-md hover:bg-neutral-800">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                 </button>
                 <span className="font-bold text-white truncate text-lg">{config.appName}</span>
             </div>
        </header>

        {/* Desktop Header */}
        {!isChatMode && (
          <header className="hidden lg:flex h-20 items-center justify-between px-10 border-b border-neutral-900 bg-neutral-950 flex-shrink-0">
               <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
          </header>
        )}

        {/* Scrollable Content Container */}
        <main className={`flex-1 overflow-hidden relative ${isChatMode ? 'p-0' : 'p-4 lg:p-10 overflow-y-auto'}`}>
            {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
