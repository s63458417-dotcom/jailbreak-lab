
import React, { useState } from 'react';
import Layout from './Layout';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';

const UserDashboard: React.FC = () => {
  const { personas } = useStore();
  const { unlockPersona, getPersonaAccessTime, isAdmin } = useAuth();
  const [keyInput, setKeyInput] = useState<{ [id: string]: string }>({});
  const [activeTab, setActiveTab] = useState<'open' | 'restricted'>('open');

  const handleUnlock = (id: string, key?: string) => {
    if (keyInput[id] === key) unlockPersona(id);
    else alert("Invalid Key");
  };

  const freeTier = personas.filter(p => !p.isLocked);
  const paidTier = personas.filter(p => p.isLocked);
  const activePersonas = activeTab === 'open' ? freeTier : paidTier;

  return (
    <Layout title="Dashboard">
      <div className="max-w-6xl mx-auto pt-4">
          <div className="flex gap-6 mb-8 border-b border-[#2e2e2e]">
              <button onClick={() => setActiveTab('open')} className={`pb-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'open' ? 'border-blue-500 text-white' : 'border-transparent text-neutral-500'}`}>Standard ({freeTier.length})</button>
              <button onClick={() => setActiveTab('restricted')} className={`pb-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'restricted' ? 'border-blue-500 text-white' : 'border-transparent text-neutral-500'}`}>Restricted ({paidTier.length})</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {activePersonas.map(p => {
                const unlocked = isAdmin || !!getPersonaAccessTime(p.id);
                return (
                  <div key={p.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5 flex flex-col h-full hover:border-[#404040]">
                    <h3 className="text-lg font-semibold text-white mb-2">{p.name}</h3>
                    <p className="text-neutral-400 text-sm flex-grow mb-4">{p.description}</p>
                    {(!unlocked && p.isLocked) ? (
                      <div className="space-y-3">
                        <input type="password" placeholder="Access Key" className="w-full bg-[#2b2b2b] border border-[#404040] rounded px-3 py-2 text-sm text-white" onChange={e => setKeyInput({...keyInput, [p.id]: e.target.value})} />
                        <button onClick={() => handleUnlock(p.id, p.accessKey)} className="w-full bg-blue-600 text-white py-2 rounded">Unlock</button>
                      </div>
                    ) : (
                      <button onClick={() => window.location.hash = `#/chat/${p.id}`} className="w-full bg-white text-black py-2 rounded font-bold">Start Chat</button>
                    )}
                  </div>
                );
              })}
          </div>
      </div>
    </Layout>
  );
};
export default UserDashboard;
