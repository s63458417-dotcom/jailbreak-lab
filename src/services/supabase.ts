
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  // 1. Check process.env (Standard for Vercel/Netlify/Vite)
  // Fix: Cast import.meta to any to access .env property safely when type definitions are missing
  const envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '';
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || '';
  
  // 2. Fallback to LocalStorage (User/Admin manual override)
  const uiUrl = localStorage.getItem('supabase_url');
  const uiKey = localStorage.getItem('supabase_key');

  return {
    url: uiUrl || envUrl,
    key: uiKey || envKey
  };
};

const config = getSupabaseConfig();

// Initialize the client. We use a placeholder if nothing is found to prevent crashing.
export let supabase: SupabaseClient = createClient(
  config.url || 'https://placeholder.supabase.co', 
  config.key || 'placeholder'
);

export const initSupabase = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  supabase = createClient(url, key);
  return supabase;
};

export const isSupabaseConfigured = () => {
  const { url, key } = getSupabaseConfig();
  // We return true if the URL looks valid, allowing the app to attempt connection
  return !!(url && url.includes('supabase.co') && key && key.length > 10);
};
