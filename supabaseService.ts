
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const CLOUD_URL = 'https://ofislzhftkamnippyjnd.supabase.co';
const CLOUD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maXNsemhmdGthbW5pcHB5am5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY5NDMsImV4cCI6MjA4MDk2Mjk0M30.4WWAAeSgoubP1heaRKsnM6e6dP19SYkF8vIaE8ZWLyw';

const getSupabaseConfig = () => {
  const uiUrl = localStorage.getItem('supabase_url');
  const uiKey = localStorage.getItem('supabase_key');
  return {
    url: uiUrl || CLOUD_URL,
    key: uiKey || CLOUD_KEY
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
  return !!(cfg.url && cfg.url.includes('supabase.co') && cfg.key && cfg.key.length > 20);
};
