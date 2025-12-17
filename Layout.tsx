
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useStore } from './StoreContext';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  isChatMode?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, title, isChatMode = false }) => {
  const { user, logout, isAdmin } = useAuth();
  const { personas, config } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const h = () => setHash(window.location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const nav = (h: string) => { window.location.hash = h; setSidebarOpen(false); };

  return (
    <div className="h-screen flex bg-[#0d0d0d] overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-[70] w-64 bg-[#0d0d0d] border-r border-[#1a1a1a] transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-14 flex items-center px-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => nav('#/dashboard')}>
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">{config.logoUrl ? <img src={config.logoUrl} className="w-full h-full object-cover" /> : config.appName.charAt(0)}</div>
            <span className="font-bold text-sm tracking-tight text-white truncate">{config.appName}</span>
          </div>
        </div>
        <div className="px-4 mt-6">
          <button onClick={() => nav('#/dashboard')} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/5 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> New Chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
          <div className="px-3 py-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Main Access</div>
          <button onClick={() => nav('#/dashboard')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${hash === '#/dashboard' || hash === '' ? 'bg-white/5 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> Hub
          </button>
          {isAdmin && <button onClick={() => nav('#/admin')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${hash === '#/admin' ? 'bg-white/5 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg> Admin
          </button>}
          <div className="pt-6 py-2 px-3 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Active Uplinks</div>
          {personas.map(p => (
            <button key={p.id} onClick={() => nav(`#/chat/${p.id}`)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-all ${hash.includes(p.id) ? 'bg-white/5 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>{p.name}</button>
          ))}
        </nav>
        {/* Profile Bottom Left */}
        <div className="p-4 border-t border-[#1a1a1a] bg-[#0d0d0d]">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => nav('#/profile')}>
            <div className="w-9 h-9 rounded-full bg-brand-600/10 border border-brand-600/30 flex items-center justify-center text-brand-400 font-bold text-xs">{user?.username.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.username}</p>
              <p className="text-[9px] text-neutral-500 font-mono uppercase">Operator</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); logout(); }} className="p-2 text-neutral-600 hover:text-red-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-14 flex items-center px-4 border-b border-[#1a1a1a] lg:hidden z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-neutral-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          <span className="font-bold text-white ml-2 text-sm">{title}</span>
        </header>
        <div className={`flex-1 overflow-hidden ${isChatMode ? 'p-0' : 'p-6 lg:p-10 overflow-y-auto custom-scrollbar'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
