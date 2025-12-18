
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';
import { supabase, isSupabaseConfigured } from '../supabaseService';

interface StoreContextType {
  personas: Persona[];
  addPersona: (persona: Persona) => Promise<void>;
  updatePersona: (persona: Persona) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  getChatHistory: (userId: string, personaId: string) => ChatMessage[];
  saveChatMessage: (userId: string, personaId: string, message: ChatMessage) => Promise<void>;
  clearChatHistory: (userId: string, personaId: string) => Promise<void>;
  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => Promise<void>;
  allChats: Record<string, ChatSession>;
  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => Promise<void>;
  updateKeyPool: (pool: KeyPool) => Promise<void>;
  deleteKeyPool: (id: string) => Promise<void>;
  getValidKey: (poolId: string) => string | null;
  reportKeyFailure: (poolId: string, key: string) => Promise<void>;
  isReady: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [config, setConfig] = useState<SystemConfig>({ appName: 'Jailbreak Lab', creatorName: 'Created by BT4', logoUrl: '' });
  const [keyPools, setKeyPools] = useState<KeyPool[]>([]);

  const loadData = async () => {
    if (!isSupabaseConfigured()) {
      setPersonas(INITIAL_PERSONAS);
      setIsReady(true);
      return;
    }

    try {
      const [p, c, k, ch] = await Promise.all([
        supabase.from('personas').select('*'),
        supabase.from('system_config').select('*').eq('id', 'global').maybeSingle(),
        supabase.from('key_pools').select('*'),
        supabase.from('chats').select('*')
      ]);
      
      if (p.data && p.data.length > 0) {
        setPersonas(p.data.map((x: any) => ({ 
          id: x.id, name: x.name, description: x.description,
          systemPrompt: x.system_prompt, isLocked: x.is_locked, 
          accessKey: x.access_key, accessDuration: x.access_duration,
          model: x.model, baseUrl: x.base_url, customApiKey: x.custom_api_key,
          keyPoolId: x.key_pool_id, avatar: x.avatar, avatarUrl: x.avatar_url, 
          themeColor: x.theme_color, rateLimit: x.rate_limit
        })));
      } else {
        setPersonas(INITIAL_PERSONAS);
      }

      if (c.data) setConfig({ appName: c.data.app_name, creatorName: c.data.creator_name, logoUrl: c.data.logo_url });
      if (k.data) setKeyPools(k.data.map((x: any) => ({ id: x.id, name: x.name, provider: x.provider, keys: x.keys || [], deadKeys: x.dead_keys || {} })));
      
      if (ch.data) {
        const map: any = {};
        ch.data.forEach((x: any) => { map[`${x.user_id}_${x.persona_id}`] = { personaId: x.persona_id, messages: x.messages || [] }; });
        setChats(map);
      }
    } catch (err) { console.error("Sync Error", err); }
    setIsReady(true);
  };

  useEffect(() => { loadData(); }, []);

  const addPersona = async (p: Persona) => {
    setPersonas(prev => [...prev, p]);
    if (isSupabaseConfigured()) {
      await supabase.from('personas').upsert({
        id: p.id, name: p.name, description: p.description, system_prompt: p.systemPrompt,
        is_locked: p.isLocked, access_key: p.accessKey, access_duration: p.accessDuration,
        model: p.model, base_url: p.baseUrl, custom_api_key: p.customApiKey,
        key_pool_id: p.keyPoolId, avatar: p.avatar, avatar_url: p.avatarUrl,
        theme_color: p.themeColor, rate_limit: p.rateLimit
      });
    }
  };

  const updatePersona = async (p: Persona) => {
    setPersonas(prev => prev.map(i => i.id === p.id ? p : i));
    if (isSupabaseConfigured()) {
      await supabase.from('personas').update({
        name: p.name, description: p.description, system_prompt: p.systemPrompt,
        is_locked: p.isLocked, access_key: p.accessKey, access_duration: p.accessDuration,
        model: p.model, base_url: p.baseUrl, custom_api_key: p.customApiKey,
        key_pool_id: p.keyPoolId, avatar: p.avatar, avatar_url: p.avatarUrl,
        theme_color: p.themeColor, rate_limit: p.rateLimit
      }).eq('id', p.id);
    }
  };

  const deletePersona = async (id: string) => {
    setPersonas(prev => prev.filter(p => p.id !== id));
    if (isSupabaseConfigured()) await supabase.from('personas').delete().eq('id', id);
  };

  const saveChatMessage = async (uid: string, pid: string, msg: ChatMessage) => {
    const key = `${uid}_${pid}`;
    const msgs = [...(chats[key]?.messages || []), msg];
    setChats(prev => ({ ...prev, [key]: { personaId: pid, messages: msgs } }));
    if (isSupabaseConfigured()) await supabase.from('chats').upsert({ id: key, user_id: uid, persona_id: pid, messages: msgs });
  };

  const clearChatHistory = async (uid: string, pid: string) => {
    const key = `${uid}_${pid}`;
    setChats(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (isSupabaseConfigured()) await supabase.from('chats').delete().eq('id', key);
  };

  const addKeyPool = async (p: KeyPool) => {
    setKeyPools(prev => [...prev, p]);
    if (isSupabaseConfigured()) await supabase.from('key_pools').upsert({ id: p.id, name: p.name, provider: p.provider, keys: p.keys, dead_keys: p.deadKeys });
  };

  const updateKeyPool = async (p: KeyPool) => {
    setKeyPools(prev => prev.map(i => i.id === p.id ? p : i));
    if (isSupabaseConfigured()) await supabase.from('key_pools').update({ name: p.name, provider: p.provider, keys: p.keys, dead_keys: p.deadKeys }).eq('id', p.id);
  };

  const deleteKeyPool = async (id: string) => {
    setKeyPools(prev => prev.filter(i => i.id !== id));
    if (isSupabaseConfigured()) await supabase.from('key_pools').delete().eq('id', id);
  };

  const getValidKey = (poolId: string) => {
    const pool = keyPools.find(p => p.id === poolId);
    if (!pool || !pool.keys.length) return null;
    return pool.keys[Math.floor(Math.random() * pool.keys.length)];
  };

  const reportKeyFailure = async (poolId: string, key: string) => {
    setKeyPools(prev => prev.map(p => p.id === poolId ? { ...p, deadKeys: { ...p.deadKeys, [key]: Date.now() } } : p));
  };

  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona, getChatHistory: (u, p) => chats[`${u}_${p}`]?.messages || [],
      saveChatMessage, clearChatHistory, config, 
      updateConfig: async (c) => { setConfig(c); if (isSupabaseConfigured()) await supabase.from('system_config').upsert({ id: 'global', app_name: c.appName, creator_name: c.creatorName, logo_url: c.logoUrl }); },
      allChats: chats, keyPools, addKeyPool, updateKeyPool, deleteKeyPool, getValidKey, reportKeyFailure, isReady
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const c = useContext(StoreContext);
  if (!c) throw new Error("useStore error");
  return c;
};
