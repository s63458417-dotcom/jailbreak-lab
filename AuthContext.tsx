
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsersCache, setAllUsersCache] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem('pentest_session_id');
      if (!saved) { setLoading(false); return; }

      if (saved === 'admin') {
        setUser({ id: 'admin', username: ADMIN_USERNAME, role: Role.ADMIN, unlockedPersonas: {} });
      } else if (isSupabaseConfigured()) {
        const { data } = await supabase.from('users_db').select('*').eq('id', saved).maybeSingle();
        if (data) {
          setUser({ id: data.id, username: data.username, role: data.role as Role, unlockedPersonas: data.unlocked_personas || {} });
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
      const { data } = await supabase.from('users_db').select('*').eq('username', username).eq('password', pass).maybeSingle();
      if (data) {
        setUser({ id: data.id, username: data.username, role: data.role as Role, unlockedPersonas: data.unlocked_personas || {} });
        localStorage.setItem('pentest_session_id', data.id);
        window.location.hash = '#/dashboard';
        return true;
      }
    }
    return false;
  };

  const register = async (username: string, pass: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const id = Date.now().toString();
    const { error } = await supabase.from('users_db').insert({ id, username, password: pass, role: Role.USER, unlocked_personas: {} });
    if (!error) return login(username, pass);
    return false;
  };

  const logout = () => { setUser(null); localStorage.removeItem('pentest_session_id'); window.location.hash = ''; };

  const unlockPersona = async (personaId: string) => {
    if (!user || user.id === 'admin') return;
    const next = { ...user.unlockedPersonas, [personaId]: Date.now() };
    setUser({ ...user, unlockedPersonas: next });
    if (isSupabaseConfigured()) await supabase.from('users_db').update({ unlocked_personas: next }).eq('id', user.id);
  };

  const updateProfile = async (newUsername: string, newPassword?: string) => {
      if (!user || user.id === 'admin') return true;
      const updates: any = { username: newUsername };
      if (newPassword) updates.password = newPassword;
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('users_db').update(updates).eq('id', user.id);
        if (error) return false;
      }
      setUser({ ...user, username: newUsername });
      return true;
  };

  const getAllUsers = () => allUsersCache;

  useEffect(() => {
    if (user?.role === Role.ADMIN && isSupabaseConfigured()) {
      supabase.from('users_db').select('id, username, role, unlocked_personas').then(({ data }) => {
        if (data) setAllUsersCache(data.map(d => ({ id: d.id, username: d.username, role: d.role as Role, unlockedPersonas: d.unlocked_personas || {} })));
      });
    }
  }, [user]);

  if (loading) return null;
  return (
    <AuthContext.Provider value={{ user, login, register, logout, unlockPersona, getPersonaAccessTime: (id) => user?.unlockedPersonas[id], isAdmin: user?.role === Role.ADMIN, updateProfile, getAllUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth error');
  return context;
};
