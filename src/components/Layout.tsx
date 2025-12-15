
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

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
    <div className="h-screen flex bg-[#212121] text-[#ececec] font-sans overflow-hidden selection:bg-brand-500/30">
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - DeepSeek Style: Darker background, minimal borders */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[70] w-[260px] bg-[#0f0f0f] flex flex-col flex-shrink-0 transition-transform duration-300 border-r border-[#1f1f1f]/50
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top Section: Logo & Toggle */}
        <div className="h-14 flex items-center justify-between px-4 mt-2 flex-shrink-0">
             <div className="flex items-center gap-2 select-none cursor-pointer text-brand-400" onClick={() => handleNav('#/dashboard')}>
                {config.logoUrl ? (
                   <img src={config.logoUrl} alt="Logo" className="w-8 h-8 rounded-full" />
                ) : (
                   <svg className="w-7 h-7 text-brand-500" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
                   </svg>
                )}
                <span className="font-semibold text-lg tracking-tight text-white">{config.appName}</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-neutral-400 hover:text-white">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Main Action Button - Changed to "Jailbroken AIs" */}
        <div className="px-4 mb-2">
            <button
                onClick={() => handleNav('#/dashboard')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-[#2b2b2b] hover:bg-[#353535] text-white rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-[#404040]"
            >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Jailbroken AIs
            </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar py-2">
            {isAdmin && (
                <button
                    onClick={() => handleNav('#/admin')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left truncate ${
                      currentHash === '#/admin' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:bg-[#1f1f1f] hover:text-white'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Admin Console
                </button>
            )}

            <div className="mt-6 mb-2 px-3 text-xs font-medium text-neutral-500">
                Recent
            </div>
            
            {personas && personas.length > 0 ? personas.map(p => (
                 <button 
                    key={p.id}
                    onClick={() => handleNav(`#/chat/${p.id}`)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left truncate group ${
                      activePersonaId === p.id 
                      ? 'bg-[#2b2b2b] text-white' 
                      : 'text-neutral-400 hover:bg-[#1f1f1f] hover:text-white'
                    }`}
                >
                    <span className="truncate flex-1">{p.name}</span>
                </button>
            )) : (
              <div className="px-3 py-2 text-xs text-neutral-600 italic">No history.</div>
            )}
        </nav>

        {/* User Footer */}
        <div className="p-3 bg-[#0f0f0f] border-t border-[#1f1f1f]">
            <div className="flex items-center gap-3 p-2 hover:bg-[#1f1f1f] rounded-lg cursor-pointer transition-colors" onClick={() => handleNav('#/profile')}>
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
                    {user?.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{user?.username}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); logout(); }} className="text-neutral-500 hover:text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative bg-[#212121]">
        
        {/* Mobile Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-[#2b2b2b] bg-[#212121] lg:hidden flex-shrink-0 z-30 sticky top-0">
             <div className="flex items-center gap-3">
                 <button onClick={() => setSidebarOpen(true)} className="text-neutral-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                 </button>
                 <span className="font-semibold text-white truncate">{config.appName}</span>
             </div>
             <div className="w-6"></div>
        </header>

        <main className={`flex-1 overflow-hidden relative ${isChatMode ? 'p-0' : 'p-4 lg:p-8 overflow-y-auto'}`}>
            {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
