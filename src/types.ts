
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

// New Interface for Token Boxes
export interface KeyPool {
  id: string;
  name: string;
  provider: 'google' | 'openai' | 'custom'; // For UI sorting
  keys: string[]; // List of all keys
  deadKeys: Record<string, number>; // Map of Key -> Timestamp when it failed
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
  customApiKey?: string; // Legacy/Single override
  keyPoolId?: string; // Link to a Key Vault
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

export interface SystemConfig {
  appName: string;
  creatorName: string;
  logoUrl: string;
}
