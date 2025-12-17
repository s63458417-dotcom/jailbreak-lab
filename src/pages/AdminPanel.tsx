import React, { useState, useRef, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Persona, SystemConfig, ChatSession, KeyPool } from '../types';
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

  // Supabase Link
  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [dbKey, setDbKey] = useState(localStorage.getItem('supabase_key') || '');

  const handleSaveDb = () => {
      if (!dbUrl || !dbKey) return alert("Credentials required");
      initSupabase(dbUrl, dbKey);
      alert("Database link established. The application will now sync globally.");
      window.location.reload(); 
  };

  // AI Personas
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Persona>>({
    name: '',
    description: '',
    systemPrompt: '',
    isLocked: false,
    accessKey: '',
    model: 'gemini-3-flash-preview',
    keyPoolId: '',
    avatar: 'shield',
    rateLimit: 0
  });

  const handleEdit = (p: Persona) => {
    setEditingId(p.id);
    setFormData(p);
  };

  const handlePersonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.systemPrompt) return alert("Required fields missing");
    
    if (editingId) await updatePersona({ ...formData, id: editingId } as Persona);
    else await addPersona({ ...formData, id: Date.now().toString() } as Persona);
    
    setEditingId(null);
    setFormData({ name: '', description: '', systemPrompt: '', model: 'gemini-3-flash-preview', avatar: 'shield' });
  };

  // Vaults
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [poolKeysText, setPoolKeysText] = useState('');
  const [poolForm, setPoolForm] = useState<Partial<KeyPool>>({ name: '', provider: 'google', keys: [], deadKeys: {} });

  const handlePoolSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const keys = poolKeysText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
      if (keys.length === 0) return alert("Paste some keys first");

      const payload: KeyPool = {
          id: editingPoolId || Date.now().toString(),
          name: poolForm.name || 'New Vault',
          provider: poolForm.provider || 'google',
          keys: keys,
          deadKeys: poolForm.deadKeys || {}
      };

      if (editingPoolId) await updateKeyPool(payload);
      else await addKeyPool(payload);

      setEditingPoolId(null);
      setPoolKeysText('');
      setPoolForm({ name: '', provider: 'google', keys: [], deadKeys: {} });
  };

  const handleEditPool = (pool: KeyPool) => {
      setEditingPoolId(pool.id);
      setPoolForm(pool);
      setPoolKeysText(pool.keys.join('\n'));
  };

  // Backup & Restore
  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jailbreak-lab-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await importData(content);
      if (success) alert("System restored and synced to cloud.");
      else alert("Restore failed: Invalid file structure.");
    };
    reader.readAsText(file);
  };

  return (
    <Layout title="Infrastructure Control">
        <div className="mb-6 flex overflow-x-auto bg-[#1a1a1a] p-1 rounded-lg border border-neutral-800 gap-1 no-scrollbar">
             {['ai', 'vault', 'db', 'users', 'branding', 'data'].map(tab => (
                 <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${activeTab === tab ? 'bg-brand-600 text-white' : 'text-neutral-500 hover:text-white'}`}
                >
                    {tab === 'ai' ? 'Intelligence' : tab === 'db' ? 'Cloud Link' : tab}
                </button>
             ))}
        </div>

      {activeTab === 'db' && (
          <div className="max-w-xl bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
              <h3 className="text-xl font-bold text-white mb-6">Supabase Global Sync</h3>
              <div className="space-y-6">
                  <Input label="Project URL" value={dbUrl} onChange={e => setDbUrl(e.target.value)} />
                  <Input label="Anon/Public Key" type="password" value={dbKey} onChange={e => setDbKey(e.target.value)} />
                  <Button onClick={handleSaveDb} fullWidth>Initialize Handshake</Button>
              </div>
          </div>
      )}

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8">
        <div className="xl:w-1/3">
            <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 font-bold text-neutral-400 text-xs uppercase tracking-widest">Active Personas</div>
                <div className="divide-y divide-neutral-800">
                    {personas.map(p => (
                        <div key={p.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/5">
                            <div className="truncate"><div className="text-sm font-bold text-white">{p.name}</div><div className="text-[10px] text-neutral-500 font-mono">{p.model}</div></div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => handleEdit(p)} className="px-3 h-8 text-xs">Edit</Button>
                                <Button variant="danger" onClick={() => deletePersona(p.id)} className="px-3 h-8 text-xs">Del</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="xl:w-2/3">
            <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 p-6">
               <form onSubmit={handlePersonaSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                         <Input label="Codename" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                         <Input label="Model ID" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} required />
                    </div>
                    <div>
                        <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Master Directive</label>
                        <textarea 
                            className="w-full bg-black border border-neutral-800 text-brand-100 p-4 rounded-lg min-h-[400px] font-mono text-xs focus:border-brand-500 outline-none"
                            value={formData.systemPrompt || ''}
                            onChange={e => setFormData({...formData, systemPrompt: e.target.value})}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-5 pt-4 border-t border-neutral-800">
                         <div className="space-y-4">
                             <label className="block text-[10px] font-bold text-neutral-500 uppercase">Vault Connection</label>
                             <select 
                                 className="w-full bg-black border border-neutral-800 text-white rounded-lg p-3 text-xs"
                                 value={formData.keyPoolId || ''}
                                 onChange={e => setFormData({...formData, keyPoolId: e.target.value})}
                             >
                                 <option value="">Direct API Key (No Vault)</option>
                                 {keyPools.map(pool => <option key={pool.id} value={pool.id}>{pool.name} ({pool.keys.length} keys)</option>)}
                             </select>
                             <Input label="Direct API Key" type="password" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} />
                         </div>
                         <div className="space-y-4">
                             <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-neutral-800">
                                <input type="checkbox" checked={formData.isLocked} onChange={e => setFormData({...formData, isLocked: e.target.checked})} className="w-4 h-4" />
                                <span className="text-xs text-white">Require Access Key</span>
                             </div>
                             {formData.isLocked && <Input label="Access Passphrase" value={formData.accessKey || ''} onChange={e => setFormData({...formData, accessKey: e.target.value})} />}
                         </div>
                    </div>
                    <div className="flex gap-4 pt-6 border-t border-neutral-800">
                        <Button type="submit" fullWidth>{editingId ? 'Push Cloud Update' : 'Initialize Cloud Deployment'}</Button>
                        {editingId && <Button type="button" variant="ghost" onClick={() => {setEditingId(null); setFormData({name:'', systemPrompt:''});}}>Abort</Button>}
                    </div>
               </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'vault' && (
          <div className="flex flex-col xl:flex-row gap-8">
              <div className="xl:w-1/3">
                  <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                      <div className="p-4 border-b border-neutral-800 font-bold text-neutral-400 text-xs uppercase tracking-widest">Active Vaults</div>
                      <div className="divide-y divide-neutral-800">
                          {keyPools.map(pool => (
                              <div key={pool.id} className="p-4 flex justify-between items-center hover:bg-white/5 cursor-pointer" onClick={() => handleEditPool(pool)}>
                                  <div>
                                      <div className="text-sm font-bold text-white">{pool.name}</div>
                                      <div className="text-[10px] text-neutral-500 font-mono">{pool.keys.length} KEYS // {pool.provider}</div>
                                  </div>
                                  <Button variant="danger" onClick={(e) => { e.stopPropagation(); deleteKeyPool(pool.id); }} className="px-2 h-7 text-[10px]">Remove</Button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="xl:w-2/3">
                  <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 p-6">
                      <h3 className="text-lg font-bold text-white mb-6">Vault Management</h3>
                      <form onSubmit={handlePoolSubmit} className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                              <Input label="Vault Name" value={poolForm.name || ''} onChange={e => setPoolForm({...poolForm, name: e.target.value})} required />
                              <div>
                                  <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Provider</label>
                                  <select className="w-full bg-black border border-neutral-800 text-white rounded-lg p-3 text-xs" value={poolForm.provider} onChange={e => setPoolForm({...poolForm, provider: e.target.value as any})}>
                                      <option value="google">Google Gemini</option>
                                      <option value="openai">OpenAI Compatible</option>
                                  </select>
                              </div>
                          </div>
                          <div>
                              <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Key Dump (One per line)</label>
                              <textarea 
                                  className="w-full bg-black border border-neutral-800 text-neutral-300 p-4 rounded-lg min-h-[300px] font-mono text-xs outline-none focus:border-brand-500"
                                  placeholder="AIza...\nAIza..."
                                  value={poolKeysText}
                                  onChange={e => setPoolKeysText(e.target.value)}
                                  required
                              />
                          </div>
                          <Button type="submit" fullWidth>Commit Vault to Cloud</Button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'data' && (
          <div className="max-w-xl bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
              <h3 className="text-xl font-bold text-white mb-6">Maintenance & Backup</h3>
              <div className="space-y-8">
                  <div className="p-4 bg-brand-900/10 border border-brand-900/20 rounded-lg">
                      <h4 className="text-brand-500 font-bold text-xs uppercase mb-2">System Export</h4>
                      <p className="text-xs text-neutral-400 mb-4">Generate a full snapshot of personas, vaults, and configuration.</p>
                      <Button onClick={handleExport} fullWidth variant="secondary" className="border-neutral-700">Download Backup (.JSON)</Button>
                  </div>
                  <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
                      <h4 className="text-white font-bold text-xs uppercase mb-2">System Restore</h4>
                      <p className="text-xs text-neutral-400 mb-4">Upload a previously exported JSON file to restore all settings and sync to cloud.</p>
                      <label className="block w-full py-3 px-4 bg-black border border-neutral-800 rounded-lg text-center cursor-pointer hover:border-brand-500 transition-colors text-xs font-bold uppercase tracking-widest text-brand-500">
                          Upload & Restore
                          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                      </label>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'branding' && (
          <div className="max-w-xl bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
              <h3 className="text-xl font-bold text-white mb-6">Visual Identity</h3>
              <form onSubmit={(e) => { e.preventDefault(); updateConfig(config); alert("Identity updated."); }} className="space-y-6">
                  <Input label="Platform Title" value={config.appName} onChange={e => updateConfig({...config, appName: e.target.value})} />
                  <Input label="Creator Signature" value={config.creatorName} onChange={e => updateConfig({...config, creatorName: e.target.value})} />
                  <Input label="Logo URL" value={config.logoUrl} onChange={e => updateConfig({...config, logoUrl: e.target.value})} />
                  <Button type="submit" fullWidth>Update Branding</Button>
              </form>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
               <div className="p-4 border-b border-neutral-800 font-bold text-neutral-400 text-xs uppercase tracking-widest">Operator Roster</div>
               <div className="divide-y divide-neutral-800">
                   {getAllUsers().map(u => (
                       <div key={u.id} className="p-4 flex items-center justify-between">
                           <div>
                               <div className="text-sm font-bold text-white">{u.username}</div>
                               <div className="text-[10px] text-neutral-500 font-mono">{u.role} // {u.id}</div>
                           </div>
                           <div className="text-[10px] text-neutral-500 uppercase">
                               Unlocked: {Object.keys(u.unlockedPersonas).length} AIs
                           </div>
                       </div>
                   ))}
               </div>
          </div>
      )}
    </Layout>
  );
};

export default AdminPanel;