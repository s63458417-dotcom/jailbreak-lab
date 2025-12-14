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

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetchWithTimeout(url, options);
        if (!response.ok && response.status >= 500 && retries > 0) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        return response;
    } catch (error: any) {
        if (retries > 0 && (error.message.includes('Failed to fetch') || error.message.includes('Network'))) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
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

  // Smart Provider Detection
  // 1. Is it explicitly Google/Gemini?
  const isGoogle = (baseUrl && baseUrl.includes('googleapis.com')) || 
                   (!baseUrl && modelName.toLowerCase().includes('gemini'));

  // 2. Is it Generic (OpenAI/HF/Groq)? 
  // If user provides a baseUrl that isn't googleapis, assume Generic/Custom
  let isCustom = false;
  if (baseUrl && !baseUrl.includes('googleapis.com')) {
      isCustom = true;
  } else if (!isGoogle && !baseUrl) {
      // Fallback: If not google model and no url, it's weird, but default to Google SDK behavior
      isCustom = false; 
  }

  // Clean URL slightly but preserve full paths if provided
  let finalBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  
  // Only strip trailing slash if it's just a root, to avoid double slashes later
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
    // --- STRATEGY A: GENERIC OPENAI-COMPATIBLE (HuggingFace/DeepSeek/Groq) ---
    if (session.isCustom) {
      // Logic: If the model name is empty, we send a dummy one or omit it? OpenAI requires it.
      // If the User provided a FULL URL, we use it. If not, we append /chat/completions.
      
      let endpoint = session.baseUrl;
      const isFullUrl = endpoint.includes('/chat/completions') || endpoint.includes('/generate');
      
      if (!isFullUrl) {
          endpoint = `${endpoint}/chat/completions`;
      }

      const payload = {
          model: session.modelName || 'default', // Fallback for APIs that require field but ignore value
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

      const response = await fetchWithRetry(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.apiKey}`,
              'Connection': 'keep-alive'
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
      return reply;
    }

    // --- STRATEGY B: STANDARD GOOGLE GEMINI REST API ---
    else {
      let endpoint = '';

      // Check for Custom/Vertex Full URL (e.g. .../models/gemini-pro:generateContent)
      if (session.baseUrl.includes(':generateContent')) {
          endpoint = `${session.baseUrl}?key=${session.apiKey}`;
      } else {
          // Standard construction
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

      const response = await fetchWithRetry(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Connection': 'keep-alive' 
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
         if (errMsg.includes('API key')) throw new Error("ACCESS_DENIED: Invalid API Key.");
         throw new Error(`Uplink Error: ${errMsg}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!reply) throw new Error("Empty response from neural net.");
      return reply;
    }

  } catch (error: any) {
    console.error("Uplink Failed:", error);
    throw new Error(error.message || "Connection dropped.");
  }
};