
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
    <div className="h-screen flex bg-[#0d0d0d] text-[#e5e5e5] font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[70] w-64 bg-[#171717] border-r border-[#262626] 
        transform transition-transform duration-300 ease-in-out flex flex-col flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header - App Brand */}
        <div className="h-16 flex items-center px-4 border-b border-[#262626] bg-[#171717] flex-shrink-0">
             <div className="flex items-center gap-3 w-full cursor-pointer group" onClick={() => handleNav('#/dashboard')}>
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-105 transition-transform overflow-hidden">
                  {config.logoUrl ? <img src={config.logoUrl} className="w-full h-full object-cover" /> : config.appName.charAt(0)}
                </div>
                <span className="font-bold text-lg tracking-tight text-white truncate flex-1">{config.appName}</span>
                <button className="lg:hidden p-2 text-neutral-500" onClick={(e) => { e.stopPropagation(); setSidebarOpen(false); }}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-4">
             <button 
                onClick={() => handleNav('#/dashboard')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-all border border-white/5"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Chat
            </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
            <div className="px-3 py-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                System Access
            </div>
            
            <button
                onClick={() => handleNav('#/dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentHash === '#/dashboard' || currentHash === '' || currentHash === '#' 
                  ? 'bg-white/10 text-white' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Intelligence Hub
            </button>

            {isAdmin && (
                <button
                    onClick={() => handleNav('#/admin')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentHash === '#/admin' 
                      ? 'bg-white/10 text-white' 
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Control Center
                </button>
            )}

            <div className="pt-6 pb-2 px-3 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                Active Uplinks
            </div>
            
            {personas && personas.length > 0 ? personas.map(p => (
                 <button 
                    key={p.id}
                    onClick={() => handleNav(`#/chat/${p.id}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                      activePersonaId === p.id 
                      ? 'bg-white/10 text-white' 
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <span className="truncate flex-1">{p.name}</span>
                </button>
            )) : (
              <div className="px-3 py-2 text-xs text-neutral-600 italic">No uplinks deployed.</div>
            )}
        </nav>

        {/* User Footer - Profile at Bottom Left style */}
        <div className="p-4 border-t border-[#262626] bg-[#171717] flex-shrink-0">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNav('#/profile')}>
                <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-brand-400 font-bold text-sm shadow-inner group-hover:brightness-125 transition-all">
                    {user?.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{user?.username}</p>
                    <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-tighter">Operative Active</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); logout(); }}
                  className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                  title="Terminate Session"
                >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative bg-[#0d0d0d]">
        {/* Mobile Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-[#262626] bg-[#171717] lg:hidden flex-shrink-0 z-30">
             <div className="flex items-center gap-3">
                 <button onClick={() => setSidebarOpen(true)} className="text-neutral-400 hover:text-white p-2">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                 </button>
                 <span className="font-bold text-white text-base truncate">{title || config.appName}</span>
             </div>
             <button onClick={() => handleNav('#/dashboard')} className="p-2 text-neutral-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
             </button>
        </header>

        {/* Scrollable Content Container */}
        <main className={`flex-1 overflow-hidden relative ${isChatMode ? 'p-0' : 'p-4 lg:p-8 overflow-y-auto custom-scrollbar'}`}>
            {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
