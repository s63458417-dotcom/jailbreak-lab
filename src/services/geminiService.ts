import { ChatMessage } from "../types";

// Unified Session State Interface
// We define our own type so we don't depend on the SDK
export interface ApiSession {
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  systemInstruction: string;
  // Internal history format: 'user' | 'assistant' (OpenAI style) or 'user' | 'model' (Gemini style)
  // We will normalize to 'user'/'model' during the API call generation
  history: { role: string; content: string }[];
}

/**
 * Initializes a session object. 
 * This is a lightweight state container. No network requests happen here.
 */
export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<ApiSession> => {
  
  // 1. Resolve API Key
  // Vite replaces process.env.API_KEY at build time
  const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey) {
    // We log a warning but don't crash yet, allowing the UI to handle the error when sending
    console.warn("API Key warning: No valid key found.");
  }

  // 2. Prepare History
  // We convert the app's ChatMessage format to a simpler internal format
  // App uses: role: 'user' | 'model'
  // We'll store it normalized for the session
  const formattedHistory = history
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      content: msg.text
    }));

  // 3. Return Session State
  return {
    modelName,
    baseUrl: baseUrl ? baseUrl.replace(/\/$/, '') : undefined,
    apiKey: apiKey as string,
    systemInstruction,
    history: formattedHistory
  };
};

/**
 * Sends a message using standard fetch.
 * Handles both Google Gemini REST API and Generic OpenAI-Compatible endpoints.
 */
export const sendMessageToGemini = async (
  session: ApiSession,
  message: string
): Promise<string> => {
  if (!session) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  const isCustomEndpoint = !!session.baseUrl;
  const apiKey = session.apiKey;

  try {
    let reply = "";

    // --- STRATEGY A: CUSTOM / OPENAI COMPATIBLE ENDPOINT ---
    if (isCustomEndpoint) {
      // Map 'model' role to 'assistant' for OpenAI compatibility
      const openAIMessages = [
        { role: "system", content: session.systemInstruction },
        ...session.history.map(h => ({
           role: h.role === 'model' ? 'assistant' : 'user',
           content: h.content
        })),
        { role: "user", content: message }
      ];

      const payload = {
        model: session.modelName,
        messages: openAIMessages,
        stream: false
      };

      const endpoint = `${session.baseUrl}/chat/completions`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`External API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || "";
    } 
    
    // --- STRATEGY B: GOOGLE GEMINI REST API (RAW FETCH) ---
    else {
      // 1. Construct the Endpoint URL (v1beta)
      // Reference: https://ai.google.dev/api/rest/v1beta/models/generateContent
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${session.modelName}:generateContent?key=${apiKey}`;

      // 2. Map History to Google's REST Format
      // Structure: { role: "user" | "model", parts: [{ text: "..." }] }
      const googleContents = session.history.map(h => ({
        role: h.role, // already 'user' or 'model'
        parts: [{ text: h.content }]
      }));

      // 3. Add Current User Message
      googleContents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      // 4. Construct Body
      const payload: any = {
        contents: googleContents,
      };

      // Add System Instruction if present
      if (session.systemInstruction) {
        payload.systemInstruction = {
            parts: [{ text: session.systemInstruction }]
        };
      }

      // 5. Execute Fetch
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
         throw new Error(`Gemini API Error: ${errMsg}`);
      }

      const data = await response.json();
      // Extract text from Google's response structure
      // Response -> candidates[0] -> content -> parts[0] -> text
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (!reply) throw new Error("Empty response from model.");

    // Update Local Session History
    session.history.push({ role: 'user', content: message });
    session.history.push({ role: 'model', content: reply });

    return reply;

  } catch (error: any) {
    console.error("API Request Failed:", error);
    throw new Error(`UPLINK FAILED: ${error.message}`);
  }
};