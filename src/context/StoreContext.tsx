
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';
import { supabase } from '../services/supabase';

interface UsageRecord {
  date: string;
  count: number;
}

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
  reportKeyFailure: (poolId: string, key: string) => void;
  getValidKey: (poolId: string) => string | null;

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

const getTodayString = () => new Date().toISOString().split('T')[0];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [keyPools, setKeyPools] = useState<KeyPool[]>([]);
  const [usageLogs, setUsageLogs] = useState<Record<string, UsageRecord>>({});

  // --- INITIAL LOAD FROM SUPABASE ---
  useEffect(() => {
    const initData = async () => {
      try {
        const [
          { data: pData },
          { data: cData },
          { data: kData },
          { data: chatData }
        ] = await Promise.all([
          supabase.from('personas').select('*'),
          supabase.from('system_config').select('*').eq('id', 'global').single(),
          supabase.from('key_pools').select('*'),
          supabase.from('chats').select('*')
        ]);

        // Handle Personas
        if (pData && pData.length > 0) {
          // Map snake_case from DB to camelCase for app
          setPersonas(pData.map((p: any) => ({
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
          // First run: Seed DB with defaults
          setPersonas(INITIAL_PERSONAS);
          for (const p of INITIAL_PERSONAS) {
              await supabase.from('personas').upsert({
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  system_prompt: p.systemPrompt,
                  is_locked: p.isLocked,
                  access_key: p.accessKey,
                  access_duration: p.accessDuration,
                  model: p.model,
                  avatar: p.avatar
              });
          }
        }

        // Handle Config
        if (cData) {
          setConfig({
            appName: cData.app_name,
            creatorName: cData.creator_name,
            logoUrl: cData.logo_url
          });
        }

        // Handle Vaults
        if (kData) setKeyPools(kData);

        // Handle Chats
        if (chatData) {
            const chatMap: Record<string, ChatSession> = {};
            chatData.forEach((c: any) => {
                chatMap[c.id] = { personaId: c.persona_id, messages: c.messages };
            });
            setChats(chatMap);
        }

        setIsReady(true);
      } catch (err) {
        console.error("Supabase Load Error:", err);
        // Fallback to defaults to prevent white screen
        setPersonas(INITIAL_PERSONAS);
        setIsReady(true);
      }
    };

    initData();
  }, []);

  // --- ACTIONS ---
  const addPersona = async (persona: Persona) => {
    setPersonas(prev => [...prev, persona]);
    await supabase.from('personas').insert({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        system_prompt: persona.systemPrompt,
        is_locked: persona.isLocked,
        access_key: persona.accessKey,
        access_duration: persona.accessDuration,
        model: persona.model,
        base_url: persona.baseUrl,
        custom_api_key: persona.customApiKey,
        key_pool_id: persona.keyPoolId,
        avatar: persona.avatar,
        avatar_url: persona.avatarUrl,
        theme_color: persona.themeColor,
        rate_limit: persona.rateLimit
    });
  };

  const updatePersona = async (p: Persona) => {
    setPersonas(prev => prev.map(item => item.id === p.id ? p : item));
    // Fixed: Corrected snake_case property access on Persona object (should be camelCase)
    await supabase.from('personas').update({
        name: p.name,
        description: p.description,
        system_prompt: p.systemPrompt,
        is_locked: p.isLocked,
        access_key: p.accessKey,
        access_duration: p.accessDuration,
        model: p.model,
        base_url: p.baseUrl,
        custom_api_key: p.customApiKey,
        key_pool_id: p.keyPoolId,
        avatar: p.avatar,
        avatar_url: p.avatarUrl,
        theme_color: p.themeColor,
        rate_limit: p.rateLimit
    }).eq('id', p.id);
  };

  const deletePersona = async (id: string) => {
    setPersonas(prev => prev.filter(p => p.id !== id));
    await supabase.from('personas').delete().eq('id', id);
  };

  const getChatHistory = (userId: string, personaId: string) => {
    const key = `${userId}_${personaId}`;
    return chats[key]?.messages || [];
  };

  const saveChatMessage = async (userId: string, personaId: string, message: ChatMessage) => {
    const key = `${userId}_${personaId}`;
    const existing = chats[key]?.messages || [];
    const newMessages = [...existing, message].slice(-100);
    
    setChats(prev => ({
      ...prev,
      [key]: { personaId, messages: newMessages }
    }));

    await supabase.from('chats').upsert({
        id: key,
        user_id: userId,
        persona_id: personaId,
        messages: newMessages
    });
  };

  const clearChatHistory = async (userId: string, personaId: string) => {
    const key = `${userId}_${personaId}`;
    setChats(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
    });
    await supabase.from('chats').delete().eq('id', key);
  };

  const updateConfig = async (c: SystemConfig) => {
    setConfig(c);
    await supabase.from('system_config').upsert({
        id: 'global',
        app_name: c.appName,
        creator_name: c.creatorName,
        logo_url: c.logoUrl
    });
  };

  // --- VAULTS ---
  const addKeyPool = async (pool: KeyPool) => {
    setKeyPools(prev => [...prev, pool]);
    await supabase.from('key_pools').insert(pool);
  };

  const updateKeyPool = async (pool: KeyPool) => {
    setKeyPools(prev => prev.map(p => p.id === pool.id ? pool : p));
    await supabase.from('key_pools').update(pool).eq('id', pool.id);
  };

  const deleteKeyPool = async (id: string) => {
    setKeyPools(prev => prev.filter(p => p.id !== id));
    await supabase.from('key_pools').delete().eq('id', id);
  };

  const reportKeyFailure = (poolId: string, key: string) => {
    setKeyPools(prev => prev.map(pool => {
        if (pool.id !== poolId) return pool;
        const updated = {
            ...pool,
            deadKeys: { ...pool.deadKeys, [key]: Date.now() }
        };
        supabase.from('key_pools').update({ dead_keys: updated.deadKeys }).eq('id', poolId);
        return updated;
    }));
  };

  const getValidKey = (poolId: string): string | null => {
      const pool = keyPools.find(p => p.id === poolId);
      if (!pool || pool.keys.length === 0) return null;
      const validKeys = pool.keys.filter(k => !pool.deadKeys[k] || (Date.now() - pool.deadKeys[k] > 3600000));
      if (validKeys.length === 0) return null;
      return validKeys[Math.floor(Math.random() * validKeys.length)];
  };

  const getUsageCount = (userId: string, personaId: string) => {
      const key = `${userId}_${personaId}_usage`;
      const record = usageLogs[key];
      return (record && record.date === getTodayString()) ? record.count : 0;
  };

  const incrementUsage = (userId: string, personaId: string) => {
      const key = `${userId}_${personaId}_usage`;
      const today = getTodayString();
      setUsageLogs(prev => {
          const current = prev[key];
          const newCount = (current && current.date === today) ? current.count + 1 : 1;
          return { ...prev, [key]: { date: today, count: newCount } };
      });
  };

  const exportData = () => {
      return JSON.stringify({ personas, config, keyPools }, null, 2);
  };

  const importData = async (jsonData: string) => {
      try {
          const data = JSON.parse(jsonData);
          if (data.personas) {
              setPersonas(data.personas);
              for (const p of data.personas) {
                  // Fixed: Use correct camelCase property names for the Persona object (accessDuration)
                  await supabase.from('personas').upsert({
                      id: p.id, name: p.name, description: p.description, system_prompt: p.systemPrompt,
                      is_locked: p.isLocked, access_key: p.accessKey, access_duration: p.accessDuration,
                      model: p.model, avatar: p.avatar
                  });
              }
          }
          if (data.config) await updateConfig(data.config);
          return true;
      } catch (e) {
          return false;
      }
  };

  if (!isReady) {
      return (
          <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center text-neutral-500 font-mono space-y-4">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-xs tracking-widest uppercase">Syncing with Uplink...</div>
          </div>
      );
  }

  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona,
      getChatHistory, saveChatMessage, clearChatHistory,
      config, updateConfig, allChats: chats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool, reportKeyFailure, getValidKey,
      getUsageCount, incrementUsage,
      exportData, importData, isReady
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
