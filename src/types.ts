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

export interface ChatSession {
  personaId: string;
  messages: ChatMessage[];
}

export interface SystemConfig {
  appName: string;
  creatorName: string;
  logoUrl: string;
}

export interface StoredData {
  users: User[]; 
  personas: Persona[];
  chats: Record<string, ChatSession>; 
  config: SystemConfig;
}