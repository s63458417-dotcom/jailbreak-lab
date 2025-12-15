import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';
import { db } from '../services/db';

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

  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => void;
  updateKeyPool: (pool: KeyPool) => void;
  deleteKeyPool: (id: string) => void;
  reportKeyFailure: (poolId: string, key: string) => void;
  getValidKey: (poolId: string) => string | null;

  getUsageCount: (userId: string, personaId: string) => number;
  incrementUsage: (userId: string, personaId: string) => void;

  exportData: () => string;
  importData: (jsonData: string) => boolean;
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

  // --- STATE ---
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [chats, setChats] = useState<Record<string, ChatSession>>({});
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [keyPools, setKeyPools] = useState<KeyPool[]>([]);
  const [usageLogs, setUsageLogs] = useState<Record<string, UsageRecord>>({});

  // --- INITIAL LOAD ---
  useEffect(() => {
    const loadData = async () => {
      // Parallel load for performance
      const [
        loadedPersonas, 
        loadedChats, 
        loadedConfig, 
        loadedPools, 
        loadedUsage
      ] = await Promise.all([
        db.get<Persona[]>('pentest_personas', []),
        db.get<Record<string, ChatSession>>('pentest_chats', {}),
        db.get<SystemConfig>('pentest_config', DEFAULT_CONFIG),
        db.get<KeyPool[]>('pentest_key_pools', []),
        db.get<Record<string, UsageRecord>>('pentest_usage_logs', {})
      ]);

      // If DB is completely empty (first run), populate with defaults
      // We check if we loaded anything. If loadedPersonas is empty array, it might be first run OR user deleted all.
      // To distinguish, we check a specific flag.
      const initialized = await db.get<boolean>('app_initialized', false);
      
      if (!initialized) {
          setPersonas(INITIAL_PERSONAS);
          await db.set('pentest_personas', INITIAL_PERSONAS);
          await db.set('app_initialized', true);
      } else {
          setPersonas(loadedPersonas);
      }

      setChats(loadedChats);
      setConfig(loadedConfig);
      setKeyPools(loadedPools);
      setUsageLogs(loadedUsage);
      
      document.title = loadedConfig.appName;
      setIsReady(true);
    };

    loadData();
  }, []);

  // --- PERSISTENCE EFFECT WORKERS ---
  // We use distinct effects to save only what changes
  useEffect(() => { if(isReady) db.set('pentest_personas', personas); }, [personas, isReady]);
  useEffect(() => { if(isReady) db.set('pentest_chats', chats); }, [chats, isReady]);
  useEffect(() => { if(isReady) { db.set('pentest_config', config); document.title = config.appName; } }, [config, isReady]);
  useEffect(() => { if(isReady) db.set('pentest_key_pools', keyPools); }, [keyPools, isReady]);
  useEffect(() => { if(isReady) db.set('pentest_usage_logs', usageLogs); }, [usageLogs, isReady]);

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
      
      // Limit history to 100 messages for performance, can increase since we use IndexedDB now
      if (newMessages.length > 100) {
          newMessages = newMessages.slice(newMessages.length - 100);
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
    console.warn(`[Store] Reporting key failure in pool ${poolId}: ${key.substring(0,8)}...`);
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
      
      const now = Date.now();
      const REVIVAL_TIME = 60 * 60 * 1000; // 1 Hour

      // Check if any dead keys should be revived
      const validKeys = pool.keys.filter(k => {
          const deathTime = pool.deadKeys[k];
          if (!deathTime) return true; // Alive
          if (now - deathTime > REVIVAL_TIME) return true; // Revived
          return false; // Still dead
      });

      if (validKeys.length === 0) return null;
      
      // Simple rotation: Pick random to distribute load
      return validKeys[Math.floor(Math.random() * validKeys.length)];
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

  // Don't render app until DB is loaded
  if (!isReady) {
      return (
          <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center text-neutral-500 font-mono space-y-4">
              <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-xs tracking-widest uppercase">Initializing Database...</div>
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