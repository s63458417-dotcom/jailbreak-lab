
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, SystemConfig, KeyPool } from '../types';
import { INITIAL_PERSONAS } from '../constants';

interface StoreContextType {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  
  // Chat
  getChatMessages: (userId: string, personaId: string) => ChatMessage[];
  saveMessage: (userId: string, personaId: string, message: ChatMessage) => void;
  clearChat: (userId: string, personaId: string) => void;

  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => void;
  
  getAllChats: () => Record<string, ChatMessage[]>;

  // Key Vault
  keyPools: KeyPool[];
  addKeyPool: (pool: KeyPool) => void;
  updateKeyPool: (pool: KeyPool) => void;
  deleteKeyPool: (id: string) => void;
  reportKeyFailure: (poolId: string, key: string) => void;
  getValidKey: (poolId: string) => string | null;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const safeJSONParse = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && key.includes('chats')) {
        return parsed;
    }
    return parsed;
  } catch (e) {
    console.warn(`Corrupted data in ${key}, resetting.`, e);
    return fallback;
  }
};

const DEFAULT_CONFIG: SystemConfig = {
  appName: 'Jailbreak Lab',
  creatorName: 'Created by BT4',
  logoUrl: ''
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<Persona[]>(() => safeJSONParse('pentest_personas', INITIAL_PERSONAS));
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => safeJSONParse('pentest_simple_chats', {}));
  const [config, setConfig] = useState<SystemConfig>(() => safeJSONParse('pentest_config', DEFAULT_CONFIG));
  const [keyPools, setKeyPools] = useState<KeyPool[]>(() => safeJSONParse('pentest_key_pools', []));

  useEffect(() => localStorage.setItem('pentest_personas', JSON.stringify(personas)), [personas]);
  useEffect(() => localStorage.setItem('pentest_simple_chats', JSON.stringify(chats)), [chats]);
  useEffect(() => {
    localStorage.setItem('pentest_config', JSON.stringify(config));
    document.title = config.appName;
  }, [config]);
  useEffect(() => localStorage.setItem('pentest_key_pools', JSON.stringify(keyPools)), [keyPools]);

  // --- Persona Actions ---
  const addPersona = useCallback((persona: Persona) => setPersonas(prev => [...prev, persona]), []);
  const updatePersona = useCallback((p: Persona) => setPersonas(prev => prev.map(old => old.id === p.id ? p : old)), []);
  const deletePersona = useCallback((id: string) => setPersonas(prev => prev.filter(p => p.id !== id)), []);

  // --- Chat Actions ---
  const getChatMessages = useCallback((userId: string, personaId: string) => chats[`${userId}_${personaId}`] || [], [chats]);
  const saveMessage = useCallback((userId: string, personaId: string, message: ChatMessage) => {
      setChats(prev => ({
          ...prev,
          [`${userId}_${personaId}`]: [...(prev[`${userId}_${personaId}`] || []), message]
      }));
  }, []);
  const clearChat = useCallback((userId: string, personaId: string) => {
      setChats(prev => {
          const newState = { ...prev };
          delete newState[`${userId}_${personaId}`];
          return newState;
      });
  }, []);
  const getAllChats = useCallback(() => chats, [chats]);
  const updateConfig = useCallback((newConfig: SystemConfig) => setConfig(newConfig), []);

  // --- Key Vault Logic ---
  const addKeyPool = useCallback((pool: KeyPool) => setKeyPools(prev => [...prev, pool]), []);
  const updateKeyPool = useCallback((pool: KeyPool) => setKeyPools(prev => prev.map(p => p.id === pool.id ? pool : p)), []);
  const deleteKeyPool = useCallback((id: string) => setKeyPools(prev => prev.filter(p => p.id !== id)), []);

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

      // Filter out dead keys
      const validKeys = pool.keys.filter(k => !pool.deadKeys[k]);
      
      if (validKeys.length === 0) {
          // OPTIONAL: Revive keys after 1 hour? For now, rigorous death.
          return null;
      }

      // Simple rotation: Random or Round Robin. Random is better for distributing load across many user instances.
      return validKeys[Math.floor(Math.random() * validKeys.length)];
  }, [keyPools]);

  return (
    <StoreContext.Provider value={{ 
      personas, addPersona, updatePersona, deletePersona,
      getChatMessages, saveMessage, clearChat,
      config, updateConfig, getAllChats,
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
