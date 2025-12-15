
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToGemini } from '../services/geminiService';
import { marked } from 'marked';

interface ChatInterfaceProps {
    personaId: string;
}

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    try {
        const renderer = new marked.Renderer();
        renderer.code = ({ text, lang }) => {
          const language = lang || 'text';
          const escapedCode = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const encodedRaw = encodeURIComponent(text);
          return `
            <div class="code-block-wrapper relative group my-4 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 shadow-sm">
              <div class="flex items-center justify-between px-4 py-2 bg-neutral-800/80 border-b border-neutral-800 backdrop-blur-sm">
                <span class="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">${language}</span>
                <button class="copy-btn flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors" data-code="${encodedRaw}">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span>Copy</span>
                </button>
              </div>
              <pre class="p-4 overflow-x-auto custom-scrollbar text-sm font-mono leading-relaxed text-brand-100 bg-transparent m-0"><code class="language-${language}">${escapedCode}</code></pre>
            </div>
          `;
        };
        return marked.parse(content, { renderer });
    } catch (e) {
        console.error("Markdown parsing failed", e);
        return content; 
    }
  }, [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleCopy = async (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.copy-btn');
      if (!target) return;
      const btn = target as HTMLButtonElement;
      const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
      try {
        await navigator.clipboard.writeText(rawCode);
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg><span class="text-green-400">Copied</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
      } catch (err) { console.error('Failed to copy', err); }
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  return <div ref={containerRef} className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:mb-4 prose-headings:font-bold prose-headings:text-neutral-100 prose-headings:mt-6 prose-headings:mb-3 prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline prose-code:text-brand-200 prose-code:font-mono prose-code:text-xs prose-code:bg-neutral-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-strong:text-white prose-ul:list-disc prose-ul:pl-4 prose-ul:my-4 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-4 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:rounded-none" dangerouslySetInnerHTML={{ __html: htmlContent as string }} />;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ personaId }) => {
  const { personas, getChatMessages, saveMessage, clearChat, getValidKey, reportKeyFailure } = useStore();
  const { user, getPersonaAccessTime, isAdmin } = useAuth();
  const persona = personas.find(p => p.id === personaId);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Load Messages
  useEffect(() => {
      if (!user || !persona) return;
      const history = getChatMessages(user.id, personaId);
      setMessages(history);
      
      // Focus input on load
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [personaId, user, getChatMessages]);

  // 2. Security Check
  useEffect(() => {
    if (!persona || !user) return;
    if (persona.isLocked && !isAdmin) {
        const accessTime = getPersonaAccessTime(persona.id);
        if (!accessTime) {
             alert("ACCESS DENIED.");
             window.location.hash = '#/dashboard';
        }
    }
  }, [persona, user, isAdmin, getPersonaAccessTime]);

  // 3. Auto-Scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  // --- Helpers ---
  
  // Logic to determine which key to use:
  // 1. Key Pool if assigned (Preferred)
  // 2. Custom API Key if assigned
  // 3. Environment Variable (handled in service)
  const getActiveKey = () => {
      if (persona?.keyPoolId) {
          const key = getValidKey(persona.keyPoolId);
          return { key, source: 'pool' };
      }
      return { key: persona?.customApiKey || undefined, source: 'legacy' };
  };

  const handleClearChat = () => {
      if (confirmClear) {
          if (user && persona) {
              clearChat(user.id, personaId);
              setMessages([]);
              setConfirmClear(false);
          }
      } else {
          setConfirmClear(true);
          setTimeout(() => setConfirmClear(false), 3000);
      }
  };

  const executeSend = async (text: string, attempt = 0): Promise<string> => {
      if (!persona) throw new Error("Persona lost");

      const { key, source } = getActiveKey();

      // If we are using a pool but no key returned, it means the pool is empty/dead
      if (source === 'pool' && !key) {
          throw new Error("KEY VAULT DEPLETED: All tokens in this box are dead or rate-limited. Please add fresh tokens in Admin Console.");
      }

      try {
          const apiSession = await createChatSession(
              persona.model,
              persona.systemPrompt,
              messages,
              persona.baseUrl,
              key 
          );

          return await sendMessageToGemini(apiSession, text);

      } catch (error: any) {
          const errMsg = error.message || '';
          const isAuthError = errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key') || errMsg.includes('ACCESS_DENIED');
          const isQuotaError = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('Too Many Requests');

          // FAILOVER LOGIC
          if ((isAuthError || isQuotaError) && source === 'pool' && persona.keyPoolId && attempt < 5) {
              // 1. Mark this specific key as dead
              if (key) reportKeyFailure(persona.keyPoolId, key);
              
              console.warn(`Token died (${key?.substring(0,6)}...), rotating...`);
              
              // 2. Recurse (Try again) - getActiveKey() will now fetch the NEXT available key
              return await executeSend(text, attempt + 1);
          }

          // If not a pool error, or retries exhausted, throw up
          throw error;
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user) return;

    const textPayload = inputValue.trim();
    setInputValue('');
    setConfirmClear(false);
    
    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textPayload,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    saveMessage(user.id, persona.id, userMsg);
    
    setIsSending(true);

    try {
      const responseText = await executeSend(textPayload);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);
      saveMessage(user.id, persona.id, modelMsg);

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: error.message || "**SYSTEM ERROR:** Uplink unstable.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div className="flex h-full items-center justify-center text-red-500 font-mono">[ERROR]: TARGET INVALID</div></Layout>;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-neutral-950 relative w-full min-w-0">
            
            {/* Header */}
            <div className="flex-shrink-0 h-16 border-b border-neutral-800 flex items-center justify-between px-4 lg:px-6 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-20" style={{ borderBottomColor: persona.themeColor }}>
                <div className="flex items-center gap-4 overflow-hidden">
                    {persona.avatarUrl ? (
                         <img src={persona.avatarUrl} className="w-8 h-8 rounded object-cover border border-neutral-700 shadow-md" />
                    ) : (
                        <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                            <span className="text-xs font-bold text-neutral-400">{persona.name.charAt(0)}</span>
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <h1 className="font-bold text-white text-base flex items-center gap-2 truncate">
                            {persona.name}
                            <span className="inline-flex items-center rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400 border border-neutral-700 ring-0">
                                {persona.model}
                            </span>
                        </h1>
                        <div className="text-[10px] font-mono text-green-500 flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            {persona.keyPoolId ? 'VAULT LINK ACTIVE' : 'SECURE UPLINK ACTIVE'}
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleClearChat}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all border ${
                        confirmClear 
                        ? 'bg-red-900/80 text-white border-red-500 hover:bg-red-800' 
                        : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-red-400 hover:border-red-900/50'
                    }`}
                >
                     {confirmClear ? (
                         <span>Confirm Purge?</span>
                     ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            <span className="hidden sm:inline">Purge Logs</span>
                        </>
                     )}
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-60 select-none pb-20 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6 shadow-2xl">
                            {persona.avatarUrl ? <img src={persona.avatarUrl} className="w-10 h-10 opacity-50 grayscale" /> : <svg className="w-10 h-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                        </div>
                        <h3 className="text-xl font-bold text-neutral-300 mb-2">{persona.name}</h3>
                        <p className="max-w-md text-center text-sm font-mono text-neutral-500">
                            {persona.description}
                        </p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] lg:max-w-[80%] p-6 rounded-2xl text-base shadow-sm ${msg.role === 'user' ? 'bg-neutral-800 text-white rounded-br-sm border border-neutral-700' : 'bg-transparent text-neutral-200 pl-0'}`}>
                            {msg.role === 'model' && (
                                <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider select-none" style={{ color: persona.themeColor || '#ef4444' }}>
                                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] border shadow-sm" style={{ backgroundColor: `${persona.themeColor || '#7f1d1d'}15`, borderColor: `${persona.themeColor || '#7f1d1d'}40` }}>AI</div>
                                    {persona.name}
                                </div>
                            )}
                            <MessageContent content={msg.text} />
                        </div>
                    </div>
                ))}

                {isSending && (
                    <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2">
                        <div className="max-w-[80%] pl-0">
                             <div className="flex items-center gap-2 mb-4 text-xs font-bold text-brand-500 uppercase tracking-wider" style={{ color: persona.themeColor }}>
                                <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] border shadow-sm" style={{ backgroundColor: `${persona.themeColor || '#7f1d1d'}15`, borderColor: `${persona.themeColor || '#7f1d1d'}40` }}>AI</div>
                                Processing
                             </div>
                             <div className="flex gap-1.5 h-6 items-center pl-4">
                                <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce delay-200"></div>
                             </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 lg:p-6 bg-neutral-950 border-t border-neutral-800 z-20">
                <div className="max-w-5xl mx-auto relative group">
                    <div className={`absolute -inset-0.5 rounded-xl blur opacity-20 transition duration-500 group-hover:opacity-40 ${isSending ? 'animate-pulse' : ''}`} style={{ background: persona.themeColor || '#dc2626' }}></div>
                    <div className="relative">
                        <input
                            ref={inputRef}
                            className="w-full bg-neutral-900 border border-neutral-800 text-white pl-5 pr-14 py-4 rounded-xl focus:ring-1 focus:ring-white/10 focus:border-neutral-700 outline-none transition-all shadow-xl font-sans placeholder:text-neutral-600 disabled:opacity-50"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={`Execute command or query...`}
                            disabled={isSending}
                            autoComplete="off"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isSending || !inputValue.trim()}
                            className="absolute right-2 top-2 bottom-2 aspect-square p-2 bg-neutral-800 text-neutral-400 rounded-lg border border-neutral-700 hover:bg-neutral-700 hover:text-white disabled:bg-transparent disabled:border-transparent disabled:text-neutral-800 transition-all"
                            style={!isSending && inputValue.trim() && persona.themeColor ? { backgroundColor: persona.themeColor, color: 'white', borderColor: persona.themeColor } : {}}
                        >
                            {isSending ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                        </button>
                    </div>
                </div>
                <p className="text-center text-[10px] text-neutral-600 mt-3 font-mono">
                    <span className="text-neutral-700">ENCRYPTED</span> // {user?.username}@{persona.id}
                </p>
            </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
