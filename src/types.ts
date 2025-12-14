
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: string;
  username: string;
  email?: string; 
  role: Role;
  unlockedPersonas: Record<string, number>; 
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isLocked: boolean;
  accessKey?: string; 
  accessDuration?: number; 
  model: string;
  baseUrl?: string; 
  customApiKey?: string; 
  avatar: string; 
  avatarUrl?: string; 
  themeColor?: string; 
  rateLimit?: number; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// UPGRADED: Supports multiple sessions per persona
export interface ChatSession {
  id: string;         // Unique Session ID (UUID)
  personaId: string;  // Which AI is this?
  userId: string;     // Who owns this?
  title: string;      // "Operation Alpha", "Debug Session", etc.
  messages: ChatMessage[];
  createdAt: number;
  lastModified: number;
}

export interface SystemConfig {
  appName: string;
  creatorName: string;
  logoUrl: string;
}

export interface StoredData {
  users: User[]; 
  personas: Persona[];
  sessions: Record<string, ChatSession>; // Changed from 'chats' to 'sessions'
  config: SystemConfig;
}
