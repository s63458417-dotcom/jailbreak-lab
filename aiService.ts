
import { ChatMessage } from "./types";

export interface AISession {
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
}

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  return {
    modelName: modelName || '',
    baseUrl: baseUrl || '',
    apiKey: customApiKey || '',
    systemInstruction,
    history: [...history]
  };
};

export const sendMessageToAI = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session.baseUrl) throw new Error("MISSING_ENDPOINT: Set Base URL in Admin.");
  
  // Standardize endpoint
  let endpoint = session.baseUrl;
  if (!endpoint.endsWith('/chat/completions') && !endpoint.includes('?')) {
      endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
  }
  
  try {
    const messages = [
      { role: "system", content: session.systemInstruction },
      ...session.history.map(m => ({ 
        role: m.role === 'model' ? 'assistant' : 'user', 
        content: m.text 
      })),
      { role: "user", content: message }
    ];

    const body: any = {
      messages,
      stream: false
    };

    // Only include model if specified (some proxies/uplinks don't require/want it)
    if (session.modelName && session.modelName.trim().length > 0) {
      body.model = session.modelName;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only include Auth header if key is provided
    if (session.apiKey && session.apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${session.apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Provider Error ${response.status}: ${errData.substring(0, 100)}`);
    }

    const data = await response.json();
    // Support various response formats (OpenAI standard vs others)
    return data.choices?.[0]?.message?.content || data.content || data.response || "No response received.";
  } catch (err: any) {
    throw new Error(`CONNECTION_ERROR: ${err.message}`);
  }
};
