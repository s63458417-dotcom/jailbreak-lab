import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Persona } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';

const UserDashboard: React.FC = () => {
  const { personas } = useStore();
  const { user, unlockPersona, getPersonaAccessTime, isAdmin } = useAuth();
  const [keyInput, setKeyInput] = useState<{ [id: string]: string }>({});
  const [errorMap, setErrorMap] = useState<{ [id: string]: string }>({});
  const [activeTab, setActiveTab] = useState<'open' | 'restricted'>('open');
  
  const [tick, setTick] = useState(0);
  useEffect(() => {
      const interval = setInterval(() => setTick(t => t + 1), 60000); 
      return () => clearInterval(interval);
  }, []);

  const handleUnlock = (personaId: string, accessKey?: string) => {
    const input = keyInput[personaId];
    if (input === accessKey) {
      unlockPersona(personaId);
      setErrorMap(prev => ({ ...prev, [personaId]: '' }));
    } else {
      setErrorMap(prev => ({ ...prev, [personaId]: 'Invalid access key' }));
    }
  };

  const startChat = (personaId: string) => {
    window.location.hash = `#/chat/${personaId}`;
  };

  const getIcon = (type: string, url?: string) => {
      if (url) {
          return <img src={url} alt="Icon" className="w-6 h-6 object-cover rounded" />;
      }

      switch(type) {
          case 'shield': return (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          );
          case 'target': return (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          );
          case 'code': return (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          );
          case 'chip': return (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
          );
          default: return (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          );
      }
  }

  const PersonaCard: React.FC<{ persona: Persona }> = ({ persona }) => {
      const isLocked = persona.isLocked;
      const unlockedAt = getPersonaAccessTime(persona.id);
      
      let hasAccess = isAdmin || !!unlockedAt;
      let remainingTimeStr = '';

      if (hasAccess && !isAdmin && persona.accessDuration && unlockedAt) {
          const expirationTime = unlockedAt + (persona.accessDuration * 60 * 60 * 1000);
          const now = Date.now();
          if (now > expirationTime) {
              hasAccess = false; 
          } else {
              const diff = expirationTime - now;
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
              remainingTimeStr = `${hours}h ${mins}m remaining`;
          }
      }

      const needsUnlock = isLocked && !hasAccess;
      const customColor = persona.themeColor;
      
      const cardStyle = customColor ? { borderColor: customColor, boxShadow: `0 4px 20px -10px ${customColor}40` } : {};
      const buttonStyle = customColor ? { backgroundColor: customColor } : {};
      const textStyle = customColor ? { color: customColor } : {};

      return (
        <div 
          className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-sm hover:border-brand-900 transition-all flex flex-col overflow-hidden group relative"
          style={cardStyle}
        >
          {customColor && <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: customColor }}></div>}

          <div className="p-6 flex-grow">
             <div className="flex justify-between items-start mb-4">
                 <div className="p-2 bg-neutral-800 rounded border border-neutral-700 text-neutral-400">
                    {getIcon(persona.avatar, persona.avatarUrl)}
                 </div>
                 {needsUnlock ? (
                    <span className="bg-brand-900/30 text-brand-400 text-xs font-semibold px-2.5 py-0.5 rounded border border-brand-900/50 uppercase">Premium</span>
                 ) : (
                    persona.isLocked && <span className="bg-green-900/30 text-green-400 text-xs font-semibold px-2.5 py-0.5 rounded border border-green-900/50 uppercase">Unlocked</span>
                 )}
                 {!persona.isLocked && <span className="bg-blue-900/30 text-blue-400 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-900/50 uppercase">Free</span>}
             </div>
             
             <h3 className="text-lg font-bold text-white mb-1 group-hover:text-brand-500 transition-colors" style={textStyle}>{persona.name}</h3>
             <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-neutral-500 font-mono bg-neutral-950 px-2 py-0.5 rounded">{persona.model}</span>
                {persona.rateLimit ? (
                    <span className="text-xs text-orange-400 font-mono bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/30">
                        LIMIT: {persona.rateLimit}/DAY
                    </span>
                ) : null}
             </div>
             <p className="text-neutral-400 text-sm leading-relaxed mb-2">
                {persona.description}
              </p>
              {remainingTimeStr && (
                  <div className="text-xs text-brand-400 font-mono mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {remainingTimeStr}
                  </div>
              )}
          </div>

          <div className="p-6 bg-neutral-950/50 border-t border-neutral-800 mt-auto">
            {needsUnlock ? (
              <div className="space-y-3">
                <Input 
                  placeholder="ENTER ACCESS KEY"
                  type="password"
                  value={keyInput[persona.id] || ''}
                  onChange={(e) => setKeyInput({...keyInput, [persona.id]: e.target.value})}
                  error={errorMap[persona.id]}
                  className="text-sm mb-0"
                />
                <Button 
                  variant="danger" 
                  fullWidth 
                  onClick={() => handleUnlock(persona.id, persona.accessKey)}
                >
                  Authorize
                </Button>
                {persona.accessDuration ? <p className="text-[10px] text-center text-neutral-500">Access expires in {persona.accessDuration} hours</p> : null}
              </div>
            ) : (
              <button 
                onClick={() => startChat(persona.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-all duration-200 bg-neutral-800 text-neutral-200 border border-neutral-700 hover:text-white hover:brightness-110 active:scale-95 shadow-md"
                style={buttonStyle}
              >
                Initiate Link 
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            )}
          </div>
        </div>
      );
  }

  if (!personas) return <Layout title="Available Intelligence"><div>Loading Uplinks...</div></Layout>;

  const freeTier = personas.filter(p => !p.isLocked);
  const paidTier = personas.filter(p => p.isLocked);
  
  const activePersonas = activeTab === 'open' ? freeTier : paidTier;

  return (
    <Layout title="Dashboard">
      
      <div className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur border-b border-neutral-800 -mx-4 lg:-mx-10 px-4 lg:px-10 pt-4 mb-8">
          <div className="flex space-x-6 overflow-x-auto hide-scrollbar">
              <button 
                  onClick={() => setActiveTab('open')}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                      activeTab === 'open' 
                      ? 'border-blue-500 text-blue-500' 
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
              >
                  <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Open Intelligence ({freeTier.length})
                  </span>
              </button>
              
              <button 
                  onClick={() => setActiveTab('restricted')}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                      activeTab === 'restricted' 
                      ? 'border-brand-500 text-brand-500' 
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
              >
                  <span className="flex items-center gap-2">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Restricted Intelligence ({paidTier.length})
                  </span>
              </button>
          </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activePersonas.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {activePersonas.map(p => <PersonaCard key={p.id} persona={p} />)}
             </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
                  <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                  </div>
                  <p className="text-lg font-medium text-neutral-400">No Intelligence Found</p>
                  <p className="text-sm italic mt-1">Check back later for new model deployments.</p>
              </div>
          )}
      </div>

    </Layout>
  );
};

export default UserDashboard;