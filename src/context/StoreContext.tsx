
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';

// Internal type for tracking usage
interface UsageRecord {
  date: string; // YYYY-MM-DD
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

  // Key Vault
  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => void;
  updateKeyPool: (pool: KeyPool) => void;
  deleteKeyPool: (id: string) => void;
  reportKeyFailure: (poolId: string, key: string) => void;
  getValidKey: (poolId: string) => string | null;

  // Rate Limiting
  getUsageCount: (userId: string, personaId: string) => number;
  incrementUsage: (userId: string, personaId: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const safeJSONParse = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (e) {
    console.warn(`Corrupted data in ${key}, resetting to default.`, e);
    return fallback;
  }
};

const DEFAULT_CONFIG: SystemConfig = {
  appName: 'Jailbreak Lab',
  creatorName: 'Created by BT4',
  logoUrl: ''
};

const getTodayString = () => new Date().toISOString().split('T')[0];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- STATE ---
  const [personas, setPersonas] = useState<Persona[]>(() => 
    safeJSONParse('pentest_personas', INITIAL_PERSONAS)
  );
  
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  
  const [config, setConfig] = useState<SystemConfig>(() => 
    safeJSONParse('pentest_config', DEFAULT_CONFIG)
  );
  
  const [keyPools, setKeyPools] = useState<KeyPool[]>(() => 
    safeJSONParse('pentest_key_pools', [])
  );

  // Persistent Usage Logs: { "userId_personaId": { date: "2023-10-27", count: 10 } }
  const [usageLogs, setUsageLogs] = useState<Record<string, UsageRecord>>(() => 
    safeJSONParse('pentest_usage_logs', {})
  );

  // --- PERSISTENCE ---
  useEffect(() => { localStorage.setItem('pentest_personas', JSON.stringify(personas)); }, [personas]);
  useEffect(() => { localStorage.setItem('pentest_config', JSON.stringify(config)); document.title = config.appName; }, [config]);
  useEffect(() => { localStorage.setItem('pentest_key_pools', JSON.stringify(keyPools)); }, [keyPools]);
  useEffect(() => { localStorage.setItem('pentest_usage_logs', JSON.stringify(usageLogs)); }, [usageLogs]);

  // --- ACTIONS ---

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
    const key = `${userId}_${personaId}`;
    return chats[key]?.messages || [];
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

  // --- KEY VAULT ---

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
      const validKeys = pool.keys.filter(k => !pool.deadKeys[k]);
      if (validKeys.length === 0) return null;
      return validKeys[0];
  }, [keyPools]);

  // --- RATE LIMITING ---

  const getUsageCount = useCallback((userId: string, personaId: string) => {
      const key = `${userId}_${personaId}`;
      const record = usageLogs[key];
      const today = getTodayString();
      
      if (!record || record.date !== today) {
          return 0;
      }
      return record.count;
  }, [usageLogs]);

  const incrementUsage = useCallback((userId: string, personaId: string) => {
      const key = `${userId}_${personaId}`;
      const today = getTodayString();
      
      setUsageLogs(prev => {
          const current = prev[key];
          let newCount = 1;
          
          if (current && current.date === today) {
              newCount = current.count + 1;
          }
          
          return {
              ...prev,
              [key]: { date: today, count: newCount }
          };
      });
  }, []);

  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona,
      getChatHistory, saveChatMessage, clearChatHistory,
      config, updateConfig, allChats: chats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool, reportKeyFailure, getValidKey,
      getUsageCount, incrementUsage
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
