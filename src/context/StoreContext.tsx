
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
  
  // Vaults / Key Pools
  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => Promise<void>;
  updateKeyPool: (pool: KeyPool) => Promise<void>;
  deleteKeyPool: (id: string) => Promise<void>;
  getValidKey: (poolId: string) => string | null;
  reportKeyFailure: (poolId: string, key: string) => Promise<void>;

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

        if (pResp.data) {
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
        }

        if (cResp.data) {
            setConfig({
                appName: cResp.data.app_name,
                creatorName: cResp.data.creator_name,
                logoUrl: cResp.data.logo_url
            });
        }
        
        if (kResp.data) {
            setKeyPools(kResp.data);
        }

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

  // --- VAULT LOGIC ---
  const addKeyPool = async (p: KeyPool) => {
    setKeyPools(prev => [...prev, p]);
    if (isSupabaseConfigured()) {
        await supabase.from('key_pools').insert(p);
    }
  };

  const updateKeyPool = async (p: KeyPool) => {
    setKeyPools(prev => prev.map(i => i.id === p.id ? p : i));
    if (isSupabaseConfigured()) {
        await supabase.from('key_pools').update(p).eq('id', p.id);
    }
  };

  const deleteKeyPool = async (id: string) => {
    setKeyPools(prev => prev.filter(i => i.id !== id));
    if (isSupabaseConfigured()) {
        await supabase.from('key_pools').delete().eq('id', id);
    }
  };

  const getValidKey = (poolId: string): string | null => {
      const pool = keyPools.find(p => p.id === poolId);
      if (!pool || pool.keys.length === 0) return null;
      
      const now = Date.now();
      // Filter out keys that failed in the last 1 hour
      const availableKeys = pool.keys.filter(k => {
          const failTime = pool.deadKeys[k] || 0;
          return (now - failTime) > 3600000; 
      });

      if (availableKeys.length === 0) return null;
      // Randomly pick one to balance load
      return availableKeys[Math.floor(Math.random() * availableKeys.length)];
  };

  const reportKeyFailure = async (poolId: string, key: string) => {
      setKeyPools(prev => prev.map(pool => {
          if (pool.id !== poolId) return pool;
          const updated = {
              ...pool,
              deadKeys: { ...pool.deadKeys, [key]: Date.now() }
          };
          if (isSupabaseConfigured()) {
              supabase.from('key_pools').update({ dead_keys: updated.deadKeys }).eq('id', poolId);
          }
          return updated;
      }));
  };

  const getUsageCount = (userId: string, personaId: string) => 0; // Simplified for this restore
  const incrementUsage = (userId: string, personaId: string) => {};

  const exportData = () => JSON.stringify({ personas, config, keyPools }, null, 2);
  
  const importData = async (json: string) => {
      try {
          const data = JSON.parse(json);
          if (data.config) await updateConfig(data.config);
          // Potential logic for batch inserting personas/vaults here
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
