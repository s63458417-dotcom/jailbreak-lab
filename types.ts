export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: string;
  username: string;
  email?: string; // Used for legacy or optional contact
  role: Role;
  unlockedPersonas: Record<string, number>; // Map of Persona ID to Timestamp (when unlocked)
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isLocked: boolean;
  accessKey?: string; // Only visible to admin in edit mode
  accessDuration?: number; // Duration in hours. 0 or null/undefined means permanent once unlocked.
  model: string;
  baseUrl?: string; // For custom endpoints/proxies
  customApiKey?: string; // For endpoints requiring specific keys (HuggingFace, etc)
  avatar: string; // Icon type ID
  avatarUrl?: string; // Custom image URL for avatar
  themeColor?: string; // Custom hex color
  rateLimit?: number; // Daily message limit per user. 0 or undefined means unlimited.
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  personaId: string;
  messages: ChatMessage[];
}

export interface SystemConfig {
  appName: string;
  creatorName: string;
  logoUrl: string;
}

// For local storage persistence
export interface StoredData {
  users: User[]; // In a real app, this is a DB
  personas: Persona[];
  chats: Record<string, ChatSession>; // Key is user_id + persona_id
  config: SystemConfig;
}