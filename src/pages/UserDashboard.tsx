
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
      
      return (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl hover:border-[#404040] transition-colors p-5 flex flex-col h-full group">
          <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#2b2b2b] flex items-center justify-center text-neutral-400">
                  {/* Simple Icon placeholder */}
                  <span className="text-lg font-bold">{persona.name.charAt(0)}</span>
              </div>
              {needsUnlock && <span className="bg-[#3b82f6]/10 text-brand-400 text-[10px] font-semibold px-2 py-1 rounded">PRO</span>}
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-2">{persona.name}</h3>
          <p className="text-neutral-400 text-sm leading-relaxed mb-4 flex-grow">
            {persona.description}
          </p>
          
          <div className="mt-auto pt-4 border-t border-[#2e2e2e]">
             {needsUnlock ? (
                  <div className="space-y-3">
                    <input 
                        type="password"
                        placeholder="Access Key"
                        className="w-full bg-[#2b2b2b] border border-[#404040] rounded px-3 py-2 text-sm text-white focus:border-brand-500 outline-none"
                        value={keyInput[persona.id] || ''}
                        onChange={(e) => setKeyInput({...keyInput, [persona.id]: e.target.value})}
                    />
                    <button 
                        onClick={() => handleUnlock(persona.id, persona.accessKey)}
                        className="w-full bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium py-2 rounded transition-colors"
                    >
                        Unlock
                    </button>
                    {errorMap[persona.id] && <p className="text-xs text-red-400">{errorMap[persona.id]}</p>}
                  </div>
             ) : (
                  <button 
                    onClick={() => startChat(persona.id)}
                    className="w-full bg-white text-black hover:bg-neutral-200 text-sm font-medium py-2 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    Start Chat
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
             )}
          </div>
        </div>
      );
  }

  const freeTier = personas.filter(p => !p.isLocked);
  const paidTier = personas.filter(p => p.isLocked);
  const activePersonas = activeTab === 'open' ? freeTier : paidTier;

  return (
    <Layout title="Dashboard">
      <div className="max-w-6xl mx-auto pt-4">
          <div className="flex gap-6 mb-8 border-b border-[#2e2e2e]">
              <button 
                  onClick={() => setActiveTab('open')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'open' ? 'border-brand-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
              >
                  Standard Models ({freeTier.length})
              </button>
              <button 
                  onClick={() => setActiveTab('restricted')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'restricted' ? 'border-brand-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}
              >
                  Restricted ({paidTier.length})
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePersonas.length > 0 ? (
                  activePersonas.map(p => <PersonaCard key={p.id} persona={p} />)
              ) : (
                  <div className="col-span-3 text-center py-20 text-neutral-500">
                      No models available in this category.
                  </div>
              )}
          </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
