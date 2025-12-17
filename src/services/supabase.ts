import { createClient } from '@supabase/supabase-js';

// These environment variables must be provided in the hosting environment
const supabaseUrl = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || '';
const supabaseAnonKey = (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * DATABASE SCHEMA REQUIREMENTS (Run this in Supabase SQL Editor):
 * 
 * create table if not exists personas (
 *   id text primary key,
 *   name text not null,
 *   description text,
 *   system_prompt text,
 *   is_locked boolean default false,
 *   access_key text,
 *   access_duration numeric,
 *   model text,
 *   base_url text,
 *   custom_api_key text,
 *   key_pool_id text,
 *   avatar text,
 *   avatar_url text,
 *   theme_color text,
 *   rate_limit integer,
 *   updated_at timestamp with time zone default now()
 * );
 * 
 * create table if not exists key_pools (
 *   id text primary key,
 *   name text not null,
 *   provider text,
 *   keys text[],
 *   dead_keys jsonb default '{}'::jsonb,
 *   updated_at timestamp with time zone default now()
 * );
 * 
 * create table if not exists system_config (
 *   id text primary key, -- use 'global'
 *   app_name text,
 *   creator_name text,
 *   logo_url text,
 *   updated_at timestamp with time zone default now()
 * );
 * 
 * create table if not exists users_db (
 *   id text primary key,
 *   username text unique,
 *   password text,
 *   role text,
 *   unlocked_personas jsonb default '{}'::jsonb,
 *   created_at timestamp with time zone default now()
 * );
 * 
 * create table if not exists chats (
 *   id text primary key, -- user_id + persona_id
 *   user_id text,
 *   persona_id text,
 *   messages jsonb default '[]'::jsonb,
 *   updated_at timestamp with time zone default now()
 * );
 */