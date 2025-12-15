
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';

interface StoreContextType {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  
  // Chat History (Ephemeral now - kept in interface for compatibility but won't persist)
  getChatHistory: (userId: string, personaId: string) => ChatMessage[];
  saveChatMessage: (userId: string, personaId: string, message: ChatMessage) => void;
  clearChatHistory: (userId: string, personaId: string) => void;
  
  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => void;
  allChats: Record<string, ChatSession>;

  // Key Vault
  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => void;
  updateKeyPool: (pool: KeyPool) => void;
  deleteKeyPool: (id: string) => void;
  reportKeyFailure: (poolId: string, key: string) => void;
  getValidKey: (poolId: string) => string | null;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Robust local storage helper with type validation
const getStorage = <T,>(key: string, fallback: T, validator?: (data: any) => boolean): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (validator && !validator(parsed)) {
      console.warn(`Data validation failed for ${key}, using fallback.`);
      return fallback;
    }
    return parsed;
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return fallback;
  }
};

const DEFAULT_CONFIG: SystemConfig = {
  appName: 'Jailbreak Lab',
  creatorName: 'Created by BT4',
  logoUrl: ''
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load Personas
  const [personas, setPersonas] = useState<Persona[]>(() => 
    getStorage('pentest_personas', INITIAL_PERSONAS, (data) => Array.isArray(data))
  );

  // In-Memory Chat State (No LocalStorage Persistence)
  const [chats, setChats] = useState<Record<string, ChatSession>>({});

  // Load Config
  const [config, setConfig] = useState<SystemConfig>(() => 
    getStorage('pentest_config', DEFAULT_CONFIG)
  );

  // Load Key Pools
  const [keyPools, setKeyPools] = useState<KeyPool[]>(() => 
    getStorage('pentest_key_pools', [], (data) => Array.isArray(data))
  );

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('pentest_personas', JSON.stringify(personas));
  }, [personas]);

  // REMOVED: Chat history persistence effect
  // useEffect(() => { localStorage.setItem('pentest_chats', ...); }, [chats]);

  useEffect(() => {
    localStorage.setItem('pentest_config', JSON.stringify(config));
    document.title = config.appName;
  }, [config]);

  useEffect(() => {
    localStorage.setItem('pentest_key_pools', JSON.stringify(keyPools));
  }, [keyPools]);


  // --- Actions ---

  const addPersona = useCallback((persona: Persona) => {
    setPersonas((prev) => [...prev, persona]);
  }, []);

  const updatePersona = useCallback((updatedPersona: Persona) => {
    setPersonas((prev) => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
  }, []);

  const deletePersona = useCallback((id: string) => {
    setPersonas((prev) => prev.filter(p => p.id !== id));
  }, []);

  const getChatHistory = useCallback((userId: string, personaId: string) => {
    // Return empty array to force fresh chat every time, 
    // or return in-memory chats if we want history ONLY during the current session tab.
    // User requested "Remove that chat history", implies ephemeral.
    return chats[`${userId}_${personaId}`]?.messages || [];
  }, [chats]);

  const saveChatMessage = useCallback((userId: string, personaId: string, message: ChatMessage) => {
    const key = `${userId}_${personaId}`;
    setChats((prev) => {
      const existingSession = prev[key] || { personaId, messages: [] };
      return {
        ...prev,
        [key]: {
          ...existingSession,
          messages: [...existingSession.messages, message],
        },
      };
    });
  }, []);

  const clearChatHistory = useCallback((userId: string, personaId: string) => {
    const key = `${userId}_${personaId}`;
    setChats((prev) => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
    });
  }, []);

  const updateConfig = useCallback((newConfig: SystemConfig) => {
    setConfig(newConfig);
  }, []);

  // --- Key Vault Actions ---

  const addKeyPool = useCallback((pool: KeyPool) => {
    setKeyPools(prev => [...prev, pool]);
  }, []);

  const updateKeyPool = useCallback((pool: KeyPool) => {
    setKeyPools(prev => prev.map(p => p.id === pool.id ? pool : p));
  }, []);

  const deleteKeyPool = useCallback((id: string) => {
    setKeyPools(prev => prev.filter(p => p.id !== id));
  }, []);

  const reportKeyFailure = useCallback((poolId: string, key: string) => {
    setKeyPools(prev => prev.map(pool => {
        if (pool.id !== poolId) return pool;
        return {
            ...pool,
            deadKeys: { ...pool.deadKeys, [key]: Date.now() }
        };
    }));
  }, []);

  const getValidKey = useCallback((poolId: string): string | null => {
      const pool = keyPools.find(p => p.id === poolId);
      if (!pool || pool.keys.length === 0) return null;

      // Filter out keys that are dead
      const validKeys = pool.keys.filter(k => !pool.deadKeys[k]);
      
      if (validKeys.length === 0) return null;

      // SEQUENTIAL SELECTION: Always pick the first valid key.
      // This ensures we burn through keys one by one.
      return validKeys[0];
  }, [keyPools]);

  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona,
      getChatHistory, saveChatMessage, clearChatHistory,
      config, updateConfig, allChats: chats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool, reportKeyFailure, getValidKey
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
