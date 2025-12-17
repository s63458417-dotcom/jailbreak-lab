
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
    model: 'custom-gpt-model',
    keyPoolId: '',
    avatar: 'shield',
    baseUrl: ''
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
    setFormData({ name: '', description: '', systemPrompt: '', model: 'custom-gpt-model', avatar: 'shield', baseUrl: '' });
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
        <div className="mb-6 flex overflow-x-auto bg-[#1a1a1a] p-1 rounded-lg border border-neutral-800 gap-1 no-scrollbar">
             {['ai', 'vault', 'db', 'users', 'branding', 'data'].map(tab => (
                 <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all whitespace-nowrap ${activeTab === tab ? 'bg-brand-600 text-white' : 'text-neutral-500 hover:text-white'}`}
                >
                    {tab === 'ai' ? 'Personas' : tab === 'db' ? 'Supabase' : tab}
                </button>
             ))}
        </div>

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8">
        <div className="xl:w-1/3">
            <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 font-bold text-neutral-400 text-xs tracking-widest uppercase">Persona List</div>
                <div className="divide-y divide-neutral-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {personas.map(p => (
                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-white/5">
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
                         <Input label="Persona Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Offensive Counselor" />
                         <Input label="Model Identifier" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} required placeholder="gpt-4o" />
                    </div>
                    <Input label="Provider Endpoint URL" value={formData.baseUrl || ''} onChange={e => setFormData({...formData, baseUrl: e.target.value})} placeholder="https://api.yourprovider.com/v1" />
                    <div>
                        <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2 tracking-widest">System Instructions</label>
                        <textarea className="w-full bg-black border border-neutral-800 text-neutral-200 p-4 rounded-lg min-h-[250px] font-mono text-xs focus:border-brand-500 outline-none" value={formData.systemPrompt || ''} onChange={e => setFormData({...formData, systemPrompt: e.target.value})} required placeholder="Enter persona identity and rules here..." />
                    </div>
                    <div className="grid grid-cols-2 gap-5 pt-4 border-t border-neutral-800">
                         <div className="space-y-4">
                             <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Auth Strategy</label>
                             <select className="w-full bg-black border border-neutral-800 text-white rounded-lg p-3 text-xs" value={formData.keyPoolId || ''} onChange={e => setFormData({...formData, keyPoolId: e.target.value})}>
                                 <option value="">Direct Key Entry</option>
                                 {keyPools.map(pool => <option key={pool.id} value={pool.id}>{pool.name}</option>)}
                             </select>
                             <Input label="Direct Auth Token" type="password" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} placeholder="sk-..." />
                         </div>
                         <div className="space-y-4">
                             <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-neutral-800">
                                <input type="checkbox" checked={formData.isLocked} onChange={e => setFormData({...formData, isLocked: e.target.checked})} />
                                <span className="text-xs text-white uppercase font-bold tracking-widest">Access Passphrase Required</span>
                             </div>
                             {formData.isLocked && <Input label="Required Passphrase" value={formData.accessKey || ''} onChange={e => setFormData({...formData, accessKey: e.target.value})} placeholder="secret-key" />}
                         </div>
                    </div>
                    <Button type="submit" fullWidth>{editingId ? 'Save Changes' : 'Deploy Persona'}</Button>
               </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'vault' && (
          <div className="flex flex-col xl:flex-row gap-8">
              <div className="xl:w-1/3">
                  <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                      <div className="p-4 border-b border-neutral-800 font-bold text-neutral-400 text-xs tracking-widest uppercase">Key Vaults</div>
                      <div className="divide-y divide-neutral-800">
                          {keyPools.map(pool => (
                              <div key={pool.id} className="p-4 flex justify-between items-center hover:bg-white/5 cursor-pointer" onClick={() => handleEditPool(pool)}>
                                  <div className="text-sm font-bold text-white">{pool.name}</div>
                                  <Button variant="danger" onClick={(e) => { e.stopPropagation(); deleteKeyPool(pool.id); }} className="px-2 h-7 text-[10px]">Del</Button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              <div className="xl:w-2/3 bg-[#1a1a1a] p-6 rounded-xl border border-neutral-800">
                  <form onSubmit={handlePoolSubmit} className="space-y-6">
                      <Input label="Vault Identifier" value={poolForm.name || ''} onChange={e => setPoolForm({...poolForm, name: e.target.value})} required />
                      <div>
                          <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2 tracking-widest">Key Payload (One per line)</label>
                          <textarea className="w-full bg-black border border-neutral-800 text-neutral-300 p-4 rounded-lg min-h-[300px] font-mono text-xs outline-none" value={poolKeysText} onChange={e => setPoolKeysText(e.target.value)} required />
                      </div>
                      <Button type="submit" fullWidth>Update Vault</Button>
                  </form>
              </div>
          </div>
      )}

      {activeTab === 'db' && (
          <div className="max-w-xl bg-[#1a1a1a] p-8 rounded-xl border border-neutral-800">
              <h3 className="text-xl font-bold text-white mb-6">Database Link</h3>
              <div className="space-y-6">
                  <Input label="Endpoint URL" value={dbUrl} onChange={e => setDbUrl(e.target.value)} />
                  <Input label="Secret Key" type="password" value={dbKey} onChange={e => setDbKey(e.target.value)} />
                  <Button onClick={handleSaveDb} fullWidth>Synchronize</Button>
              </div>
          </div>
      )}

      {activeTab === 'data' && (
          <div className="max-w-xl bg-[#1a1a1a] p-8 rounded-xl border border-neutral-800">
              <h3 className="text-xl font-bold text-white mb-6">Backup and Recovery</h3>
              <div className="space-y-4">
                  <Button onClick={() => { const d = exportData(); const b = new Blob([d], {type:'application/json'}); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href=u; l.download='backup.json'; l.click(); }} fullWidth variant="secondary">Download System Snapshot</Button>
                  <label className="block w-full py-3 px-4 bg-black border border-neutral-800 rounded-lg text-center cursor-pointer text-xs font-bold uppercase text-brand-500">
                      Upload Snapshot
                      <input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if(!f) return; const r = new FileReader(); r.onload = async (ev) => { const s = await importData(ev.target?.result as string); if(s) alert("Restored Successfully"); }; r.readAsText(f); }} className="hidden" />
                  </label>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default AdminPanel;
