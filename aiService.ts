
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
  if (!session.baseUrl) throw new Error("ENDPOINT_REQUIRED: Please set the Base URL in the Admin Panel.");
  
  const url = session.baseUrl;
  const isGoogle = url.includes('generativelanguage.googleapis.com');
  
  try {
    let finalUrl = url;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: any;

    if (isGoogle) {
      // --- BRANCH A: GOOGLE NATIVE PROTOCOL ---
      headers['x-goog-api-key'] = session.apiKey;
      
      body = {
        contents: [
          ...session.history.map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ],
        systemInstruction: {
          parts: [{ text: session.systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      };
    } else {
      // --- BRANCH B: OPENAI / HUGGING FACE / GENERIC PROTOCOL ---
      if (session.apiKey) {
        headers['Authorization'] = `Bearer ${session.apiKey}`;
      }

      // Automatically handle v1 base URLs
      if (finalUrl.includes('/v1') && !finalUrl.endsWith('/chat/completions') && !finalUrl.includes('?')) {
        finalUrl = finalUrl.replace(/\/$/, '') + '/chat/completions';
      }

      const messages = [
        { role: "system", content: session.systemInstruction },
        ...session.history.map(m => ({ 
          role: m.role === 'model' ? 'assistant' : 'user', 
          content: m.text 
        })),
        { role: "user", content: message }
      ];

      body = {
        messages,
        stream: false,
        temperature: 0.7
      };

      // Only include 'model' if provided by the admin. 
      // This allows direct HF model endpoints or proxies to work without conflict.
      if (session.modelName && session.modelName.trim().length > 0) {
        body.model = session.modelName;
      }
    }

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Uplink Error ${response.status}: ${errorData.substring(0, 200)}`);
    }

    const data = await response.json();

    // Dynamically parse based on protocol
    if (isGoogle) {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No text returned from Gemini.";
    } else {
      // Handles OpenAI, DeepSeek, and HF Router formats
      return data.choices?.[0]?.message?.content || data.content || data.response || "No valid response field found.";
    }
  } catch (err: any) {
    throw new Error(`UPLINK_FAILURE: ${err.message}`);
  }
};
