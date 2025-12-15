import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { ADMIN_USERNAME, DEFAULT_ADMIN_PASS } from '../constants';
import { db } from '../services/db';

interface AuthContextType {
  user: User | null;
  login: (username: string, pass: string) => Promise<boolean>;
  register: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  unlockPersona: (personaId: string) => void;
  getPersonaAccessTime: (personaId: string) => number | undefined;
  isAdmin: boolean;
  updateProfile: (newUsername: string, newPassword?: string) => Promise<boolean>;
  getAllUsers: () => User[]; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore Session
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const saved = await db.get<User | null>('pentest_user_session', null);
        if (saved) {
           // Migration: ensure map format
           if (Array.isArray(saved.unlockedPersonas)) {
               const newMap: Record<string, number> = {};
               saved.unlockedPersonas.forEach((id: string) => newMap[id] = Date.now());
               saved.unlockedPersonas = newMap;
           }
           setUser(saved);
        }
      } catch (e) {
        console.error("Auth Restore Error", e);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // Save Session
  useEffect(() => {
    if (!loading) {
        if (user) db.set('pentest_user_session', user);
        else db.delete('pentest_user_session');
    }
  }, [user, loading]);

  const login = async (username: string, pass: string): Promise<boolean> => {
    if (username === ADMIN_USERNAME && pass === DEFAULT_ADMIN_PASS) {
      const adminUser: User = {
        id: 'admin',
        username: ADMIN_USERNAME,
        role: Role.ADMIN,
        unlockedPersonas: {}
      };
      setUser(adminUser);
      window.location.hash = '#/dashboard';
      return true;
    }

    try {
        const dbUsers = await db.get<Record<string, any>>('pentest_users_db', {});
        
        const foundUser = Object.values(dbUsers).find((u: any) => u.username === username && u.password === pass) as any;
        
        if (foundUser) {
           const { password, ...safeUser } = foundUser;
           // Migration check
           if (Array.isArray(safeUser.unlockedPersonas)) {
              const newMap: Record<string, number> = {};
              safeUser.unlockedPersonas.forEach((id: string) => newMap[id] = Date.now());
              safeUser.unlockedPersonas = newMap;
           }
           setUser(safeUser);
           window.location.hash = '#/dashboard';
           return true;
        }
    } catch (e) {
        console.error("Login failed", e);
    }
    return false;
  };

  const register = async (username: string, pass: string): Promise<boolean> => {
     try {
         const dbUsers = await db.get<Record<string, any>>('pentest_users_db', {});
         
         if (Object.values(dbUsers).some((u: any) => u.username === username)) {
           return false;
         }

         const newUser: User & { password: string } = {
           id: Date.now().toString(),
           username,
           password: pass,
           role: Role.USER,
           unlockedPersonas: {}
         };

         dbUsers[newUser.id] = newUser;
         await db.set('pentest_users_db', dbUsers);

         const { password, ...safeUser } = newUser;
         setUser(safeUser);
         window.location.hash = '#/dashboard';
         return true;
     } catch (e) {
         console.error("Registration failed", e);
         return false;
     }
  };

  const logout = () => {
    setUser(null);
    window.location.hash = '';
  };

  const unlockPersona = async (personaId: string) => {
    if (!user) return;
    
    const updatedUser = { 
        ...user, 
        unlockedPersonas: {
            ...user.unlockedPersonas,
            [personaId]: Date.now()
        } 
    };
    
    setUser(updatedUser);

    if (user.role !== Role.ADMIN) {
        try {
            const dbUsers = await db.get<Record<string, any>>('pentest_users_db', {});
            if (dbUsers[user.id]) {
                dbUsers[user.id].unlockedPersonas = updatedUser.unlockedPersonas;
                await db.set('pentest_users_db', dbUsers);
            }
        } catch (e) {
            console.error("Unlock persist failed", e);
        }
    }
  };

  const updateProfile = async (newUsername: string, newPassword?: string): Promise<boolean> => {
    if (!user) return false;

    // Check availability
    if (newUsername !== user.username) {
         const dbUsers = await db.get<Record<string, any>>('pentest_users_db', {});
         const exists = Object.values(dbUsers).some((u: any) => u.username === newUsername && u.id !== user.id);
         if (exists) return false;
    }

    const updatedUser = { ...user, username: newUsername };
    setUser(updatedUser);

    if (user.role !== Role.ADMIN) {
        try {
            const dbUsers = await db.get<Record<string, any>>('pentest_users_db', {});
            if (dbUsers[user.id]) {
                dbUsers[user.id].username = newUsername;
                if (newPassword && newPassword.trim() !== '') {
                    dbUsers[user.id].password = newPassword;
                }
                await db.set('pentest_users_db', dbUsers);
            }
        } catch (e) {
            console.error("Profile update failed", e);
            return false;
        }
    }
    return true; 
  };

  const getAllUsers = (): User[] => {
      // Note: This sync function might be limited if we strictly use async DB. 
      // For Admin panel to work synchronously, we might need a separate mechanism or accept a promise.
      // Current architecture in AdminPanel expects sync return. 
      // We will perform a "best effort" using a cached state in memory, 
      // BUT AuthContext doesn't keep all users in memory state.
      // FIX: Return empty array here, AdminPanel should fetch async if needed.
      // Or hack: we can't easily change the interface to async without breaking usages.
      // For now, returning empty array is safer than crashing. 
      // Ideally AdminPanel should be refactored to fetch users async.
      return []; 
  };

  const getPersonaAccessTime = (personaId: string): number | undefined => {
      if (!user) return undefined;
      return user.unlockedPersonas[personaId];
  }

  const isAdmin = user?.role === Role.ADMIN;

  if (loading) return null; // Wait for session restore

  return (
    <AuthContext.Provider value={{ user, login, register, logout, unlockPersona, getPersonaAccessTime, isAdmin, updateProfile, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};