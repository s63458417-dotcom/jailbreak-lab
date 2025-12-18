
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from './types';
import { ADMIN_USERNAME, DEFAULT_ADMIN_PASS } from './constants';
import { supabase, isSupabaseConfigured } from './supabaseService';

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

const getLocalUsers = (): any => JSON.parse(localStorage.getItem('local_users_db') || '{}');
const saveLocalUsers = (db: any) => localStorage.setItem('local_users_db', JSON.stringify(db));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsersCache, setAllUsersCache] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem('pentest_session_id');
      if (!saved) {
        setLoading(false);
        return;
      }

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
        } catch (e) { console.error("Cloud restore failed", e); }
      } else {
        const db = getLocalUsers();
        if (db[saved]) {
          const u = db[saved];
          setUser({ id: u.id, username: u.username, role: u.role, unlockedPersonas: u.unlockedPersonas || {} });
        }
      }
      setLoading(false);
    };
    restore();
  }, []);

  const login = async (username: string, pass: string): Promise<boolean> => {
    if (username === ADMIN_USERNAME && pass === DEFAULT_ADMIN_PASS) {
      setUser({ id: 'admin', username: ADMIN_USERNAME, role: Role.ADMIN, unlockedPersonas: {} });
      localStorage.setItem('pentest_session_id', 'admin');
      window.location.hash = '#/dashboard';
      return true;
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('users_db').select('*').eq('username', username).eq('password', pass).maybeSingle();
        if (data && !error) {
          const u: User = { id: data.id, username: data.username, role: data.role as Role, unlockedPersonas: data.unlocked_personas || {} };
          setUser(u);
          localStorage.setItem('pentest_session_id', u.id);
          window.location.hash = '#/dashboard';
          return true;
        }
      } catch (e) { console.error("Cloud login error", e); }
    }

    const db = getLocalUsers();
    const found = Object.values(db).find((u: any) => u.username === username && u.password === pass) as any;
    if (found) {
      setUser({ id: found.id, username: found.username, role: found.role, unlockedPersonas: found.unlockedPersonas || {} });
      localStorage.setItem('pentest_session_id', found.id);
      window.location.hash = '#/dashboard';
      return true;
    }

    return false;
  };

  const register = async (username: string, pass: string): Promise<boolean> => {
    const id = Date.now().toString();
    const newUser = { id, username, password: pass, role: Role.USER, unlocked_personas: {} };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('users_db').insert(newUser);
        if (!error) return login(username, pass);
        if (error.code === '23505') return false; 
      } catch (e) { console.error("Register crash", e); }
    }

    const db = getLocalUsers();
    if (Object.values(db).some((u: any) => u.username === username)) return false;
    db[id] = { ...newUser, unlockedPersonas: {} };
    saveLocalUsers(db);
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
    } else {
      const db = getLocalUsers();
      if (db[user.id]) {
        db[user.id].unlockedPersonas = next;
        saveLocalUsers(db);
      }
    }
  };

  const updateProfile = async (newUsername: string, newPassword?: string) => {
      if (!user || user.id === 'admin') return true;
      const updates: any = { username: newUsername };
      if (newPassword) updates.password = newPassword;

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('users_db').update(updates).eq('id', user.id);
        if (error) return false;
      } else {
        const db = getLocalUsers();
        if (db[user.id]) {
          db[user.id].username = newUsername;
          if (newPassword) db[user.id].password = newPassword;
          saveLocalUsers(db);
        }
      }
      
      setUser({ ...user, username: newUsername });
      return true;
  };

  const getAllUsers = () => allUsersCache;

  useEffect(() => {
    if (user?.role === Role.ADMIN) {
      if (isSupabaseConfigured()) {
        supabase.from('users_db').select('id, username, role, unlocked_personas').then(({ data }) => {
          if (data) setAllUsersCache(data.map(d => ({
            id: d.id, username: d.username, role: d.role as Role, unlockedPersonas: d.unlocked_personas || {}
          })));
        });
      } else {
        const db = getLocalUsers();
        setAllUsersCache(Object.values(db).map((u: any) => ({
          id: u.id, username: u.username, role: u.role, unlockedPersonas: u.unlockedPersonas || {}
        })));
      }
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
