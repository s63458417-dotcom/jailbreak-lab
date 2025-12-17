
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { ADMIN_USERNAME, DEFAULT_ADMIN_PASS } from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabase';

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
  const [allUsersCache, setAllUsersCache] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem('pentest_session_id');
      if (saved) {
          if (saved === 'admin') {
             setUser({ id: 'admin', username: ADMIN_USERNAME, role: Role.ADMIN, unlockedPersonas: {} });
          } else if (isSupabaseConfigured()) {
             try {
                const { data, error } = await supabase.from('users_db').select('*').eq('id', saved).maybeSingle();
                if (data && !error) {
                    setUser({
                        id: data.id,
                        username: data.username,
                        role: data.role as Role,
                        unlockedPersonas: data.unlocked_personas || {}
                    });
                } else {
                    localStorage.removeItem('pentest_session_id');
                }
             } catch (e) {
                 console.error("Auth Restore Failure:", e);
             }
          }
      }
      setLoading(false);
    };
    restore();
  }, []);

  const login = async (username: string, pass: string): Promise<boolean> => {
    if (username === ADMIN_USERNAME && pass === DEFAULT_ADMIN_PASS) {
      const admin: User = { id: 'admin', username: ADMIN_USERNAME, role: Role.ADMIN, unlockedPersonas: {} };
      setUser(admin);
      localStorage.setItem('pentest_session_id', 'admin');
      window.location.hash = '#/dashboard';
      return true;
    }

    if (!isSupabaseConfigured()) {
        alert("Database uplink not active. Only local admin access permitted.");
        return false;
    }

    const { data, error } = await supabase.from('users_db').select('*').eq('username', username).eq('password', pass).maybeSingle();
    
    if (error) {
        console.error("Login Database Error:", error);
        if (error.code === '42P01') alert("CRITICAL: Database tables are missing. Go to Supabase SQL editor and run the schema.");
        return false;
    }

    if (data) {
      const u: User = { id: data.id, username: data.username, role: data.role as Role, unlockedPersonas: data.unlocked_personas || {} };
      setUser(u);
      localStorage.setItem('pentest_session_id', u.id);
      window.location.hash = '#/dashboard';
      return true;
    }
    return false;
  };

  const register = async (username: string, pass: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
        alert("Action Restricted: No cloud database connection.");
        return false;
    }

    const id = Date.now().toString();
    const { error } = await supabase.from('users_db').insert({
        id, username, password: pass, role: Role.USER, unlocked_personas: {} 
    });
    
    if (error) {
        console.error("Registration Uplink Error:", error);
        if (error.code === '42P01') {
           alert("UPLINK FAILURE: The table 'users_db' does not exist. Check SQL Editor.");
        } else if (error.code === '23505') {
           alert("IDENTITY CLASH: Codename already registered.");
        } else {
           alert(`REGISTRATION ERROR: ${error.message}`);
        }
        return false;
    }
    
    return login(username, pass);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pentest_session_id');
    window.location.hash = '';
  };

  const unlockPersona = async (personaId: string) => {
    if (!user || user.id === 'admin') return;
    const next = { ...user.unlockedPersonas, [personaId]: Date.now() };
    setUser({ ...user, unlockedPersonas: next });
    if (isSupabaseConfigured()) {
        await supabase.from('users_db').update({ unlocked_personas: next }).eq('id', user.id);
    }
  };

  const updateProfile = async (newUsername: string, newPassword?: string) => {
      if (!user || user.id === 'admin') return true;
      const updates: any = { username: newUsername };
      if (newPassword) updates.password = newPassword;
      
      const { error } = await supabase.from('users_db').update(updates).eq('id', user.id);
      if (!error) {
          setUser({ ...user, username: newUsername });
          return true;
      }
      return false;
  };

  const getAllUsers = () => {
      return allUsersCache;
  };

  useEffect(() => {
      if (user?.role === Role.ADMIN && isSupabaseConfigured()) {
          supabase.from('users_db').select('id, username, role, unlocked_personas').then(({ data, error }) => {
              if (error) console.error("Admin Fetch Users Error:", error);
              if (data) setAllUsersCache(data.map(d => ({
                  id: d.id, username: d.username, role: d.role as Role, unlockedPersonas: d.unlocked_personas || {}
              })));
          });
      }
  }, [user]);

  const getPersonaAccessTime = (id: string) => user?.unlockedPersonas[id];
  const isAdmin = user?.role === Role.ADMIN;

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, unlockPersona, getPersonaAccessTime, isAdmin, updateProfile, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth error');
  return context;
};
