import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials from LocalStorage if set via UI, otherwise fallback to env
const getSupabaseConfig = () => {
  const uiUrl = localStorage.getItem('supabase_url');
  const uiKey = localStorage.getItem('supabase_key');
  
  const envUrl = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '';
  const envKey = (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || '';

  return {
    url: uiUrl || envUrl,
    key: uiKey || envKey
  };
};

const config = getSupabaseConfig();

// Initial client (might be invalid until configured)
export let supabase: SupabaseClient = createClient(
  config.url || 'https://placeholder-project.supabase.co', 
  config.key || 'placeholder-key'
);

export const initSupabase = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  supabase = createClient(url, key);
  return supabase;
};

export const isSupabaseConfigured = () => {
  const { url, key } = getSupabaseConfig();
  return url && url.includes('supabase.co') && key && key.length > 20;
};
