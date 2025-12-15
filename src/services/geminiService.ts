
import { ChatMessage } from "../types";

// --- Types ---

export interface RestSession {
  isCustom: boolean;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  systemInstruction: string;
  history: ChatMessage[]; 
}

// --- Helpers ---

const fetchWithTimeout = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const TIMEOUT_MS = 600000; // 10 Minutes
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error("CONNECTION TIMEOUT: The neural link took too long to respond.");
        }
        throw error;
    }
};

// --- Main Service Functions ---

export const createChatSession = async (
  modelName: string,
  systemInstruction: string,
  history: ChatMessage[],
  baseUrl?: string,
  customApiKey?: string
): Promise<RestSession> => {
  
  const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey) {
    console.warn("System Warning: No API key detected.");
  }

  // FORCE CUSTOM if a URL is provided and it is NOT googleapis
  let isCustom = false;
  if (baseUrl && baseUrl.trim().length > 0) {
      if (!baseUrl.includes('googleapis.com')) {
          isCustom = true;
      }
  }

  // Clean URL
  let finalBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  if (finalBaseUrl.endsWith('/')) {
      finalBaseUrl = finalBaseUrl.slice(0, -1);
  }

  return {
    isCustom,
    modelName: modelName || '',
    baseUrl: finalBaseUrl,
    apiKey: apiKey as string,
    systemInstruction,
    history: history 
  };
};

export const sendMessageToGemini = async (
  session: RestSession,
  message: string
): Promise<string> => {
  if (!session) {
    throw new Error("SESSION_INVALID: Chat session is not initialized.");
  }

  try {
    // ============================================================
    // STRATEGY A: CUSTOM / GENERIC (OpenAI/HF/DeepSeek)
    // ============================================================
    if (session.isCustom) {
      
      let endpoint = session.baseUrl;
      
      // Heuristic: If URL doesn't look like a full endpoint, append standard chat path
      if (!endpoint.includes('/chat/completions') && !endpoint.includes('/generate')) {
          endpoint = `${endpoint}/chat/completions`;
      }

      const payload = {
          model: session.modelName, 
          messages: [
              { role: "system", content: session.systemInstruction },
              ...session.history.map(m => ({
                  role: m.role === 'model' ? 'assistant' : 'user',
                  content: m.text
              })),
              { role: "user", content: message }
          ],
          stream: false
      };

      // AUTH HEADER LOGIC: Robust handling for Bearer/Basic
      let authHeader = '';
      const cleanKey = session.apiKey.trim();
      
      if (cleanKey.toLowerCase().startsWith('basic ')) {
          authHeader = cleanKey; // User provided full Basic auth string
      } else if (cleanKey.toLowerCase().startsWith('bearer ')) {
          authHeader = cleanKey; // User provided full Bearer string
      } else {
          authHeader = `Bearer ${cleanKey}`; // Default to Bearer
      }

      const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          const errText = await response.text();
          let errDetail = errText;
          try {
             const jsonErr = JSON.parse(errText);
             if (jsonErr.error && typeof jsonErr.error === 'string') errDetail = jsonErr.error;
             else if (jsonErr.error && jsonErr.error.message) errDetail = jsonErr.error.message;
          } catch (e) {}
          
          throw new Error(`External API Error (${response.status}): ${errDetail}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "";
      if (!reply) throw new Error("Empty response from custom model.");
      return reply;
    }

    // ============================================================
    // STRATEGY B: GOOGLE GEMINI (REST ONLY, NO SDK)
    // ============================================================
    else {
      let endpoint = '';

      // Check for Vertex AI style or standard
      if (session.baseUrl.includes(':generateContent')) {
          endpoint = `${session.baseUrl}?key=${session.apiKey}`;
      } else {
          endpoint = `${session.baseUrl}/models/${session.modelName}:generateContent?key=${session.apiKey}`;
      }

      const contents = session.history
        .filter(m => m.role === 'user' || m.role === 'model')
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));
      
      contents.push({
          role: 'user',
          parts: [{ text: message }]
      });

      const payload: any = { contents };

      if (session.systemInstruction) {
          payload.systemInstruction = {
              parts: [{ text: session.systemInstruction }]
          };
      }

      const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
         // Detect Quota/Expiration for Failover
         if (response.status === 429 || errMsg.includes('Quota') || errMsg.includes('Too Many Requests')) {
             throw new Error("QUOTA_EXCEEDED: Token limit reached.");
         }
         if (response.status === 403 || errMsg.includes('API key')) {
             throw new Error("ACCESS_DENIED: Invalid or expired API Key.");
         }
         throw new Error(`Google API Error: ${errMsg}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!reply) throw new Error("Empty response from Gemini.");
      return reply;
    }

  } catch (error: any) {
    console.error("Uplink Failed:", error);
    throw error;
  }
};
