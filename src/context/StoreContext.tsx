import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Persona, ChatSession, ChatMessage, SystemConfig } from '../types';
import { INITIAL_PERSONAS } from '../constants';

interface StoreContextType {
  personas: Persona[];
  addPersona: (persona: Persona) => void;
  updatePersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  
  // Session Management
  sessions: Record<string, ChatSession>;
  createSession: (userId: string, personaId: string) => string; // Returns new session ID
  getSession: (sessionId: string) => ChatSession | undefined;
  getUserSessions: (userId: string, personaId: string) => ChatSession[];
  saveMessageToSession: (sessionId: string, message: ChatMessage) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;

  config: SystemConfig;
  updateConfig: (newConfig: SystemConfig) => void;
  
  // Legacy support for admin panel stats
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
  // Personas
  const [personas, setPersonas] = useState<Persona[]>(() => {
    return safeJSONParse('pentest_personas', INITIAL_PERSONAS);
  });

  // Sessions (The new multi-chat DB)
  const [sessions, setSessions] = useState<Record<string, ChatSession>>(() => {
    // Try to load new v2 sessions
    const v2 = safeJSONParse('pentest_sessions_v2', null);
    if (v2) return v2;

    // Fallback: Check for legacy chat data and migrate if possible, else empty
    // We start fresh to avoid crashes from type mismatches seen in user logs
    return {};
  });

  // Config
  const [config, setConfig] = useState<SystemConfig>(() => {
    return safeJSONParse('pentest_config', DEFAULT_CONFIG);
  });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('pentest_personas', JSON.stringify(personas));
  }, [personas]);

  useEffect(() => {
    localStorage.setItem('pentest_sessions_v2', JSON.stringify(sessions));
  }, [sessions]);

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

  // --- Session Actions (The Core Upgrade) ---

  const createSession = useCallback((userId: string, personaId: string) => {
    const newSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const timestamp = Date.now();
    
    // Auto-generate a title based on time (user can rename later)
    const dateStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    const newSession: ChatSession = {
        id: newSessionId,
        userId,
        personaId,
        title: `Operation ${dateStr}`,
        messages: [],
        createdAt: timestamp,
        lastModified: timestamp
    };

    setSessions(prev => ({
        ...prev,
        [newSessionId]: newSession
    }));

    return newSessionId;
  }, []);

  const getSession = useCallback((sessionId: string) => {
      return sessions[sessionId];
  }, [sessions]);

  const getUserSessions = useCallback((userId: string, personaId: string) => {
      // Filter sessions belonging to this user and persona, sorted by newest first
      // Explicitly cast to array to avoid TS issues with record values
      return (Object.values(sessions) as ChatSession[])
          .filter(s => s.userId === userId && s.personaId === personaId)
          .sort((a, b) => b.lastModified - a.lastModified);
  }, [sessions]);

  const saveMessageToSession = useCallback((sessionId: string, message: ChatMessage) => {
      setSessions(prev => {
          const session = prev[sessionId];
          if (!session) return prev;

          return {
              ...prev,
              [sessionId]: {
                  ...session,
                  messages: [...session.messages, message],
                  lastModified: Date.now()
              }
          };
      });
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
      setSessions(prev => {
          const newState = { ...prev };
          delete newState[sessionId];
          return newState;
      });
  }, []);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
      setSessions(prev => {
          const session = prev[sessionId];
          if (!session) return prev;
          return {
              ...prev,
              [sessionId]: { ...session, title: newTitle }
          };
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
      sessions,
      createSession,
      getSession,
      getUserSessions,
      saveMessageToSession,
      deleteSession,
      renameSession,
      config,
      updateConfig,
      allChats: sessions // Alias for admin panel compatibility
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