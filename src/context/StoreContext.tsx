import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatMessage, ChatSession, SystemConfig } from '../types';
import { INITIAL_PERSONAS } from '../constants';

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

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [personas, setPersonas] = useState<Persona[]>(() => {
    return safeJSONParse('pentest_personas', INITIAL_PERSONAS);
  });

  const [chats, setChats] = useState<Record<string, ChatSession>>(() => {
    return safeJSONParse('pentest_chats', {});
  });

  const [config, setConfig] = useState<SystemConfig>(() => {
    return safeJSONParse('pentest_config', DEFAULT_CONFIG);
  });

  useEffect(() => {
    try {
      localStorage.setItem('pentest_personas', JSON.stringify(personas));
    } catch (e) {
      console.error("Failed to save personas", e);
    }
  }, [personas]);

  useEffect(() => {
    try {
      localStorage.setItem('pentest_chats', JSON.stringify(chats));
    } catch (e) {
      console.error("Failed to save chats", e);
    }
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem('pentest_config', JSON.stringify(config));
      document.title = config.appName;
    } catch (e) {
      console.error("Failed to save config", e);
    }
  }, [config]);

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

  return (
    <StoreContext.Provider value={{ 
      personas, 
      addPersona, 
      updatePersona, 
      deletePersona,
      getChatHistory,
      saveChatMessage,
      clearChatHistory,
      config,
      updateConfig,
      allChats: chats
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