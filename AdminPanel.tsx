
import React, { useState, useMemo } from 'react';
import Layout from './Layout';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';
import { Persona, SystemConfig, KeyPool, ChatSession } from './types';
import { initSupabase } from './supabaseService';

const AdminPanel: React.FC = () => {
  const { 
    personas, addPersona, updatePersona, deletePersona, 
    config, updateConfig, allChats, 
    keyPools, addKeyPool, updateKeyPool, deleteKeyPool,
    exportData, importData 
  } = useStore();
  const { getAllUsers } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'ai' | 'vault' | 'users' | 'branding' | 'cloud' | 'data'>('ai');

  const [dbUrl, setDbUrl] = useState(localStorage.getItem('supabase_url') || '');
  const [dbKey, setDbKey] = useState(localStorage.getItem('supabase_key') || '');
  const handleCloudSave = () => {
    if (!dbUrl || !dbKey) return alert("Credentials required");
    initSupabase(dbUrl, dbKey);
    alert("Cloud Link Established. System Rebooting...");
    window.location.reload();
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Persona>>({ name: '', description: '', systemPrompt: '', model: '', baseUrl: '', customApiKey: '', avatar: 'shield' });
  
  const handlePersonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) await updatePersona({ ...formData, id: editingId } as Persona);
    else await addPersona({ ...formData, id: Date.now().toString() } as Persona);
    setEditingId(null);
    setFormData({ name: '', description: '', systemPrompt: '', model: '', baseUrl: '', customApiKey: '', avatar: 'shield' });
  };

  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [poolForm, setPoolForm] = useState<Partial<KeyPool>>({ name: '', provider: 'standard', keys: [] });
  const [poolKeysText, setPoolKeysText] = useState('');
  
  const handlePoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const keys = poolKeysText.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
    const payload = { id: editingPoolId || Date.now().toString(), name: poolForm.name || 'New Vault', provider: 'standard' as const, keys, deadKeys: poolForm.deadKeys || {} };
    if (editingPoolId) await updateKeyPool(payload);
    else await addKeyPool(payload);
    setEditingPoolId(null);
    setPoolForm({ name: '', provider: 'standard', keys: [] });
    setPoolKeysText('');
  };

  const users = getAllUsers();
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);
  const analyzedLogs = useMemo(() => {
    if (!inspectUserId) return [];
    const logs: any[] = [];
    Object.entries(allChats).forEach(([key, session]) => {
      const chatSession = session as ChatSession;
      if (key.startsWith(inspectUserId + '_')) {
        const personaName = personas.find(p => p.id === key.split('_')[1])?.name || 'Unknown';
        chatSession.messages.forEach(m => logs.push({ personaName, ...m }));
      }
    });
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [inspectUserId, allChats, personas]);

  return (
    <Layout title="Control Center">
      <div className="mb-8 flex overflow-x-auto bg-[#1a1a1a] p-1.5 rounded-2xl border border-neutral-800 gap-1 no-scrollbar text-white">
        {['ai', 'vault', 'users', 'branding', 'cloud', 'data'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab as any); setInspectUserId(null); }} className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-brand-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>
            {tab === 'ai' ? 'Uplinks' : tab === 'cloud' ? 'Cloud' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'ai' && (
        <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in">
          <div className="xl:w-1/3">
            <div className="bg-[#171717] rounded-2xl border border-[#262626] overflow-hidden">
               <div className="p-4 border-b border-[#262626] font-bold text-neutral-400 text-[10px] tracking-widest uppercase bg-black/20">Active Intelligence</div>
               <div className="divide-y divide-[#262626]">
                  {personas.map(p => (
                    <div key={p.id} className="p-4 flex flex-col gap-3 hover:bg-white/5">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm font-bold text-white">{p.name}</div>
                                <div className="text-[10px] text-neutral-500 font-mono uppercase truncate w-32">{p.model || 'Static Payload'}</div>
                            </div>
                            <button onClick={() => deletePersona(p.id)} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold">Terminate</button>
                        </div>
                        <button onClick={() => { setEditingId(p.id); setFormData(p); }} className="w-full bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-1.5 rounded-lg border border-white/5 uppercase">Edit Parameters</button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
          <div className="xl:w-2/3 bg-[#171717] rounded-2xl border border-[#262626] p-6 shadow-2xl">
            <form onSubmit={handlePersonaSubmit} className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Display Name</label>
                    <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Model (Leave blank if URL has it)</label>
                    <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="e.g. gemini-2.5-flash-lite" />
                  </div>
               </div>
               <div>
                  <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Endpoint URL (Full Link Supported)</label>
                  <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={formData.baseUrl || ''} onChange={e => setFormData({...formData, baseUrl: e.target.value})} placeholder="https://..." required />
               </div>
               <div>
                  <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">System Directives</label>
                  <textarea className="w-full bg-[#0d0d0d] border border-[#262626] text-neutral-200 p-5 rounded-2xl min-h-[150px] font-mono text-xs focus:border-brand-600 outline-none" value={formData.systemPrompt || ''} onChange={e => setFormData({...formData, systemPrompt: e.target.value})} required />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Credential Source</label>
                    <select className="w-full bg-[#0d0d0d] border border-[#262626] text-white rounded-xl p-3 text-xs font-bold outline-none" value={formData.keyPoolId || ''} onChange={e => setFormData({...formData, keyPoolId: e.target.value})}>
                       <option value="">Direct Credential</option>
                       {keyPools.map(pool => <option key={pool.id} value={pool.id}>{pool.name} (Vault)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Direct API Key</label>
                    <input type="password" className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={formData.customApiKey || ''} onChange={e => setFormData({...formData, customApiKey: e.target.value})} />
                  </div>
               </div>
               <button type="submit" className="w-full h-14 bg-brand-600 hover:bg-brand-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl shadow-lg transition-all active:scale-95">
                  {editingId ? 'Save Configuration' : 'Deploy Uplink'}
               </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'vault' && (
        <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in">
           <div className="xl:w-1/3 bg-[#171717] rounded-2xl border border-[#262626] overflow-hidden h-fit">
              <div className="p-4 border-b border-[#262626] font-bold text-neutral-400 text-[10px] tracking-widest uppercase bg-black/20">Secure Vaults</div>
              <div className="divide-y divide-[#262626]">
                 {keyPools.map(p => (
                   <div key={p.id} className="p-4 hover:bg-white/5 cursor-pointer" onClick={() => { setEditingPoolId(p.id); setPoolForm(p); setPoolKeysText(p.keys.join('\n')); }}>
                      <div className="text-sm font-bold text-white">{p.name}</div>
                      <div className="text-[10px] text-neutral-500">{p.keys.length} Keys Loaded</div>
                   </div>
                 ))}
              </div>
           </div>
           <div className="xl:w-2/3 bg-[#171717] p-8 rounded-2xl border border-[#262626]">
              <form onSubmit={handlePoolSubmit} className="space-y-6">
                 <div>
                    <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Vault Name</label>
                    <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={poolForm.name || ''} onChange={e => setPoolForm({...poolForm, name: e.target.value})} required />
                 </div>
                 <div>
                    <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Keys (One per line)</label>
                    <textarea className="w-full bg-[#0d0d0d] border border-[#262626] text-neutral-300 p-5 rounded-2xl min-h-[250px] font-mono text-xs outline-none" value={poolKeysText} onChange={e => setPoolKeysText(e.target.value)} required />
                 </div>
                 <button type="submit" className="w-full h-14 bg-brand-600 hover:bg-brand-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl transition-all shadow-lg active:scale-95">Update Vault Cache</button>
              </form>
           </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-[#171717] rounded-2xl border border-[#262626] overflow-hidden animate-in fade-in">
           <table className="w-full text-left text-sm text-neutral-400">
              <thead className="bg-[#0d0d0d] text-neutral-200 uppercase font-bold text-[10px] tracking-widest">
                 <tr>
                    <th className="px-6 py-4">Operator</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                 {users.map(u => (
                   <tr key={u.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 font-bold text-white">{u.username}</td>
                      <td className="px-6 py-4 font-mono text-xs">{u.role}</td>
                      <td className="px-6 py-4 text-right">
                         <button onClick={() => setInspectUserId(u.id)} className="text-brand-500 hover:text-brand-400 font-bold text-[10px] uppercase tracking-widest">View Transmission Logs</button>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
           {inspectUserId && (
              <div className="p-8 border-t border-[#262626] bg-black/10">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Transmission Intercept: <span className="text-brand-500">{users.find(u => u.id === inspectUserId)?.username}</span></h3>
                    <button onClick={() => setInspectUserId(null)} className="text-neutral-500 hover:text-white text-xs font-bold uppercase">Close Logs</button>
                 </div>
                 <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar font-mono text-[11px]">
                    {analyzedLogs.length === 0 ? <div className="text-neutral-700 italic">No communication packets found.</div> : analyzedLogs.map((log, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${log.role === 'user' ? 'bg-[#0d0d0d] border-[#262626] text-neutral-500' : 'bg-brand-950/20 border-brand-900/30 text-brand-400'}`}>
                         <div className="flex justify-between mb-1 opacity-50 uppercase font-bold text-[9px]">
                            <span>[{log.personaName}] {new Date(log.timestamp).toLocaleString()}</span>
                            <span>{log.role}</span>
                         </div>
                         <div className="whitespace-pre-wrap">{log.text}</div>
                      </div>
                    ))}
                 </div>
              </div>
           )}
        </div>
      )}

      {activeTab === 'branding' && (
        <div className="max-w-xl bg-[#171717] p-8 rounded-2xl border border-[#262626] animate-in fade-in">
           <form onSubmit={(e) => { e.preventDefault(); updateConfig(config); alert("Identity Updated."); }} className="space-y-6">
              <div>
                <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">App Name</label>
                <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={config.appName} onChange={e => updateConfig({...config, appName: e.target.value})} />
              </div>
              <div>
                <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Signature</label>
                <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={config.creatorName} onChange={e => updateConfig({...config, creatorName: e.target.value})} />
              </div>
              <button type="submit" className="w-full h-14 bg-brand-600 hover:bg-brand-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl shadow-lg transition-all active:scale-95">Save Branding</button>
           </form>
        </div>
      )}

      {activeTab === 'cloud' && (
        <div className="max-w-xl bg-[#171717] p-10 rounded-2xl border border-[#262626] animate-in fade-in shadow-2xl">
           <h3 className="text-2xl font-bold text-white mb-8 tracking-tight">Cloud Link Infrastructure</h3>
           <div className="space-y-6">
              <div>
                <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Supabase Project URL</label>
                <input className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={dbUrl} onChange={e => setDbUrl(e.target.value)} />
              </div>
              <div>
                <label className="block text-neutral-400 text-[10px] font-bold uppercase mb-2">Service Key</label>
                <input type="password" className="w-full bg-[#0d0d0d] border border-[#262626] text-white p-3 rounded-xl text-sm outline-none" value={dbKey} onChange={e => setDbKey(e.target.value)} />
              </div>
              <button onClick={handleCloudSave} className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-sm rounded-2xl transition-all shadow-lg active:scale-95">Synchronize Now</button>
           </div>
        </div>
      )}

      {activeTab === 'data' && (
          <div className="max-w-xl bg-[#171717] p-10 rounded-2xl border border-[#262626] animate-in fade-in shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Data Snapshot Protocol</h3>
              <p className="text-neutral-500 text-sm mb-8">Backup and Restore your entire system configuration.</p>
              <div className="space-y-4">
                  <button onClick={() => { 
                    const d = exportData(); 
                    const b = new Blob([d], {type:'application/json'}); 
                    const u = URL.createObjectURL(b); 
                    const l = document.createElement('a'); 
                    l.href=u; 
                    l.download='pentest_system_snapshot.json'; 
                    l.click(); 
                  }} className="w-full h-14 bg-[#262626] hover:bg-[#333] text-white font-bold uppercase tracking-widest text-xs rounded-2xl transition-all border border-[#404040]">Download Snapshot (.json)</button>
                  
                  <label className="block w-full h-14 flex items-center justify-center bg-brand-600/10 hover:bg-brand-600/20 border border-brand-600/30 rounded-2xl text-center cursor-pointer text-xs font-bold uppercase text-brand-400 transition-all">
                      Restore from Snapshot
                      <input type="file" onChange={async (e) => { 
                        const f = e.target.files?.[0]; 
                        if(!f) return; 
                        const r = new FileReader(); 
                        r.onload = async (ev) => { 
                          const s = await importData(ev.target?.result as string); 
                          if(s) { alert("Core Data Restored. Re-initializing..."); window.location.reload(); } 
                          else { alert("Protocol Failure: Invalid snapshot file."); }
                        }; 
                        r.readAsText(f); 
                      }} className="hidden" />
                  </label>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default AdminPanel;
