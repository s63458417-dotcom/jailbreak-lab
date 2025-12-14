import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { ADMIN_USERNAME, DEFAULT_ADMIN_PASS } from '../constants';

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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pentest_user_session');
      if (!saved) return null;
      
      const parsedUser = JSON.parse(saved);
      
      if (Array.isArray(parsedUser.unlockedPersonas)) {
          const newMap: Record<string, number> = {};
          parsedUser.unlockedPersonas.forEach((id: string) => {
              newMap[id] = Date.now(); 
          });
          parsedUser.unlockedPersonas = newMap;
      }
      
      return parsedUser;
    } catch (e) {
      console.error("Session restore failed", e);
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('pentest_user_session', JSON.stringify(user));
      } else {
        localStorage.removeItem('pentest_user_session');
      }
    } catch (e) {
      console.error("Local storage error", e);
    }
  }, [user]);

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
        const dbStr = localStorage.getItem('pentest_users_db');
        const db: Record<string, any> = dbStr ? JSON.parse(dbStr) : {};
        
        const foundUser = Object.values(db).find((u: any) => u.username === username && u.password === pass) as any;
        
        if (foundUser) {
           const { password, ...safeUser } = foundUser;
           
           if (Array.isArray(safeUser.unlockedPersonas)) {
              const newMap: Record<string, number> = {};
              safeUser.unlockedPersonas.forEach((id: string) => {
                  newMap[id] = Date.now();
              });
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
         const dbStr = localStorage.getItem('pentest_users_db');
         let db: Record<string, any> = {};
         
         try {
            db = dbStr ? JSON.parse(dbStr) : {};
         } catch (e) {
             console.warn("Resetting corrupted DB");
             db = {};
         }

         if (Object.values(db).some((u: any) => u.username === username)) {
           return false;
         }

         const newUser: User & { password: string } = {
           id: Date.now().toString(),
           username,
           password: pass,
           role: Role.USER,
           unlockedPersonas: {}
         };

         db[newUser.id] = newUser;
         localStorage.setItem('pentest_users_db', JSON.stringify(db));

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

  const unlockPersona = (personaId: string) => {
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
            const dbStr = localStorage.getItem('pentest_users_db');
            if (dbStr) {
                const db = JSON.parse(dbStr);
                if (db[user.id]) {
                    db[user.id].unlockedPersonas = updatedUser.unlockedPersonas;
                    localStorage.setItem('pentest_users_db', JSON.stringify(db));
                }
            }
        } catch (e) {
            console.error("Failed to persist unlock", e);
        }
    }
  };

  const updateProfile = async (newUsername: string, newPassword?: string): Promise<boolean> => {
    if (!user) return false;

    if (newUsername !== user.username) {
         const dbStr = localStorage.getItem('pentest_users_db');
         if (dbStr) {
             const db = JSON.parse(dbStr);
             const exists = Object.values(db).some((u: any) => u.username === newUsername && u.id !== user.id);
             if (exists) return false; 
         }
    }

    const updatedUser = { ...user, username: newUsername };
    setUser(updatedUser);

    if (user.role !== Role.ADMIN) {
        try {
            const dbStr = localStorage.getItem('pentest_users_db');
            if (dbStr) {
                const db = JSON.parse(dbStr);
                if (db[user.id]) {
                    db[user.id].username = newUsername;
                    if (newPassword && newPassword.trim() !== '') {
                        db[user.id].password = newPassword;
                    }
                    localStorage.setItem('pentest_users_db', JSON.stringify(db));
                }
            }
            return true;
        } catch (e) {
            console.error("Failed to update profile", e);
            return false;
        }
    }
    return true; 
  };

  const getAllUsers = (): User[] => {
    try {
        const dbStr = localStorage.getItem('pentest_users_db');
        if (!dbStr) return [];
        const db = JSON.parse(dbStr);
        return Object.values(db).map((u: any) => {
            const { password, ...rest } = u;
            return rest;
        });
    } catch (e) {
        return [];
    }
  };

  const getPersonaAccessTime = (personaId: string): number | undefined => {
      if (!user) return undefined;
      return user.unlockedPersonas[personaId];
  }

  const isAdmin = user?.role === Role.ADMIN;

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