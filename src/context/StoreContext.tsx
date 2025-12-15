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

  // Data Management
  exportData: () => string;
  importData: (jsonData: string) => boolean;
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
  
  const [chats, setChats] = useState<Record<string, ChatSession>>(() => 
    safeJSONParse('pentest_chats', {})
  );
  
  const [config, setConfig] = useState<SystemConfig>(() => 
    safeJSONParse('pentest_config', DEFAULT_CONFIG)
  );
  
  const [keyPools, setKeyPools] = useState<KeyPool[]>(() => 
    safeJSONParse('pentest_key_pools', [])
  );

  // Persistent Usage Logs
  const [usageLogs, setUsageLogs] = useState<Record<string, UsageRecord>>(() => 
    safeJSONParse('pentest_usage_logs', {})
  );

  // --- PERSISTENCE HELPERS ---
  const saveToStorage = (key: string, data: any) => {
      try {
          localStorage.setItem(key, JSON.stringify(data));
      } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
              console.error(`Storage Quota Exceeded while saving ${key}`);
              alert("SYSTEM ALERT: Storage limit reached. Old chat history may be lost. Please backup your data in Admin Panel.");
          } else {
              console.error(`Failed to save ${key}`, e);
          }
      }
  };

  useEffect(() => { saveToStorage('pentest_personas', personas); }, [personas]);
  useEffect(() => { saveToStorage('pentest_chats', chats); }, [chats]);
  useEffect(() => { saveToStorage('pentest_config', config); document.title = config.appName; }, [config]);
  useEffect(() => { saveToStorage('pentest_key_pools', keyPools); }, [keyPools]);
  useEffect(() => { saveToStorage('pentest_usage_logs', usageLogs); }, [usageLogs]);

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
      let newMessages = [...existingSession.messages, message];
      
      // STORAGE OPTIMIZATION: Keep only last 60 messages per session to prevent localStorage overflow
      if (newMessages.length > 60) {
          newMessages = newMessages.slice(newMessages.length - 60);
      }

      return {
        ...prev,
        [key]: {
          ...existingSession,
          messages: newMessages,
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

  // --- DATA MANAGEMENT ---
  const exportData = useCallback(() => {
      const backup = {
          personas,
          config,
          keyPools,
          // We exclude chats/usageLogs to keep backup small and focus on configuration
          timestamp: Date.now(),
          version: '1.0'
      };
      return JSON.stringify(backup, null, 2);
  }, [personas, config, keyPools]);

  const importData = useCallback((jsonData: string) => {
      try {
          const data = JSON.parse(jsonData);
          if (data.personas) setPersonas(data.personas);
          if (data.config) setConfig(data.config);
          if (data.keyPools) setKeyPools(data.keyPools);
          return true;
      } catch (e) {
          console.error("Import failed", e);
          return false;
      }
  }, []);


  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona,
      getChatHistory, saveChatMessage, clearChatHistory,
      config, updateConfig, allChats: chats,
      keyPools, addKeyPool, updateKeyPool, deleteKeyPool, reportKeyFailure, getValidKey,
      getUsageCount, incrementUsage,
      exportData, importData
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