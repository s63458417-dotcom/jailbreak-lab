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
    avatarUrl: '',
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

  const [brandingForm, setBrandingForm] = useState<SystemConfig>(config);
  const handleBrandingSave = (e: React.FormEvent) => {
      e.preventDefault();
      updateConfig(brandingForm);
      alert("System configuration synced to database.");
  };

  const [importText, setImportText] = useState('');
  const handleExport = () => {
      const data = exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jailbreak-lab-backup-${new Date().toISOString()}.json`;
      a.click();
  };

  const handleImport = async () => {
      if (!importText) return;
      if (confirm("This will overwrite global database settings. Continue?")) {
          const success = await importData(importText);
          if (success) {
              alert("Global restore successful.");
              setImportText('');
          }
      }
  };

  const users = getAllUsers();

  return (
    <Layout title="Admin Console">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h2 className="text-2xl font-bold text-white tracking-tight">System Infrastructure</h2>
             <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-neutral-800 overflow-x-auto gap-1">
                 <button onClick={() => setActiveTab('ai')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>AI Models</button>
                 <button onClick={() => setActiveTab('db')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'db' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Database Link</button>
                 <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Operatives</button>
                 <button onClick={() => setActiveTab('branding')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'branding' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Branding</button>
                 <button onClick={() => setActiveTab('data')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'data' ? 'bg-[#2b2b2b] text-white' : 'text-neutral-400 hover:text-white'}`}>Maintenance</button>
             </div>
        </div>

      {activeTab === 'db' && (
          <div className="max-w-2xl bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
              <div className="flex items-center gap-3 mb-6">
                  <div className={`w-3 h-3 rounded-full ${isSupabaseConfigured() ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                  <h3 className="text-xl font-bold text-white">Supabase Cloud Link</h3>
              </div>
              <p className="text-sm text-neutral-400 mb-8">
                  Enter your Supabase credentials to sync your AI personas, configurations, and users across all browsers and devices.
              </p>
              
              <div className="space-y-6">
                  <Input 
                    label="Supabase URL" 
                    value={dbUrl} 
                    onChange={e => setDbUrl(e.target.value)} 
                    placeholder="https://your-project.supabase.co"
                  />
                  <Input 
                    label="Supabase Anon Key" 
                    type="password"
                    value={dbKey} 
                    onChange={e => setDbKey(e.target.value)} 
                    placeholder="your-anon-key"
                  />
                  <Button onClick={handleSaveDb} fullWidth>Link Database Globally</Button>
              </div>
          </div>
      )}

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8 pb-20">
        <div className="xl:w-1/3 order-2 xl:order-1">
            <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 bg-black/20">
                    <h3 className="font-semibold text-neutral-300">Active Personas</h3>
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
                                    {deleteConfirmId === p.id ? 'Sure?' : 'Del'}
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
                        <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">System Directive (Huge Capacity: 20M Chars)</label>
                        <textarea 
                            className="w-full bg-[#0d0d0d] border border-neutral-800 focus:border-brand-500 text-white rounded-lg px-4 py-3 outline-none min-h-[400px] font-mono text-sm"
                            value={formData.systemPrompt || ''}
                            onChange={e => setFormData({...formData, systemPrompt: e.target.value})}
                            required
                            maxLength={20000000}
                        />
                        <div className="text-[10px] text-neutral-600 mt-2 font-mono">
                            CHARACTER COUNT: {(formData.systemPrompt || '').length.toLocaleString()} / 20,000,000
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-neutral-800">
                         <div className="space-y-4">
                             <div className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-neutral-800">
                                <input type="checkbox" checked={formData.isLocked} onChange={e => setFormData({...formData, isLocked: e.target.checked})} className="w-4 h-4" />
                                <span className="text-sm text-white">Require Access Key</span>
                             </div>
                             {formData.isLocked && <Input label="Access Key" value={formData.accessKey || ''} onChange={e => setFormData({...formData, accessKey: e.target.value})} />}
                         </div>
                         <div className="space-y-4">
                             <Input label="Custom Endpoint" value={formData.baseUrl || ''} onChange={e => setFormData({...formData, baseUrl: e.target.value})} />
                             <Input label="Override API Key" type="password" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} />
                         </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-neutral-800">
                        <Button type="submit" fullWidth>{editingId ? 'Push Globally' : 'Deploy Global AI'}</Button>
                        {editingId && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
                    </div>
               </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'data' && (
          <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
              <h3 className="text-xl font-bold text-white mb-6">Master System Maintenance</h3>
              <div className="space-y-8">
                  <div className="p-6 bg-black/20 rounded-lg border border-neutral-800">
                      <h4 className="text-brand-500 font-bold text-xs uppercase mb-4 tracking-widest">Global Export</h4>
                      <Button onClick={handleExport} variant="secondary">Create Cloud Backup</Button>
                  </div>

                  <div className="p-6 bg-black/20 rounded-lg border border-neutral-800">
                      <h4 className="text-red-500 font-bold text-xs uppercase mb-4 tracking-widest">Global Restore (100M Chars)</h4>
                      <textarea 
                          className="w-full bg-[#0d0d0d] border border-neutral-800 text-neutral-300 p-4 rounded-lg min-h-[300px] mb-4 font-mono text-[10px]"
                          placeholder='Paste massive JSON backup here...'
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          maxLength={100000000}
                      />
                      <Button onClick={handleImport} variant="danger" disabled={!importText} fullWidth>Execute Full Restore</Button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'branding' && (
          <div className="max-w-2xl bg-[#1a1a1a] rounded-xl border border-neutral-800 p-8">
               <h3 className="text-xl font-bold text-white mb-8">Global Branding</h3>
               <form onSubmit={handleBrandingSave} className="space-y-6">
                   <Input label="App Name" value={brandingForm.appName} onChange={e => setBrandingForm({...brandingForm, appName: e.target.value})} />
                   <Input label="Creator" value={brandingForm.creatorName} onChange={e => setBrandingForm({...brandingForm, creatorName: e.target.value})} />
                   <Input label="Logo URL" value={brandingForm.logoUrl} onChange={e => setBrandingForm({...brandingForm, logoUrl: e.target.value})} />
                   <Button type="submit" fullWidth>Push Global Branding</Button>
               </form>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="bg-[#1a1a1a] rounded-xl border border-neutral-800 overflow-hidden">
               <table className="w-full text-left text-sm text-neutral-400">
                   <thead className="bg-black/40 text-neutral-300 font-bold uppercase text-xs">
                       <tr>
                           <th className="px-6 py-4">Username</th>
                           <th className="px-6 py-4">Role</th>
                           <th className="px-6 py-4">Action</th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-neutral-800">
                       {users.map(u => (
                           <tr key={u.id} className="hover:bg-white/5">
                               <td className="px-6 py-4 text-white font-medium">{u.username}</td>
                               <td className="px-6 py-4">{u.role}</td>
                               <td className="px-6 py-4"><span className="text-xs font-mono opacity-50"># {u.id.slice(0,8)}</span></td>
                           </tr>
                       ))}
                   </tbody>
               </table>
          </div>
      )}
    </Layout>
  );
};

export default AdminPanel;
