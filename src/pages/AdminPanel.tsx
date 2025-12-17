
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Persona, SystemConfig, ChatSession, KeyPool } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';
import { initSupabase, isSupabaseConfigured } from '../services/supabase';

const AdminPanel: React.FC = () => {
  const { 
      personas, addPersona, updatePersona, deletePersona, 
      config, updateConfig, allChats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool,
      exportData, importData
  } = useStore();
  const { getAllUsers } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'ai' | 'vault' | 'users' | 'branding' | 'db' | 'data'>('ai');

  // --- Supabase Config Logic ---
  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [dbKey, setDbKey] = useState(localStorage.getItem('supabase_key') || '');

  const handleSaveDb = () => {
      if (!dbUrl || !dbKey) return alert("Both URL and Key are required.");
      initSupabase(dbUrl, dbKey);
      alert("Database link established. The application will now sync globally.");
      window.location.reload(); 
  };

  // --- AI Config Logic ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const defaultForm: Partial<Persona> = {
    name: '',
    description: '',
    systemPrompt: '',
    isLocked: false,
    accessKey: '',
    accessDuration: 0,
    model: 'gemini-3-flash-preview',
    baseUrl: '',
    customApiKey: '',
    keyPoolId: '',
    avatar: 'shield',
    themeColor: '',
    rateLimit: 0
  };

  const [formData, setFormData] = useState<Partial<Persona>>(defaultForm);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
  };

  const handleEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setFormData({ ...persona });
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (deleteConfirmId === id) {
        deletePersona(id);
        if (editingId === id) resetForm();
        setDeleteConfirmId(null);
    } else {
        setDeleteConfirmId(id);
        setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.systemPrompt) {
        alert("Name and System Prompt are required.");
        return;
    }

    if (editingId) {
        updatePersona({ ...formData, id: editingId } as Persona);
    } else {
        addPersona({ ...formData as Persona, id: Date.now().toString() });
    }
    resetForm();
  };

  // --- Vault / Key Pool Logic ---
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [poolForm, setPoolForm] = useState<Partial<KeyPool>>({ name: '', provider: 'google', keys: [], deadKeys: {} });
  const [keysInputText, setKeysInputText] = useState('');

  const handlePoolSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const keysArray = keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
      
      const payload: KeyPool = {
          id: editingPoolId || Date.now().toString(),
          name: poolForm.name || 'New Vault',
          provider: poolForm.provider || 'custom',
          keys: keysArray,
          deadKeys: poolForm.deadKeys || {}
      };

      if (editingPoolId) await updateKeyPool(payload);
      else await addKeyPool(payload);

      setEditingPoolId(null);
      setPoolForm({ name: '', provider: 'google', keys: [], deadKeys: {} });
      setKeysInputText('');
  };

  const handleEditPool = (pool: KeyPool) => {
      setEditingPoolId(pool.id);
      setPoolForm(pool);
      setKeysInputText(pool.keys.join('\n'));
  };

  const [brandingForm, setBrandingForm] = useState<SystemConfig>(config);
  const handleBrandingSave = (e: React.FormEvent) => {
      e.preventDefault();
      updateConfig(brandingForm);
      alert("System configuration synced.");
  };

  const users = getAllUsers();

  return (
    <Layout title="Admin Console">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h2 className="text-2xl font-bold text-white tracking-tight">Infrastructure Control</h2>
             <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-neutral-800 overflow-x-auto gap-1">
                 <button onClick={() => setActiveTab('ai')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Intelligence</button>
                 <button onClick={() => setActiveTab('vault')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'vault' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Key Vaults</button>
                 <button onClick={() => setActiveTab('db')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'db' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Database</button>
                 <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Users</button>
                 <button onClick={() => setActiveTab('branding')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'branding' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Identity</button>
                 <button onClick={() => setActiveTab('data')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'data' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Maintenance</button>
             </div>
        </div>

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-in fade-in">
        <div className="xl:w-1/3 order-2 xl:order-1">
            <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 bg-black/20">
                    <h3 className="font-semibold text-neutral-300">Deployed Models</h3>
                </div>
                <div className="divide-y divide-neutral-800 max-h-[600px] overflow-y-auto">
                    {personas.map(p => (
                        <div key={p.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/5">
                            <div className="truncate">
                                <div className="text-sm font-bold text-white">{p.name}</div>
                                <div className="text-xs text-neutral-500 font-mono">{p.model}</div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => handleEdit(p)} className="px-3 h-8 text-xs">Edit</Button>
                                <Button variant="danger" onClick={(e) => handleDeleteClick(e, p.id)} className="px-3 h-8 text-xs">
                                    {deleteConfirmId === p.id ? 'Confirm?' : 'Del'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="xl:w-2/3 order-1 xl:order-2">
            <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 p-6">
               <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <Input label="Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                         <Input label="Model ID" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} required />
                    </div>
                    
                    <div>
                        <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">System Prompt (20M Limit)</label>
                        <textarea 
                            className="w-full bg-[#0d0d0d] border border-neutral-800 focus:border-brand-500 text-white rounded-lg px-4 py-3 outline-none min-h-[400px] font-mono text-sm"
                            value={formData.systemPrompt || ''}
                            onChange={e => setFormData({...formData, systemPrompt: e.target.value})}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-neutral-800">
                         <div className="space-y-4">
                             <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">Access & Limits</label>
                             <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-neutral-800">
                                <input type="checkbox" checked={formData.isLocked} onChange={e => setFormData({...formData, isLocked: e.target.checked})} className="w-4 h-4" />
                                <span className="text-sm text-white">Require Access Key</span>
                             </div>
                             {formData.isLocked && <Input label="Access Key" value={formData.accessKey || ''} onChange={e => setFormData({...formData, accessKey: e.target.value})} />}
                             <Input label="Daily Rate Limit" type="number" value={formData.rateLimit || 0} onChange={e => setFormData({...formData, rateLimit: parseInt(e.target.value)})} />
                         </div>
                         <div className="space-y-4">
                             <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">Key Source</label>
                             <div className="mb-4">
                                 <label className="block text-neutral-500 text-[10px] font-bold uppercase mb-1">Link Key Vault</label>
                                 <select 
                                     className="w-full bg-[#0d0d0d] border border-neutral-800 text-white rounded-lg px-3 py-2 text-sm outline-none"
                                     value={formData.keyPoolId || ''}
                                     onChange={e => setFormData({...formData, keyPoolId: e.target.value})}
                                 >
                                     <option value="">No Vault (Use Direct Key)</option>
                                     {keyPools.map(pool => (
                                         <option key={pool.id} value={pool.id}>{pool.name} ({pool.keys.length} keys)</option>
                                     ))}
                                 </select>
                             </div>
                             <Input label="Direct API Key (Backup)" type="password" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} />
                             <Input label="Custom Endpoint" value={formData.baseUrl || ''} onChange={e => setFormData({...formData, baseUrl: e.target.value})} />
                         </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-neutral-800">
                        <Button type="submit" fullWidth>{editingId ? 'Update Persona' : 'Deploy Persona'}</Button>
                        {editingId && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
                    </div>
               </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'vault' && (
          <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in">
              <div className="xl:w-1/3">
                  <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                      <div className="p-4 border-b border-neutral-800 bg-black/20 font-bold text-neutral-300">Stored Vaults</div>
                      <div className="divide-y divide-neutral-800">
                          {keyPools.map(pool => (
                              <div key={pool.id} className="p-4 flex justify-between items-center hover:bg-white/5 cursor-pointer" onClick={() => handleEditPool(pool)}>
                                  <div>
                                      <div className="text-sm font-bold text-white">{pool.name}</div>
                                      <div className="text-[10px] text-neutral-500 font-mono uppercase">{pool.provider} // {pool.keys.length} KEYS</div>
                                  </div>
                                  <Button variant="danger" onClick={(e) => { e.stopPropagation(); deleteKeyPool(pool.id); }} className="px-2 h-7 text-[10px]">Remove</Button>
                              </div>
                          ))}
                          {keyPools.length === 0 && <div className="p-8 text-center text-xs text-neutral-500">No vaults configured.</div>}
                      </div>
                  </div>
              </div>

              <div className="xl:w-2/3">
                  <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 p-6">
                      <h3 className="text-lg font-bold text-white mb-6">{editingPoolId ? 'Modify Vault' : 'Secure New Vault'}</h3>
                      <form onSubmit={handlePoolSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Input label="Vault Name" value={poolForm.name || ''} onChange={e => setPoolForm({...poolForm, name: e.target.value})} required />
                              <div className="mb-4">
                                  <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">Provider</label>
                                  <select className="w-full bg-[#0d0d0d] border border-neutral-800 text-white rounded-lg px-3 py-2.5" value={poolForm.provider} onChange={e => setPoolForm({...poolForm, provider: e.target.value as any})}>
                                      <option value="google">Google Gemini</option>
                                      <option value="openai">OpenAI Compatible</option>
                                      <option value="custom">Custom Proxy</option>
                                  </select>
                              </div>
                          </div>
                          <div>
                              <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">Key List (One per line or comma separated)</label>
                              <textarea 
                                  className="w-full bg-[#0d0d0d] border border-neutral-800 text-neutral-300 p-4 rounded-lg min-h-[200px] font-mono text-sm outline-none focus:border-brand-500"
                                  placeholder="sk-...\nAIza..."
                                  value={keysInputText}
                                  onChange={e => setKeysInputText(e.target.value)}
                                  required
                              />
                          </div>
                          <div className="flex gap-4">
                              <Button type="submit" fullWidth>{editingPoolId ? 'Update Vault' : 'Commit Vault to Supabase'}</Button>
                              {editingPoolId && <Button type="button" variant="ghost" onClick={() => {setEditingPoolId(null); setPoolForm({name:'', provider:'google', keys:[], deadKeys:{}}); setKeysInputText(''); }}>Cancel</Button>}
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'db' && (
          <div className="max-w-2xl bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
              <h3 className="text-xl font-bold text-white mb-6">Database Infrastructure</h3>
              <div className="space-y-6">
                  <Input label="Supabase URL" value={dbUrl} onChange={e => setDbUrl(e.target.value)} />
                  <Input label="Supabase Key" type="password" value={dbKey} onChange={e => setDbKey(e.target.value)} />
                  <Button onClick={handleSaveDb} fullWidth>Apply Global Link</Button>
              </div>
          </div>
      )}

      {/* Other tabs follow the same styling pattern... */}
    </Layout>
  );
};

export default AdminPanel;
