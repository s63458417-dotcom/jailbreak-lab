
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, SystemConfig, ChatHistory } from '../types';
import { INITIAL_PERSONAS } from '../constants';

interface StoreContextType {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  
  // Simplified Chat Management
  getChatMessages: (userId: string, personaId: string) => ChatMessage[];
  saveMessage: (userId: string, personaId: string, message: ChatMessage) => void;
  clearChat: (userId: string, personaId: string) => void;

  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => void;
  
  // Admin / Analytics access
  getAllChats: () => Record<string, ChatMessage[]>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const safeJSONParse = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    
    // DATA SANITIZATION CHECK
    // If we find the old 'sessions' format or corrupt data, we return fallback to prevent crash
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Basic check if it looks like the expected record
        return parsed;
    }
    return fallback;
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
  // Personas
  const [personas, setPersonas] = useState<Persona[]>(() => {
    return safeJSONParse('pentest_personas', INITIAL_PERSONAS);
  });

  // Chats: Key is `${userId}_${personaId}` -> Value is ChatMessage[]
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => {
    return safeJSONParse('pentest_simple_chats', {});
  });

  // Config
  const [config, setConfig] = useState<SystemConfig>(() => {
    return safeJSONParse('pentest_config', DEFAULT_CONFIG);
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('pentest_personas', JSON.stringify(personas));
  }, [personas]);

  useEffect(() => {
    localStorage.setItem('pentest_simple_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('pentest_config', JSON.stringify(config));
    document.title = config.appName;
  }, [config]);

  // --- Persona Actions ---
  const addPersona = useCallback((persona: Persona) => {
    setPersonas((prev) => [...prev, persona]);
  }, []);

  const updatePersona = useCallback((updatedPersona: Persona) => {
    setPersonas((prev) => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
  }, []);

  const deletePersona = useCallback((id: string) => {
    setPersonas((prev) => prev.filter(p => p.id !== id));
  }, []);

  // --- Simplified Chat Actions ---

  const getChatMessages = useCallback((userId: string, personaId: string) => {
      const key = `${userId}_${personaId}`;
      return chats[key] || [];
  }, [chats]);

  const saveMessage = useCallback((userId: string, personaId: string, message: ChatMessage) => {
      const key = `${userId}_${personaId}`;
      setChats(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), message]
      }));
  }, []);

  const clearChat = useCallback((userId: string, personaId: string) => {
      const key = `${userId}_${personaId}`;
      setChats(prev => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
      });
  }, []);

  const getAllChats = useCallback(() => chats, [chats]);

  const updateConfig = useCallback((newConfig: SystemConfig) => {
    setConfig(newConfig);
  }, []);

  return (
    <StoreContext.Provider value={{ 
      personas, 
      addPersona, 
      updatePersona, 
      deletePersona,
      getChatMessages,
      saveMessage,
      clearChat,
      config,
      updateConfig,
      getAllChats
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
