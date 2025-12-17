
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

export interface AISession {
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[];
  isGeneric: boolean;
}

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<AISession> => {
  const envKey = process.env.API_KEY || '';
  let apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  // Clean the key minimally - only whitespace
  apiKey = apiKey ? apiKey.trim() : '';

  if (!apiKey) {
    throw new Error("MISSING_API_KEY: Authentication token required.");
  }

  // LOGIC FIX: If a baseUrl is provided that isn't Google, it MUST be generic.
  const isGeneric = !!(baseUrl && !baseUrl.includes('googleapis.com'));
  
  return {
    modelName,
    baseUrl,
    apiKey,
    systemInstruction,
    history: [...history],
    isGeneric
  };
};

export const sendMessageToGemini = async (
  session: AISession,
  message: string
): Promise<string> => {
  if (!session) throw new Error("SESSION_INVALID");

  if (session.isGeneric) {
    // OpenAI Compatible Path (HuggingFace, DeepSeek, local LLMs)
    const endpoint = session.baseUrl?.endsWith('/') 
      ? `${session.baseUrl}chat/completions` 
      : `${session.baseUrl}/chat/completions`;
    
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
        const errBody = await response.text();
        throw new Error(`API UPLINK REJECTED (${response.status}): ${errBody.substring(0, 100)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "Provider returned empty buffer.";
    } catch (err: any) {
      throw new Error(`PROVIDER CONNECTION FAILED: ${err.message}`);
    }
  }

  // Google Gemini Path
  try {
    const ai = new GoogleGenAI({ apiKey: session.apiKey });
    const contents = session.history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: session.modelName,
      contents: contents,
      config: {
        systemInstruction: session.systemInstruction,
        temperature: 0.7,
      }
    });

    const reply = response.text;
    if (!reply) throw new Error("GEMINI_EMPTY_RESPONSE");

    return reply;
  } catch (err: any) {
    throw new Error(`GEMINI UPLINK ERROR: ${err.message}`);
  }
};
