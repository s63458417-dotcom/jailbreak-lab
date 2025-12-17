
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { ADMIN_USERNAME, DEFAULT_ADMIN_PASS } from '../constants';
import { supabase } from '../services/supabase';

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
          } else {
             const { data } = await supabase.from('users_db').select('*').eq('id', saved).single();
             if (data) {
                 setUser({
                     id: data.id,
                     username: data.username,
                     role: data.role as Role,
                     unlockedPersonas: data.unlocked_personas || {}
                 });
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

    const { data, error } = await supabase.from('users_db').select('*').eq('username', username).eq('password', pass).single();
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
    const id = Date.now().toString();
    const { error } = await supabase.from('users_db').insert({
        id, username, password: pass, role: Role.USER, unlocked_personas: {}
    });
    
    if (error) {
        console.error("Supabase Auth Error:", error);
        // If error is 404, the user likely hasn't run the SQL schema
        if (error.code === '42P01') {
           alert("DATABASE ERROR: The 'users_db' table does not exist in your Supabase project. Please run the provided SQL schema in the Supabase SQL Editor.");
        } else if (error.code === '23505') {
           alert("REGISTRATION FAILED: This codename is already registered in the system.");
        } else {
           alert(`REGISTRATION FAILED: ${error.message}`);
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
    await supabase.from('users_db').update({ unlocked_personas: next }).eq('id', user.id);
  };

  const updateProfile = async (newUsername: string, newPassword?: string) => {
      if (!user || user.id === 'admin') return true;
      const updates: any = { username: newUsername };
      if (newPassword) updates.password = newPassword;
      const { error } = await supabase.from('users_db').update(updates).eq('id', user.id);
      if (!error) setUser({ ...user, username: newUsername });
      return !error;
  };

  const getAllUsers = () => {
      return allUsersCache;
  };

  useEffect(() => {
      if (user?.role === Role.ADMIN) {
          supabase.from('users_db').select('id, username, role, unlocked_personas').then(({ data }) => {
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
