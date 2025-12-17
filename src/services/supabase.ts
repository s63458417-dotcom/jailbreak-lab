
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Hardcoded credentials as requested for direct file-based configuration
const HARDCODED_URL = 'https://ofislzhftkamnippyjnd.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXNsemhmdGthbW5pcHB5am5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY5NDMsImV4cCI6MjA4MDk2Mjk0M30.4WWAAeSgoubP1heaRKsnM6e6dP19SYkF8vIaE8ZWLyw';

const getSupabaseConfig = () => {
  // Priority: 1. Local Storage (Dev override) 2. Environment Variables 3. Hardcoded Fallback
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  
  const uiUrl = localStorage.getItem('supabase_url');
  const uiKey = localStorage.getItem('supabase_key');

  return {
    url: uiUrl || envUrl || HARDCODED_URL,
    key: uiKey || envKey || HARDCODED_KEY
  };
};

const config = getSupabaseConfig();

export let supabase: SupabaseClient = createClient(config.url, config.key);

export const initSupabase = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  supabase = createClient(url, key);
  return supabase;
};

export const isSupabaseConfigured = () => {
  const cfg = getSupabaseConfig();
  // We return true if the URL points to a supabase instance and the key is long enough
  return !!(cfg.url && cfg.url.includes('supabase.co') && cfg.key && cfg.key.length > 20);
};
