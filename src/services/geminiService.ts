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

/**
 * Custom Fetch with 10-minute Timeout (600,000ms)
 * Prevents the "AbortError" on long reasoning tasks.
 */
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
            throw new Error("CONNECTION TIMEOUT: The neural link took too long to respond (10 minute limit).");
        }
        throw error;
    }
};

/**
 * Fetch with Retry Logic & Exponential Backoff
 * Retries up to 3 times for Network Errors or HTTP 5xx Server Errors.
 */
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetchWithTimeout(url, options);
        
        // Retry on Server Errors (500, 502, 503, 504)
        if (!response.ok && response.status >= 500 && retries > 0) {
            console.warn(`Server Error ${response.status}. Retrying in ${backoff}ms...`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        
        return response;
    } catch (error: any) {
        // Retry on Network Errors (Failed to fetch)
        const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('Network request failed');
        
        if (retries > 0 && isNetworkError) {
            console.warn(`Network instability detected. Retrying connection in ${backoff}ms...`);
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
  
  // 1. Resolve API Key
  // Prioritize custom key, fallback to env (replaced by Vite/Build process)
  const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  const apiKey = (customApiKey && customApiKey.trim().length > 0) ? customApiKey : envKey;

  if (!apiKey) {
    console.warn("System Warning: No API key detected. Ensure API_KEY is set in environment or settings.");
  }

  // 2. Determine Endpoint Strategy
  const isGenericEndpoint = baseUrl && (
    baseUrl.includes('huggingface') || 
    baseUrl.includes('deepseek') || 
    baseUrl.includes('openai') || 
    baseUrl.includes('v1') ||
    !modelName.toLowerCase().includes('gemini') 
  );

  let finalBaseUrl = '';

  if (isGenericEndpoint) {
      finalBaseUrl = baseUrl!.replace(/\/$/, '');
  } else {
      // Standard Google REST Endpoint base (we append specific paths later)
      finalBaseUrl = (baseUrl && baseUrl.trim().length > 0) 
        ? baseUrl.replace(/\/$/, '') 
        : 'https://generativelanguage.googleapis.com/v1beta';
  }

  // 3. Return Session Object (No API call needed for init in REST)
  return {
    isCustom: !!isGenericEndpoint,
    modelName,
    baseUrl: finalBaseUrl,
    apiKey: apiKey as string,
    systemInstruction,
    history: history // Pass reference to history
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
    // --- STRATEGY A: GENERIC OPENAI-COMPATIBLE (HuggingFace/DeepSeek) ---
    if (session.isCustom) {
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

      const endpoint = `${session.baseUrl}/chat/completions`;
      
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
      // 1. Construct Endpoint
      const endpoint = `${session.baseUrl}/models/${session.modelName}:generateContent?key=${session.apiKey}`;

      // 2. Format History for Gemini REST (role: user/model, parts: [{text}])
      const contents = session.history
        .filter(m => m.role === 'user' || m.role === 'model')
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));
      
      // 3. Add Current Message
      contents.push({
          role: 'user',
          parts: [{ text: message }]
      });

      // 4. Construct Payload
      const payload: any = { contents };

      if (session.systemInstruction) {
          payload.systemInstruction = {
              parts: [{ text: session.systemInstruction }]
          };
      }

      // 5. Execute Fetch with Retry
      const response = await fetchWithRetry(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              // Keep-alive header helps prevent premature socket closures
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