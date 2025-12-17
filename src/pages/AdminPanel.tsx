
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Persona, SystemConfig, ChatSession, KeyPool } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';

const AdminPanel: React.FC = () => {
  const { 
      personas, addPersona, updatePersona, deletePersona, 
      config, updateConfig, allChats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool,
      exportData, importData
  } = useStore();
  const { getAllUsers } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'ai' | 'vault' | 'users' | 'branding' | 'data'>('ai');

  // --- AI Config Logic ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
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

  const [poolForm, setPoolForm] = useState<Partial<KeyPool>>({ name: '', provider: 'custom', keys: [], deadKeys: {} });
  const [poolKeysText, setPoolKeysText] = useState('');
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsAvatarOpen(false);
  };

  const handleEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setFormData({ ...persona });
    setDeleteConfirmId(null);
    setIsAvatarOpen(false);
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

    const payload = { ...formData };
    if (!payload.keyPoolId) delete payload.keyPoolId;
    if (!payload.customApiKey) delete payload.customApiKey;

    if (editingId) {
        updatePersona({ ...payload, id: editingId } as Persona);
    } else {
        addPersona({ ...payload as Persona, id: Date.now().toString() });
    }
    resetForm();
  };

  const handleEditPool = (pool: KeyPool) => {
      setEditingPoolId(pool.id);
      setPoolForm(pool);
      setPoolKeysText(pool.keys.join('\n'));
  };

  const handlePoolSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!poolForm.name) return alert("Pool name required");
      const keys = poolKeysText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
      if (keys.length === 0) return alert("At least one key required");

      const newPool: KeyPool = {
          id: editingPoolId || Date.now().toString(),
          name: poolForm.name!,
          provider: poolForm.provider || 'custom',
          keys: keys,
          deadKeys: poolForm.deadKeys || {}
      };

      if (editingPoolId) updateKeyPool(newPool);
      else addKeyPool(newPool);
      
      setEditingPoolId(null);
      setPoolForm({ name: '', provider: 'custom', keys: [], deadKeys: {} });
      setPoolKeysText('');
  };

  const AVATAR_OPTIONS = [
    { id: 'shield', label: 'Defense', desc: 'Blue Team / Protection', color: 'text-brand-500', bgColor: 'bg-brand-900/20', borderColor: 'border-brand-600', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    { id: 'target', label: 'Offense', desc: 'Red Team / Attack', color: 'text-red-500', bgColor: 'bg-red-900/20', borderColor: 'border-red-600', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> },
    { id: 'code', label: 'Development', desc: 'DevSecOps / Scripts', color: 'text-blue-500', bgColor: 'bg-blue-900/20', borderColor: 'border-blue-600', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
    { id: 'chip', label: 'System', desc: 'Architecture / Hardware', color: 'text-purple-500', bgColor: 'bg-purple-900/20', borderColor: 'border-purple-600', icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg> },
  ];
  const selectedAvatar = AVATAR_OPTIONS.find(a => a.id === formData.avatar) || AVATAR_OPTIONS[0];

  const [brandingForm, setBrandingForm] = useState<SystemConfig>(config);
  const handleBrandingSave = (e: React.FormEvent) => {
      e.preventDefault();
      updateConfig(brandingForm);
      alert("System configuration updated.");
  };
  
  const [importText, setImportText] = useState('');
  const handleExport = () => {
      const data = exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jailbreak-lab-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };
  const handleImport = async () => {
      if (!importText) return;
      if (confirm("WARNING: This will overwrite global settings. Continue?")) {
          const success = await importData(importText);
          if (success) {
              alert("System restored globally.");
              setImportText('');
          } else {
              alert("Import failed.");
          }
      }
  };

  const users = getAllUsers();
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  
  const analyzedUserLogs = useMemo(() => {
    if (!inspectUserId) return [];
    const logs: any[] = [];
    Object.entries(allChats).forEach(([key, val]) => {
        // Fixed: Cast val (type unknown from Object.entries) to ChatSession to allow property access
        const session = val as ChatSession;
        if (key.startsWith(inspectUserId + '_')) {
            const personaName = personas.find(p => p.id === session.personaId)?.name || 'Unknown';
            session.messages.forEach(msg => logs.push({ personaName, ...msg }));
        }
    });
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [inspectUserId, allChats, personas]);

  return (
    <Layout title="System Configuration">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h2 className="text-2xl font-bold text-white tracking-tight">Admin Console (Global)</h2>
             <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800 overflow-x-auto">
                 <button onClick={() => setActiveTab('ai')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}>Intelligence</button>
                 <button onClick={() => setActiveTab('vault')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'vault' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}>Vaults</button>
                 <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}>Users</button>
                 <button onClick={() => setActiveTab('branding')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'branding' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}>Identity</button>
                 <button onClick={() => setActiveTab('data')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'data' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}>Maintenance</button>
             </div>
        </div>

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8 pb-20">
        <div className="xl:w-1/3 order-2 xl:order-1">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                    <h3 className="font-semibold text-neutral-300">Global Personas</h3>
                    <span className="text-xs bg-neutral-800 text-neutral-500 px-2 py-1 rounded-full">{personas.length} Active</span>
                </div>
                <div className="divide-y divide-neutral-800 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {personas.map(p => (
                        <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-800/50">
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-white text-sm flex items-center gap-2">
                                    <span className="truncate">{p.name}</span>
                                    {p.isLocked && <span className="text-[10px] bg-red-900/20 text-red-500 px-1 rounded border border-red-900/30 uppercase font-bold">LOCKED</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={() => handleEdit(p)} className="px-3 h-8 text-xs">Edit</Button>
                                <Button type="button" variant="danger" onClick={(e) => handleDeleteClick(e, p.id)} className="px-3 h-8 text-xs">
                                    {deleteConfirmId === p.id ? 'Sure?' : 'Del'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="xl:w-2/3 order-1 xl:order-2">
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-6">
               <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <Input label="Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                         <Input label="Model" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} required />
                    </div>
                    <Input label="Description" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                    
                    <div className="w-full">
                        <label className="block text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">System Directive (Huge Capacity - 20M Chars)</label>
                        <textarea 
                            className="w-full bg-neutral-950 border border-neutral-800 focus:border-brand-600 text-white rounded-md px-4 py-3 outline-none min-h-[800px] font-mono text-sm leading-relaxed"
                            value={formData.systemPrompt || ''}
                            onChange={e => setFormData({...formData, systemPrompt: e.target.value})}
                            required
                            maxLength={20000000}
                        />
                        <p className="text-[10px] text-neutral-500 mt-2 uppercase font-mono tracking-widest">Buffer Size: 20MB / Character Count: {(formData.systemPrompt || '').length.toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-neutral-800">
                         <div className="space-y-4">
                             <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">Security</label>
                             <div className="flex items-center gap-3 p-3 bg-neutral-950 rounded-lg border border-neutral-800">
                                <input type="checkbox" checked={formData.isLocked} onChange={e => setFormData({...formData, isLocked: e.target.checked})} className="w-5 h-5 rounded" />
                                <span className="text-sm">Password Protect this AI</span>
                             </div>
                             {formData.isLocked && <Input label="Passkey" value={formData.accessKey || ''} onChange={e => setFormData({...formData, accessKey: e.target.value})} />}
                         </div>
                         <div className="space-y-4">
                             <label className="block text-neutral-400 text-xs font-bold uppercase mb-2">Backend</label>
                             <Input label="Base URL (Optional)" value={formData.baseUrl || ''} onChange={e => setFormData({...formData, baseUrl: e.target.value})} />
                             <Input label="Direct API Key (Optional)" type="password" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} />
                         </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-neutral-800">
                        <Button type="submit" fullWidth>{editingId ? 'Push Update Globally' : 'Deploy Global AI'}</Button>
                        {editingId && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
                    </div>
               </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'data' && (
          <div className="max-w-4xl bg-neutral-900 rounded-lg border border-neutral-800 p-8">
              <h3 className="text-xl font-bold text-white mb-6">Global Maintenance</h3>
              <div className="grid grid-cols-1 gap-8">
                  <div className="p-6 bg-neutral-950 rounded-xl border border-neutral-800">
                      <h4 className="text-brand-500 font-bold uppercase text-xs mb-4">Export Global Config</h4>
                      <Button onClick={handleExport} variant="secondary">Generate Cloud Snapshot</Button>
                  </div>

                  <div className="p-6 bg-neutral-950 rounded-xl border border-neutral-800">
                      <h4 className="text-red-500 font-bold uppercase text-xs mb-4">Hard Restore (80x Capacity - 100M Chars)</h4>
                      <textarea 
                          className="w-full bg-[#0a0a0a] border border-neutral-800 text-neutral-300 p-4 rounded-lg min-h-[800px] mb-4 font-mono text-xs"
                          placeholder='Paste massive JSON backup here...'
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          maxLength={100000000}
                      />
                      <p className="text-[10px] text-neutral-600 mb-4 font-mono">Input Size: {(importText.length / 1024 / 1024).toFixed(2)} MB / Max: 100MB</p>
                      <Button onClick={handleImport} variant="danger" disabled={!importText}>Execute Global Overwrite</Button>
                  </div>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default AdminPanel;
