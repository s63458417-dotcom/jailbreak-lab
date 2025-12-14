import { GoogleGenAI, Chat, Content } from "@google/genai";
import { ChatMessage } from "../types";

// Interface for Custom/OpenAI-compatible sessions
export interface CustomSession {
  isCustom: true;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: { role: string; content: string }[];
}

export type ChatSession = Chat | CustomSession;

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<ChatSession> => {
  
  // 1. Resolve API Key for Custom Endpoints
  const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  const resolvedKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  // 2. DETECT PROVIDER STRATEGY
  const isGenericEndpoint = baseUrl && (
    baseUrl.includes('huggingface') || 
    baseUrl.includes('deepseek') || 
    baseUrl.includes('openai') || 
    baseUrl.includes('v1') ||
    !modelName.toLowerCase().includes('gemini') 
  );

  if (isGenericEndpoint) {
    if (!resolvedKey) {
        console.warn("System Warning: No API key detected for custom endpoint.");
    }
    return {
      isCustom: true,
      modelName,
      baseUrl: baseUrl!.replace(/\/$/, ''),
      apiKey: resolvedKey,
      systemInstruction,
      history: history
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(msg => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text
        }))
    };
  }

  // 3. STANDARD GEMINI SDK INITIALIZATION
  // Must use new GoogleGenAI({ apiKey: process.env.API_KEY }) as per guidelines.
  // We prioritize the environment key for the official SDK.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const formattedHistory: Content[] = history
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

  const chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction: systemInstruction,
    },
    history: formattedHistory,
  });
  
  return chat;
};

export const sendMessageToGemini = async (
  session: ChatSession,
  message: string
): Promise<string> => {
  if (!session) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  // --- PATH A: GENERIC OPENAI-COMPATIBLE ---
  if ('isCustom' in session) {
      const customSession = session as CustomSession;
      
      try {
        const payload = {
            model: customSession.modelName,
            messages: [
                { role: "system", content: customSession.systemInstruction },
                ...customSession.history,
                { role: "user", content: message }
            ],
            stream: false
        };

        const endpoint = `${customSession.baseUrl}/chat/completions`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customSession.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`External API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "";

        if (!reply) throw new Error("Empty response from external model.");

        customSession.history.push({ role: 'user', content: message });
        customSession.history.push({ role: 'assistant', content: reply });

        return reply;

      } catch (error: any) {
          console.error("Custom Endpoint Error:", error);
          throw new Error(`UPLINK FAILED: ${error.message}`);
      }
  }

  // --- PATH B: STANDARD GEMINI SDK ---
  try {
    const geminiChat = session as Chat;
    const response = await geminiChat.sendMessage({
      message: message,
    });
    
    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message && error.message.includes('403')) {
        throw new Error("ACCESS_DENIED: API Key invalid or quota exceeded.");
    }
    throw new Error(`UPLINK FAILED: ${error.message || "Connection dropped"}`);
  }
};