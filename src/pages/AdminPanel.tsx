import React, { useState, useRef, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Persona, SystemConfig, ChatMessage } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';

const AdminPanel: React.FC = () => {
  const { personas, addPersona, updatePersona, deletePersona, config, updateConfig, getAllChats } = useStore();
  const { getAllUsers } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'ai' | 'users' | 'branding'>('ai');

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
    model: 'gemini-2.5-flash',
    baseUrl: '',
    customApiKey: '',
    avatar: 'shield',
    avatarUrl: '',
    themeColor: '',
    rateLimit: 0
  };

  const [formData, setFormData] = useState<Partial<Persona>>(defaultForm);

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
    if (editingId) {
        updatePersona({ ...formData, id: editingId } as Persona);
    } else {
        addPersona({ ...formData as Persona, id: Date.now().toString() });
    }
    resetForm();
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

  const users = getAllUsers();
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  
  // Calculate Stats
  const getUserStats = (userId: string) => {
      let msgCount = 0;
      let activeChats = 0;
      let lastActive = 0;

      const allChats = getAllChats();

      Object.entries(allChats).forEach(([key, val]) => {
          const messages = val as ChatMessage[];
          if (key.startsWith(userId + '_')) {
              activeChats++;
              msgCount += messages.length;
              const lastMsg = messages[messages.length - 1];
              if (lastMsg && lastMsg.timestamp > lastActive) {
                  lastActive = lastMsg.timestamp;
              }
          }
      });
      return { msgCount, activeChats, lastActive };
  };

  // Memoize Analysis
  const analyzedUserLogs = useMemo(() => {
    if (!inspectUserId) return [];
    
    const logs: Array<{
        personaName: string;
        role: 'user' | 'model';
        text: string;
        timestamp: number;
    }> = [];

    const allChats = getAllChats();

    Object.entries(allChats).forEach(([key, val]) => {
        const messages = val as ChatMessage[];
        if (key.startsWith(inspectUserId + '_')) {
            const personaId = key.split('_')[1];
            const personaName = personas.find(p => p.id === personaId)?.name || 'Unknown Agent';
            
            messages.forEach(msg => {
                logs.push({
                    personaName,
                    role: msg.role,
                    text: msg.text,
                    timestamp: msg.timestamp
                });
            });
        }
    });

    return logs.sort((a, b) => b.timestamp - a.timestamp);

  }, [inspectUserId, getAllChats, personas]);


  return (
    <Layout title="System Configuration">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
             <h2 className="text-2xl font-bold text-white tracking-tight">Admin Console</h2>
             <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                 <button onClick={() => setActiveTab('ai')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'ai' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}>Intelligence</button>
                 <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'users' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}>Operatives</button>
                 <button onClick={() => setActiveTab('branding')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'branding' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}>Identity</button>
             </div>
        </div>

      {activeTab === 'ai' && (
      <div className="flex flex-col xl:flex-row gap-8 pb-20 animate-in fade-in">
        <div className="xl:w-1/3 order-2 xl:order-1">
            <div className="bg-neutral-900 rounded-lg shadow-sm border border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                    <h3 className="font-semibold text-neutral-300">Deployed Models</h3>
                    <span className="text-xs bg-neutral-800 text-neutral-500 px-2 py-1 rounded-full">{personas.length} Active</span>
                </div>
                <div className="divide-y divide-neutral-800 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {personas.map(p => (
                        <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-800/50 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-white text-sm flex items-center gap-2">
                                    <span className="truncate">{p.name}</span>
                                    {p.isLocked && <span className="flex-shrink-0 text-[10px] bg-red-900/20 text-red-500 px-1.5 py-0.5 rounded border border-red-900/30 uppercase font-bold">Lock</span>}
                                    {p.rateLimit ? <span className="flex-shrink-0 text-[10px] bg-orange-900/20 text-orange-500 px-1.5 py-0.5 rounded border border-orange-900/30 font-bold">{p.rateLimit}/d</span> : null}
                                </div>
                                <div className="text-xs text-neutral-500 mt-1 font-mono truncate">{p.model}</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <Button type="button" variant="secondary" onClick={() => handleEdit(p)} className="px-3 py-1 text-xs h-8">Config</Button>
                                <button 
                                    type="button" 
                                    onClick={(e) => handleDeleteClick(e, p.id)} 
                                    className={`px-3 py-1 text-xs h-8 rounded-md font-bold transition-all duration-200 active:scale-95 cursor-pointer border ${
                                        deleteConfirmId === p.id 
                                        ? 'bg-red-600 text-white border-red-500 hover:bg-red-700 w-24 shadow-red-900/20 shadow-lg' 
                                        : 'bg-red-900/20 text-red-400 border-red-900/50 hover:bg-red-900/40 hover:text-red-300'
                                    }`}
                                >
                                    {deleteConfirmId === p.id ? 'Confirm?' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {personas.length === 0 && <div className="p-8 text-center text-sm text-neutral-600">No active models deployed.</div>}
                </div>
            </div>
        </div>

        <div className="xl:w-2/3 order-1 xl:order-2">
            <div className="bg-neutral-900 rounded-lg shadow-sm border border-neutral-800 p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-800">
                     <h3 className="text-lg font-semibold text-white">
                        {editingId ? 'Modify Configuration' : 'Deploy New Model'}
                    </h3>
                    {editingId && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-brand-900/30 text-brand-400 px-2 py-1 rounded font-mono">ID: {editingId}</span>
                            <button onClick={resetForm} className="text-neutral-500 hover:text-white" title="Cancel Edit">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}
                </div>
               
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                         <Input 
                             label="Designation (Name)" 
                             value={formData.name || ''} 
                             onChange={e => setFormData({...formData, name: e.target.value})} 
                             required 
                             placeholder="e.g. NETSEC_BOT_01"
                         />
                         
                         <div className="space-y-3">
                             <div className="relative" ref={dropdownRef}>
                                <label className="block text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Preset Icon</label>
                                <button
                                    type="button"
                                    onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-900 border text-white rounded-md transition-all outline-none focus:ring-2 focus:ring-brand-900/20 ${isAvatarOpen ? 'border-brand-600 ring-2 ring-brand-900/20' : 'border-neutral-800 hover:border-neutral-600'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-md ${selectedAvatar.bgColor}`}>
                                            <selectedAvatar.icon className={`w-5 h-5 ${selectedAvatar.color}`} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-medium">{selectedAvatar.label}</div>
                                        </div>
                                    </div>
                                    <svg className={`w-5 h-5 text-neutral-500 transition-transform ${isAvatarOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isAvatarOpen && (
                                    <div className="absolute z-10 w-full mt-1.5 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                        <div className="p-1.5 grid grid-cols-1 gap-1">
                                            {AVATAR_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, avatar: opt.id });
                                                        setIsAvatarOpen(false);
                                                    }}
                                                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left group ${formData.avatar === opt.id ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`}
                                                >
                                                    <div className={`p-1.5 rounded-md ${opt.bgColor} border ${formData.avatar === opt.id ? opt.borderColor : 'border-transparent group-hover:border-neutral-700'}`}>
                                                        <opt.icon className={`w-5 h-5 ${opt.color}`} />
                                                    </div>
                                                    <div>
                                                        <div className={`text-sm font-medium ${formData.avatar === opt.id ? 'text-white' : 'text-neutral-300'}`}>{opt.label}</div>
                                                        <div className="text-[10px] text-neutral-500 uppercase tracking-wide">{opt.desc}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                             </div>
                             
                             <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                                <Input 
                                    label="Custom Icon URL (Overrides Preset)"
                                    value={formData.avatarUrl || ''} 
                                    onChange={e => setFormData({...formData, avatarUrl: e.target.value})} 
                                    placeholder="https://..."
                                    className="mb-0"
                                />
                                <div className="mb-0">
                                     <label className="block text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1.5">Theme Color</label>
                                     <div className="flex gap-2">
                                        <input 
                                            type="color" 
                                            className="w-10 h-10 p-1 rounded bg-neutral-900 border border-neutral-800 cursor-pointer"
                                            value={formData.themeColor || '#ef4444'} 
                                            onChange={e => setFormData({...formData, themeColor: e.target.value})}
                                        />
                                        {formData.themeColor && (
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, themeColor: ''})}
                                                className="px-2 py-1 bg-neutral-800 text-xs text-neutral-400 rounded hover:text-white"
                                            >
                                                Reset
                                            </button>
                                        )}
                                     </div>
                                </div>
                             </div>
                         </div>

                    </div>
                    <Input 
                        label="Mission Description" 
                        value={formData.description || ''} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        required 
                        placeholder="Operational scope..."
                    />
                    <div className="w-full">
                        <label className="block text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1.5">System Directives (Prompt)</label>
                        <textarea 
                            className="w-full bg-neutral-900 border border-neutral-800 focus:border-brand-600 focus:ring-1 focus:ring-brand-900/50 text-white rounded-md px-3.5 py-2.5 outline-none transition-all shadow-sm min-h-[150px] font-mono text-sm leading-relaxed"
                            value={formData.systemPrompt || ''}
                            onChange={e => setFormData({...formData, systemPrompt: e.target.value})}
                            required
                            placeholder="You are an expert in network security. Your goal is to..."
                        />
                         <p className="text-xs text-neutral-500 mt-1">Defines AI behavior and constraints.</p>
                    </div>
                    <div className="p-5 bg-neutral-950/50 rounded-lg border border-neutral-800 grid grid-cols-1 gap-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2">Technical Configuration</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                label="Model ID" 
                                value={formData.model || ''} 
                                onChange={e => setFormData({...formData, model: e.target.value})} 
                                required 
                                placeholder="gemini-2.5-flash"
                                className="mb-0"
                            />
                            <Input 
                                label="Base URL (Optional)" 
                                value={formData.baseUrl || ''} 
                                onChange={e => setFormData({...formData, baseUrl: e.target.value})} 
                                placeholder="https://api.custom.endpoint/v1"
                                className="mb-0"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                label="Custom API Key (Optional)" 
                                type="password" 
                                value={formData.customApiKey || ''} 
                                onChange={e => setFormData({...formData, customApiKey: e.target.value})} 
                                placeholder="Overwrite global key for this agent"
                                className="mb-0"
                            />
                            <Input 
                                label="Rate Limit (Msgs/Day)" 
                                type="number" 
                                value={formData.rateLimit || ''} 
                                onChange={e => setFormData({...formData, rateLimit: parseInt(e.target.value) || 0})} 
                                placeholder="0 = Unlimited"
                                min="0"
                                className="mb-0"
                            />
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 p-4 border border-neutral-800 rounded-lg bg-neutral-950/30">
                        <input 
                            type="checkbox" 
                            id="isLocked"
                            checked={formData.isLocked || false} 
                            onChange={e => setFormData({...formData, isLocked: e.target.checked})}
                            className="w-5 h-5 text-brand-600 border-neutral-700 bg-neutral-900 rounded focus:ring-brand-500 cursor-pointer"
                        />
                        <label htmlFor="isLocked" className="text-sm font-medium text-neutral-300 select-none cursor-pointer">
                            Require Access Authorization (Lock)
                        </label>
                    </div>
                    {formData.isLocked && (
                        <div className="pl-4 border-l-2 border-brand-900 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                             <Input 
                                label="Access Key" 
                                value={formData.accessKey || ''} 
                                onChange={e => setFormData({...formData, accessKey: e.target.value})} 
                                required={formData.isLocked}
                                placeholder="Set passcode..."
                            />
                            <Input 
                                label="Access Duration (Hours)" 
                                type="number"
                                value={formData.accessDuration || ''} 
                                onChange={e => setFormData({...formData, accessDuration: parseFloat(e.target.value)})} 
                                placeholder="0 = Permanent"
                                min="0"
                            />
                        </div>
                    )}
                    <div className="flex space-x-3 pt-6 border-t border-neutral-800">
                        <Button type="submit" className="w-full md:w-auto">
                            {editingId ? 'Commit Changes' : 'Initialize Agent'}
                        </Button>
                        {editingId && (
                            <Button type="button" variant="ghost" onClick={resetForm} className="w-full md:w-auto">
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
      </div>
      )}

      {activeTab === 'users' && !inspectUserId && (
        <div className="bg-neutral-900 rounded-lg shadow-sm border border-neutral-800 overflow-hidden animate-in fade-in">
             <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                    <h3 className="font-semibold text-neutral-300">Operative Roster</h3>
                    <div className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">Total: {users.length}</div>
             </div>
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-neutral-400">
                     <thead className="bg-neutral-800/50 text-neutral-200 uppercase font-bold text-xs">
                         <tr>
                             <th className="px-6 py-3">Identity</th>
                             <th className="px-6 py-3">Role</th>
                             <th className="px-6 py-3">Active Uplinks</th>
                             <th className="px-6 py-3">Traffic Vol</th>
                             <th className="px-6 py-3">Last Activity</th>
                             <th className="px-6 py-3 text-right">Actions</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-neutral-800">
                         {users.length === 0 ? (
                             <tr><td colSpan={6} className="px-6 py-8 text-center text-neutral-600">No data available.</td></tr>
                         ) : users.map(u => {
                             const stats = getUserStats(u.id);
                             return (
                                 <tr key={u.id} className="hover:bg-neutral-800/30 transition-colors">
                                     <td className="px-6 py-4 font-medium text-white">{u.username} <div className="text-xs text-neutral-600 font-mono">ID: {u.id.substring(0,8)}...</div></td>
                                     <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'ADMIN' ? 'bg-red-900/20 text-red-500' : 'bg-blue-900/20 text-blue-400'}`}>{u.role}</span></td>
                                     <td className="px-6 py-4">{stats.activeChats}</td>
                                     <td className="px-6 py-4">{stats.msgCount}</td>
                                     <td className="px-6 py-4 font-mono text-xs">{stats.lastActive ? new Date(stats.lastActive).toLocaleString() : 'N/A'}</td>
                                     <td className="px-6 py-4 text-right">
                                         <Button variant="ghost" onClick={() => setInspectUserId(u.id)} className="h-8 py-0 text-xs border border-neutral-700">
                                            Deep Analysis
                                         </Button>
                                     </td>
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </div>
        </div>
      )}

      {activeTab === 'users' && inspectUserId && (
          <div className="animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-4 mb-6">
                  <Button variant="ghost" onClick={() => setInspectUserId(null)} className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                      Back to Roster
                  </Button>
                  <h3 className="text-xl font-bold text-white">
                      Target Analysis: <span className="text-brand-500">{users.find(u => u.id === inspectUserId)?.username}</span>
                  </h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-800 h-fit">
                       <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Activity Summary</h4>
                       <div className="space-y-4">
                            <div className="flex justify-between border-b border-neutral-800 pb-2">
                                <span className="text-neutral-500 text-sm">Total Interactions</span>
                                <span className="text-white font-mono">{analyzedUserLogs.length}</span>
                            </div>
                            <div className="flex justify-between border-b border-neutral-800 pb-2">
                                <span className="text-neutral-500 text-sm">Last Interaction</span>
                                <span className="text-white font-mono text-xs">{analyzedUserLogs[0] ? new Date(analyzedUserLogs[0].timestamp).toLocaleString() : 'N/A'}</span>
                            </div>
                       </div>
                   </div>
                   
                   <div className="lg:col-span-2 bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden flex flex-col max-h-[800px]">
                       <div className="p-4 border-b border-neutral-800 bg-neutral-950/50">
                           <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Communication Intercept Log</h4>
                       </div>
                       <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                           {analyzedUserLogs.length === 0 ? (
                               <div className="text-center text-neutral-600 py-10 italic">No communication data found.</div>
                           ) : analyzedUserLogs.map((log, idx) => (
                               <div key={idx} className="flex gap-4">
                                   <div className="flex-shrink-0 w-24 text-[10px] text-neutral-600 font-mono text-right pt-1">
                                       {new Date(log.timestamp).toLocaleTimeString()}
                                       <br/>
                                       {new Date(log.timestamp).toLocaleDateString()}
                                   </div>
                                   <div className="flex-1">
                                       <div className="flex items-center gap-2 mb-1">
                                           <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${log.role === 'user' ? 'bg-neutral-800 text-neutral-300' : 'bg-brand-900/20 text-brand-500'}`}>
                                               {log.role === 'user' ? 'OPERATIVE' : 'SYSTEM'}
                                           </span>
                                           <span className="text-[10px] text-neutral-500 bg-neutral-950 px-1 rounded border border-neutral-800">
                                               Via: {log.personaName}
                                           </span>
                                       </div>
                                       <div className={`text-sm p-3 rounded border ${log.role === 'user' ? 'bg-neutral-950/50 border-neutral-800 text-neutral-300' : 'bg-brand-900/5 border-brand-900/20 text-neutral-400'}`}>
                                           {log.text}
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
              </div>
          </div>
      )}

      {activeTab === 'branding' && (
        <div className="max-w-2xl bg-neutral-900 rounded-lg shadow-sm border border-neutral-800 p-6 animate-in fade-in">
             <h3 className="text-lg font-semibold text-white mb-6">Visual Identity Configuration</h3>
             <form onSubmit={handleBrandingSave} className="space-y-6">
                 <Input 
                    label="Platform Name"
                    value={brandingForm.appName}
                    onChange={e => setBrandingForm({...brandingForm, appName: e.target.value})}
                    placeholder="Jailbreak Lab"
                 />
                 <Input 
                    label="Creator Signature"
                    value={brandingForm.creatorName}
                    onChange={e => setBrandingForm({...brandingForm, creatorName: e.target.value})}
                    placeholder="Created by BT4"
                 />
                 <Input 
                    label="Logo URL"
                    value={brandingForm.logoUrl}
                    onChange={e => setBrandingForm({...brandingForm, logoUrl: e.target.value})}
                    placeholder="https://example.com/logo.png"
                 />
                 
                 <div className="p-4 bg-neutral-950 rounded border border-neutral-800 mt-4">
                     <label className="block text-neutral-400 text-xs font-bold uppercase tracking-wider mb-3">Live Preview</label>
                     <div className="flex items-center gap-3">
                         {brandingForm.logoUrl ? (
                             <img src={brandingForm.logoUrl} alt="Preview" className="w-10 h-10 rounded shadow object-cover" />
                         ) : (
                             <div className="w-10 h-10 bg-brand-600 rounded flex items-center justify-center text-white font-bold text-xl">
                                 {brandingForm.appName.charAt(0) || 'J'}
                             </div>
                         )}
                         <div>
                             <div className="font-bold text-white">{brandingForm.appName || 'App Name'}</div>
                             <div className="text-xs text-brand-500 uppercase tracking-widest">{brandingForm.creatorName || 'Creator'}</div>
                         </div>
                     </div>
                 </div>

                 <div className="pt-4">
                     <Button type="submit">Update Identity</Button>
                 </div>
             </form>
        </div>
      )}

    </Layout>
  );
};

export default AdminPanel;