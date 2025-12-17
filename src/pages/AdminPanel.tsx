
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Persona, SystemConfig, KeyPool } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';
import { initSupabase } from '../services/supabase';

const AdminPanel: React.FC = () => {
  const { 
      personas, addPersona, updatePersona, deletePersona, 
      config, updateConfig, allChats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool,
      exportData, importData
  } = useStore();
  const { getAllUsers } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'ai' | 'vault' | 'users' | 'branding' | 'db' | 'data'>('ai');

  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [dbKey, setDbKey] = useState(localStorage.getItem('supabase_key') || '');

  const handleSaveDb = () => {
      if (!dbUrl || !dbKey) return alert("Credentials required");
      initSupabase(dbUrl, dbKey);
      alert("Cloud link established.");
      window.location.reload(); 
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Persona>>({
    name: '',
    description: '',
    systemPrompt: '',
    isLocked: false,
    accessKey: '',
    accessDuration: 0,
    model: 'custom-gpt-model',
    keyPoolId: '',
    avatar: 'shield',
    baseUrl: '',
    customApiKey: ''
  });

  const handleEdit = (p: Persona) => {
    setEditingId(p.id);
    setFormData(p);
  };

  const handlePersonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) await updatePersona({ ...formData, id: editingId } as Persona);
    else await addPersona({ ...formData, id: Date.now().toString() } as Persona);
    setEditingId(null);
    setFormData({ name: '', description: '', systemPrompt: '', model: 'custom-gpt-model', avatar: 'shield', baseUrl: '', customApiKey: '', isLocked: false, accessKey: '', accessDuration: 0 });
  };

  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [poolKeysText, setPoolKeysText] = useState('');
  const [poolForm, setPoolForm] = useState<Partial<KeyPool>>({ name: '', provider: 'standard', keys: [] });

  const handlePoolSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const keys = poolKeysText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
      const payload: KeyPool = {
          id: editingPoolId || Date.now().toString(),
          name: poolForm.name || 'New Vault',
          provider: poolForm.provider || 'standard',
          keys: keys,
          deadKeys: poolForm.deadKeys || {}
      };
      if (editingPoolId) await updateKeyPool(payload);
      else await addKeyPool(payload);
      setEditingPoolId(null);
      setPoolKeysText('');
      setPoolForm({ name: '', provider: 'standard', keys: [] });
  };

  const handleEditPool = (pool: KeyPool) => {
      setEditingPoolId(pool.id);
      setPoolForm(pool);
      setPoolKeysText(pool.keys.join('\n'));
  };

  return (
    <Layout title="Control Center">
        <div className="mb-8 flex overflow-x-auto bg-[#1a1a1a] p-1.5 rounded-2xl border border-neutral-800 gap-1 no-scrollbar">
             {['ai', 'vault', 'db', 'users', 'branding', 'data'].map(tab => (
                 <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-brand-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                    {tab === 'ai' ? 'Personas' : tab === 'db' ? 'Cloud Link' : tab}
                </button>
             ))}
        </div>

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in">
        <div className="xl:w-1/3">
            <div className="bg-[#171717] rounded-2xl border border-[#262626] overflow-hidden">
                <div className="p-4 border-b border-[#262626] font-bold text-neutral-400 text-[10px] tracking-widest uppercase bg-black/20">Persona Management</div>
                <div className="divide-y divide-[#262626] max-h-[600px] overflow-y-auto custom-scrollbar">
                    {personas.map(p => (
                        <div key={p.id} className="p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="truncate pr-4">
                                    <div className="text-sm font-bold text-white mb-0.5">{p.name}</div>
                                    <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-tighter">{p.model}</div>
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${p.isLocked ? 'bg-blue-900/10 text-blue-400 border-blue-900/20' : 'bg-green-900/10 text-green-400 border-green-900/20'}`}>
                                    {p.isLocked ? 'Restricted' : 'Open'}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(p)} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-1.5 rounded-lg border border-white/5 transition-all uppercase tracking-widest">Configure</button>
                                <button onClick={() => deletePersona(p.id)} className="px-3 bg-red-900/10 hover:bg-red-900/20 text-red-500 text-[10px] font-bold rounded-lg border border-red-900/20 transition-all uppercase">Del</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="xl:w-2/3">
            <div className="bg-[#171717] rounded-2xl border border-[#262626] p-6 shadow-2xl">
               <form onSubmit={handlePersonaSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Input label="Uplink ID / Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. DEEPSEEK_JB_V1" />
                         <Input label="Target Model" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} required placeholder="deepseek-ai/DeepSeek-V3" />
                    </div>
                    <Input label="Uplink Endpoint (Base URL)" value={formData.baseUrl || ''} onChange={e => setFormData({...formData, baseUrl: e.target.value})} placeholder="https://api.deepseek.com/v1" />
                    
                    <div>
                        <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2 tracking-widest">System Instructions (Prompt)</label>
                        <textarea className="w-full bg-[#0d0d0d] border border-[#262626] text-neutral-200 p-5 rounded-2xl min-h-[300px] font-mono text-xs focus:border-brand-600 outline-none transition-all" value={formData.systemPrompt || ''} onChange={e => setFormData({...formData, systemPrompt: e.target.value})} required placeholder="Define the AI persona identity and behaviors..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[#262626]">
                         <div className="space-y-4">
                             <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Authorization Logic</label>
                             <select className="w-full bg-[#0d0d0d] border border-[#262626] text-white rounded-xl p-3.5 text-xs font-bold outline-none focus:border-brand-600 transition-all" value={formData.keyPoolId || ''} onChange={e => setFormData({...formData, keyPoolId: e.target.value})}>
                                 <option value="">Direct Credential</option>
                                 {keyPools.map(pool => <option key={pool.id} value={pool.id}>{pool.name} (Vault)</option>)}
                             </select>
                             <Input label="Direct API Key" type="password" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} placeholder="sk-..." className="mb-0" />
                         </div>
                         <div className="space-y-4">
                             <div className="flex items-center gap-3 p-4 bg-[#0d0d0d] rounded-2xl border border-[#262626] cursor-pointer" onClick={() => setFormData({...formData, isLocked: !formData.isLocked})}>
                                <input type="checkbox" checked={formData.isLocked} readOnly className="w-4 h-4 rounded border-[#262626] bg-black text-brand-600" />
                                <span className="text-[10px] text-white uppercase font-bold tracking-widest">Enable Restricted Access</span>
                             </div>
                             {formData.isLocked && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <Input label="Persona Access Key" value={formData.accessKey || ''} onChange={e => setFormData({...formData, accessKey: e.target.value})} placeholder="Unlock password..." />
                                    <Input label="Access Duration (Hours)" type="number" value={formData.accessDuration || 0} onChange={e => setFormData({...formData, accessDuration: Number(e.target.value)})} placeholder="0 = Lifetime" />
                                </div>
                             )}
                         </div>
                    </div>
                    <button type="submit" className="w-full h-14 bg-brand-600 hover:bg-brand-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl shadow-lg transition-all active:scale-95">
                        {editingId ? 'Save Configuration' : 'Initialize Uplink'}
                    </button>
               </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'vault' && (
          <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in">
              <div className="xl:w-1/3">
                  <div className="bg-[#171717] rounded-2xl border border-[#262626] overflow-hidden">
                      <div className="p-4 border-b border-[#262626] font-bold text-neutral-400 text-[10px] tracking-widest uppercase bg-black/20">Vault Inventory</div>
                      <div className="divide-y divide-[#262626]">
                          {keyPools.map(pool => (
                              <div key={pool.id} className="p-4 flex justify-between items-center hover:bg-white/5 cursor-pointer" onClick={() => handleEditPool(pool)}>
                                  <div>
                                      <div className="text-sm font-bold text-white">{pool.name}</div>
                                      <div className="text-[10px] text-neutral-500 font-mono">{pool.keys.length} Keys Loaded</div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); deleteKeyPool(pool.id); }} className="p-2 text-neutral-500 hover:text-red-500">
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              <div className="xl:w-2/3 bg-[#171717] p-8 rounded-2xl border border-[#262626] shadow-xl">
                  <form onSubmit={handlePoolSubmit} className="space-y-6">
                      <Input label="Vault Identifier (System Name)" value={poolForm.name || ''} onChange={e => setPoolForm({...poolForm, name: e.target.value})} required />
                      <div>
                          <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2 tracking-widest">Key Payload (One per line)</label>
                          <textarea className="w-full bg-[#0d0d0d] border border-[#262626] text-neutral-300 p-5 rounded-2xl min-h-[400px] font-mono text-xs outline-none focus:border-brand-600 transition-all custom-scrollbar" value={poolKeysText} onChange={e => setPoolKeysText(e.target.value)} required placeholder="hf_...\nsk-...\n..." />
                      </div>
                      <button type="submit" className="w-full h-14 bg-brand-600 hover:bg-brand-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl transition-all shadow-lg active:scale-95">Update Vault Cache</button>
                  </form>
              </div>
          </div>
      )}

      {activeTab === 'db' && (
          <div className="max-w-2xl bg-[#171717] p-10 rounded-2xl border border-[#262626] animate-in fade-in shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">Cloud Infrastructure</h3>
                    <p className="text-neutral-500 text-sm">Supabase synchronization protocol</p>
                  </div>
              </div>
              <div className="space-y-6">
                  <Input label="Supabase Project URL" value={dbUrl} onChange={e => setDbUrl(e.target.value)} placeholder="https://....supabase.co" />
                  <Input label="Service Role Key / Anon Key" type="password" value={dbKey} onChange={e => setDbKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1Ni..." />
                  <button onClick={handleSaveDb} className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl transition-all shadow-lg active:scale-95">Establish Secure Link</button>
                  <p className="text-[10px] text-neutral-600 text-center font-mono">Warning: Updating credentials will force a system reboot.</p>
              </div>
          </div>
      )}

      {activeTab === 'data' && (
          <div className="max-w-xl bg-[#171717] p-10 rounded-2xl border border-[#262626] animate-in fade-in shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">System Data Protocol</h3>
              <p className="text-neutral-500 text-sm mb-8">Backup, restore, and snapshot management.</p>
              <div className="space-y-4">
                  <button onClick={() => { const d = exportData(); const b = new Blob([d], {type:'application/json'}); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href=u; l.download='jailbreak_lab_snapshot.json'; l.click(); }} className="w-full h-14 bg-[#262626] hover:bg-[#333] text-white font-bold uppercase tracking-widest text-xs rounded-2xl transition-all border border-[#404040]">Download Snapshot (.json)</button>
                  <label className="block w-full h-14 flex items-center justify-center bg-brand-600/10 hover:bg-brand-600/20 border border-brand-600/30 rounded-2xl text-center cursor-pointer text-xs font-bold uppercase text-brand-400 transition-all">
                      Restore from Local Snapshot
                      <input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if(!f) return; const r = new FileReader(); r.onload = async (ev) => { const s = await importData(ev.target?.result as string); if(s) { alert("Core Logic Restored Successfully."); window.location.reload(); } }; r.readAsText(f); }} className="hidden" />
                  </label>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default AdminPanel;
