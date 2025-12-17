
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface StoreContextType {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  getChatHistory: (userId: string, personaId: string) => ChatMessage[];
  saveChatMessage: (userId: string, personaId: string, message: ChatMessage) => void;
  clearChatHistory: (userId: string, personaId: string) => void;
  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => void;
  allChats: Record<string, ChatSession>;
  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => void;
  updateKeyPool: (pool: KeyPool) => void;
  deleteKeyPool: (id: string) => void;
  getValidKey: (poolId: string) => string | null;
  reportKeyFailure: (poolId: string, key: string) => void;
  getUsageCount: (userId: string, personaId: string) => number;
  incrementUsage: (userId: string, personaId: string) => void;
  exportData: () => string;
  importData: (jsonData: string) => Promise<boolean>;
  isReady: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const DEFAULT_CONFIG: SystemConfig = {
  appName: 'Jailbreak Lab',
  creatorName: 'Created by BT4',
  logoUrl: ''
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [keyPools, setKeyPools] = useState<KeyPool[]>([]);

  useEffect(() => {
    const loadGlobalData = async () => {
      if (!isSupabaseConfigured()) {
          setPersonas(INITIAL_PERSONAS);
          setIsReady(true);
          return;
      }

      try {
        const [pResp, cResp, kResp] = await Promise.all([
          supabase.from('personas').select('*'),
          supabase.from('system_config').select('*').eq('id', 'global').single(),
          supabase.from('key_pools').select('*')
        ]);

        if (pResp.data && pResp.data.length > 0) {
            setPersonas(pResp.data.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                systemPrompt: p.system_prompt,
                isLocked: p.is_locked,
                accessKey: p.access_key,
                accessDuration: p.access_duration,
                model: p.model,
                baseUrl: p.base_url,
                customApiKey: p.custom_api_key,
                keyPoolId: p.key_pool_id,
                avatar: p.avatar,
                avatarUrl: p.avatar_url,
                themeColor: p.theme_color,
                rateLimit: p.rate_limit
            })));
        } else {
            // Seed DB if empty
            for (const p of INITIAL_PERSONAS) {
                await supabase.from('personas').insert({
                    id: p.id, name: p.name, description: p.description, system_prompt: p.systemPrompt,
                    is_locked: p.isLocked, access_key: p.accessKey, model: p.model, avatar: p.avatar
                });
            }
            setPersonas(INITIAL_PERSONAS);
        }

        if (cResp.data) {
            setConfig({
                appName: cResp.data.app_name,
                creatorName: cResp.data.creator_name,
                logoUrl: cResp.data.logo_url
            });
        }
        
        if (kResp.data) setKeyPools(kResp.data);

        setIsReady(true);
      } catch (e) {
        console.error("Sync Error:", e);
        setPersonas(INITIAL_PERSONAS);
        setIsReady(true);
      }
    };

    loadGlobalData();
  }, []);

  const addPersona = async (p: Persona) => {
    setPersonas(prev => [...prev, p]);
    if (isSupabaseConfigured()) {
        await supabase.from('personas').insert({
            id: p.id, name: p.name, description: p.description, system_prompt: p.systemPrompt,
            is_locked: p.isLocked, access_key: p.accessKey, access_duration: p.accessDuration,
            model: p.model, base_url: p.baseUrl, custom_api_key: p.customApiKey,
            key_pool_id: p.keyPoolId, avatar: p.avatar, avatar_url: p.avatarUrl,
            theme_color: p.themeColor, rate_limit: p.rateLimit
        });
    }
  };

  const updatePersona = async (p: Persona) => {
    setPersonas(prev => prev.map(item => item.id === p.id ? p : item));
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
    if (isSupabaseConfigured()) {
        await supabase.from('personas').delete().eq('id', id);
    }
  };

  const getChatHistory = (userId: string, personaId: string) => {
    const key = `${userId}_${personaId}`;
    return chats[key]?.messages || [];
  };

  const saveChatMessage = async (userId: string, personaId: string, message: ChatMessage) => {
    const key = `${userId}_${personaId}`;
    const existingMessages = chats[key]?.messages || [];
    const newMessages = [...existingMessages, message];
    
    setChats(prev => ({
      ...prev,
      [key]: { personaId, messages: newMessages }
    }));

    if (isSupabaseConfigured()) {
        await supabase.from('chats').upsert({
            id: key, user_id: userId, persona_id: personaId, messages: newMessages
        });
    }
  };

  const clearChatHistory = async (userId: string, personaId: string) => {
    const key = `${userId}_${personaId}`;
    setChats(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
    });
    if (isSupabaseConfigured()) {
        await supabase.from('chats').delete().eq('id', key);
    }
  };

  const updateConfig = async (c: SystemConfig) => {
    setConfig(c);
    if (isSupabaseConfigured()) {
        await supabase.from('system_config').upsert({
            id: 'global', app_name: c.appName, creator_name: c.creatorName, logo_url: c.logoUrl
        });
    }
  };

  // Simplified Vault Methods
  const addKeyPool = (p: KeyPool) => setKeyPools(prev => [...prev, p]);
  const updateKeyPool = (p: KeyPool) => setKeyPools(prev => prev.map(i => i.id === p.id ? p : i));
  const deleteKeyPool = (id: string) => setKeyPools(prev => prev.filter(i => i.id !== id));
  const getValidKey = (id: string) => keyPools.find(i => i.id === id)?.keys[0] || null;
  const reportKeyFailure = () => {};
  const getUsageCount = () => 0;
  const incrementUsage = () => {};

  const exportData = () => JSON.stringify({ personas, config }, null, 2);
  const importData = async (json: string) => {
      try {
          const data = JSON.parse(json);
          if (data.config) await updateConfig(data.config);
          return true;
      } catch { return false; }
  };

  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona,
      getChatHistory, saveChatMessage, clearChatHistory,
      config, updateConfig, allChats: chats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool, getValidKey, reportKeyFailure,
      getUsageCount, incrementUsage, exportData, importData, isReady
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore error');
  return context;
};
