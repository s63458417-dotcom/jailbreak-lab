import { GoogleGenAI, Content, Chat } from "@google/genai";
import { ChatMessage } from "../types";

// Interface for OpenAI-compatible sessions (HuggingFace, DeepSeek, etc.)
export interface CustomSession {
  isCustom: true;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: { role: string; content: string }[];
}

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<Chat | CustomSession> => {
  
  // 1. Resolve API Key
  // Note: process.env.API_KEY is replaced by string value during Vite build via vite.config.ts
  const envKey = process.env.API_KEY || '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey) {
    console.warn("API Key warning: No valid key found in environment or settings.");
    // We don't throw immediately here to allow UI to render, but the chat will fail if they try to send.
  }

  // 2. DETECT PROVIDER STRATEGY
  const isGenericEndpoint = baseUrl && (
    baseUrl.includes('huggingface') || 
    baseUrl.includes('deepseek') || 
    baseUrl.includes('openai') || 
    baseUrl.includes('v1') ||
    !modelName.toLowerCase().includes('gemini') 
  );

  if (isGenericEndpoint) {
    return {
      isCustom: true,
      modelName,
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey,
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
  const clientOptions: any = { apiKey: apiKey };
  if (baseUrl && baseUrl.trim().length > 0) {
    clientOptions.baseUrl = baseUrl;
  }
  
  const ai = new GoogleGenAI(clientOptions);

  const formattedHistory: Content[] = history
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

  try {
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: systemInstruction,
        },
        history: formattedHistory,
      });
      return chat;
  } catch (error) {
      console.error("Failed to create chat session:", error);
      throw error;
  }
};

export const sendMessageToGemini = async (
  chatSession: Chat | CustomSession,
  message: string
): Promise<string> => {
  if (!chatSession) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  // --- PATH A: GENERIC OPENAI-COMPATIBLE (HuggingFace/DeepSeek) ---
  if ('isCustom' in chatSession && chatSession.isCustom) {
      const session = chatSession as CustomSession;
      
      try {
        const payload = {
            model: session.modelName,
            messages: [
                { role: "system", content: session.systemInstruction },
                ...session.history,
                { role: "user", content: message }
            ],
            stream: false
        };

        const endpoint = `${session.baseUrl}/chat/completions`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.apiKey}`
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

        // Update local history for the session so subsequent messages maintain context
        session.history.push({ role: 'user', content: message });
        session.history.push({ role: 'assistant', content: reply });

        return reply;

      } catch (error: any) {
          console.error("Custom Endpoint Error:", error);
          throw new Error(`UPLINK FAILED: ${error.message}`);
      }
  }

  // --- PATH B: STANDARD GEMINI SDK ---
  try {
    const geminiChat = chatSession as Chat;
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