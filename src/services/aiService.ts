
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

export interface AISession {
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
  provider: 'gemini' | 'openai-compat';
}

/**
 * Creates a session object containing all configuration needed for AI inference.
 * No SDK initialization happens here to avoid startup environment errors.
 */
export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  const envKey = process.env.API_KEY || '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  // Determine provider: If a custom URL is provided that isn't Google, treat as generic OpenAI-compatible
  const isGemini = !baseUrl || baseUrl.includes('googleapis.com');
  const provider = isGemini ? 'gemini' : 'openai-compat';
  
  return {
    modelName,
    baseUrl,
    apiKey,
    systemInstruction,
    history: [...history],
    provider
  };
};

/**
 * Sends a message to the AI provider defined in the session.
 */
export const sendMessageToAI = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session) throw new Error("SESSION_NULL");

  // --- PATH A: OPENAI-COMPATIBLE (Custom URLs / Third-party APIs) ---
  if (session.provider === 'openai-compat') {
    let endpoint = session.baseUrl || '';
    if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
    }
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.apiKey}`
        },
        body: JSON.stringify({
          model: session.modelName,
          messages: [
            { role: "system", content: session.systemInstruction },
            ...session.history.map(m => ({ 
              role: m.role === 'model' ? 'assistant' : 'user', 
              content: m.text 
            })),
            { role: "user", content: message }
          ]
        })
      });

      if (!response.ok) {
          const raw = await response.text();
          throw new Error(`Endpoint Error (${response.status}): ${raw.substring(0, 100)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No content returned from custom provider.";
    } catch (err: any) {
      throw new Error(`UPLINK_FAILURE: ${err.message}`);
    }
  }

  // --- PATH B: GOOGLE GEMINI (Native SDK) ---
  // Lazy initialization of the SDK prevents global startup crashes if the key is missing.
  if (!session.apiKey || session.apiKey.length < 5) {
      return "**CONFIGURATION_REQUIRED:** No valid API Key detected for Gemini. Please check your persona configuration or deployment environment.";
  }

  try {
    // Initialize exactly when needed
    const ai = new GoogleGenAI({ apiKey: session.apiKey });
    
    const contents = session.history.map(m => ({ 
      role: m.role, 
      parts: [{ text: m.text }] 
    }));
    
    contents.push({ 
      role: 'user', 
      parts: [{ text: message }] 
    });

    const response = await ai.models.generateContent({
      model: session.modelName || 'gemini-3-flash-preview',
      contents,
      config: { 
        systemInstruction: session.systemInstruction, 
        temperature: 0.7 
      }
    });

    // Access .text property directly as per Guidelines
    return response.text || "The AI returned an empty response.";
  } catch (err: any) {
    if (err.message?.includes('API_KEY_INVALID')) {
        return "**ACCESS_DENIED:** Gemini API key is invalid or unauthorized.";
    }
    return `**AI_UPLINK_ERROR:** ${err.message || "Unknown error during inference."}`;
  }
};
