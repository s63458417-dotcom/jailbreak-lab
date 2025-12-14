import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

// Unified Session State Interface
// This replaces the SDK's internal state management
export interface ApiSession {
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  systemInstruction: string;
  // We store a unified history format here
  history: { role: string; content: string }[];
}

/**
 * Initializes a session object. 
 * Instead of connecting immediately, this prepares the state/config 
 * used for subsequent fetch calls.
 */
export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<ApiSession> => {
  
  // 1. Resolve API Key
  // Polyfilled by vite.config.ts during build
  const envKey = process.env.API_KEY || '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey) {
    console.warn("API Key warning: No valid key found. Requests may fail.");
  }

  // 2. Prepare History
  // Convert the app's ChatMessage format to a simpler internal format
  const formattedHistory = history
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map(msg => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.text
    }));

  // 3. Return Session State
  return {
    modelName,
    baseUrl: baseUrl ? baseUrl.replace(/\/$/, '') : undefined,
    apiKey,
    systemInstruction,
    history: formattedHistory
  };
};

/**
 * Sends a message using standard fetch.
 * Switches logic based on whether a custom baseUrl is provided.
 */
export const sendMessageToGemini = async (
  session: ApiSession,
  message: string
): Promise<string> => {
  if (!session) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  const isCustomEndpoint = !!session.baseUrl;

  try {
    let reply = "";

    // --- STRATEGY A: CUSTOM / OPENAI COMPATIBLE ENDPOINT ---
    if (isCustomEndpoint) {
      const payload = {
        model: session.modelName,
        messages: [
          { role: "system", content: session.systemInstruction },
          ...session.history,
          { role: "user", content: message }
        ],
        stream: false
      };

      // Assume standard /v1/chat/completions structure for custom endpoints
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
        throw new Error(`Custom API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || "";
    } 
    
    // --- STRATEGY B: GOOGLE GEMINI SDK ---
    else {
      // Initialize SDK
      const ai = new GoogleGenAI({ apiKey: session.apiKey });
      
      // Prepare contents from history
      // Map "assistant" (from our internal history) -> "model" (for Gemini API)
      const historyContents = session.history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));
      
      // Add current message
      historyContents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      // Use generateContent for stateless request with history
      const response = await ai.models.generateContent({
        model: session.modelName,
        contents: historyContents,
        config: {
          systemInstruction: session.systemInstruction,
        }
      });
      
      reply = response.text || "";
    }

    if (!reply) throw new Error("Empty response from model.");

    // Update Local Session History
    session.history.push({ role: 'user', content: message });
    session.history.push({ role: 'assistant', content: reply });

    return reply;

  } catch (error: any) {
    console.error("API Request Failed:", error);
    throw new Error(`UPLINK FAILED: ${error.message}`);
  }
};