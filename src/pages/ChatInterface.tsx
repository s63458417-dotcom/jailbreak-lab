import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToGemini } from '../services/geminiService';
import { marked } from 'marked';

// --- Components ---

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Configure marked with a custom renderer for code blocks
  const htmlContent = useMemo(() => {
    const renderer = new marked.Renderer();
    
    // Custom Code Block Renderer
    renderer.code = ({ text, lang }) => {
      const language = lang || 'text';
      // We wrap the code block in a structured div with a data attribute for the raw code
      // We escape the code for the display, but store the raw code in a hidden textarea or data attribute for copying
      const escapedCode = text.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');
      
      // We encode the raw text to be safe in a data attribute
      const encodedRaw = encodeURIComponent(text);

      return `
        <div class="code-block-wrapper relative group my-4 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900">
          <div class="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
            <span class="text-xs font-mono text-neutral-400 lowercase">${language}</span>
            <button 
              class="copy-btn flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
              data-code="${encodedRaw}"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre class="p-4 overflow-x-auto custom-scrollbar text-sm font-mono leading-relaxed text-brand-100 bg-transparent m-0"><code class="language-${language}">${escapedCode}</code></pre>
        </div>
      `;
    };

    // Use the renderer
    return marked.parse(content, { renderer });
  }, [content]);

  // Handle Copy Button Clicks via Event Delegation
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
        
        // Visual Feedback
        const originalContent = btn.innerHTML;
        btn.innerHTML = `
          <svg class="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-green-400">Copied!</span>
        `;
        
        setTimeout(() => {
          btn.innerHTML = originalContent;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    };

    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  return (
    <div 
      ref={containerRef}
      className="prose prose-invert prose-sm max-w-none 
                 prose-p:leading-relaxed prose-p:mb-4
                 prose-headings:font-bold prose-headings:text-neutral-100 prose-headings:mt-6 prose-headings:mb-3
                 prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline
                 prose-code:text-brand-200 prose-code:font-mono prose-code:text-xs prose-code:bg-neutral-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                 prose-strong:text-white
                 prose-ul:list-disc prose-ul:pl-4 prose-ul:my-4
                 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-4
                 /* Reset pre styles because we handle them manually in the renderer */
                 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:rounded-none"
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

const ChatInterface: React.FC<{ personaId: string }> = ({ personaId }) => {
  const { personas, getChatHistory, saveChatMessage, clearChatHistory } = useStore();
  const { user, getPersonaAccessTime, isAdmin } = useAuth();
  
  const persona = personas.find(p => p.id === personaId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [chatSession, setChatSession] = useState<any>(null);
  const [sessionKey, setSessionKey] = useState(0); 
  
  // UI State for confirmation
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Security & Access Check
  useEffect(() => {
    if (!persona || !user) return;
    
    // Security Gate
    if (persona.isLocked && !isAdmin) {
        const accessTime = getPersonaAccessTime(persona.id);
        
        if (!accessTime) {
             alert("ACCESS DENIED: Authorization required. Redirecting to hub.");
             window.location.hash = '#/dashboard';
             return;
        }

        // Check expiration
        if (persona.accessDuration && persona.accessDuration > 0) {
            const expiration = accessTime + (persona.accessDuration * 60 * 60 * 1000);
            if (Date.now() > expiration) {
                alert("ACCESS EXPIRED: Authorization timeout. Redirecting to hub.");
                window.location.hash = '#/dashboard';
                return;
            }
        }
    }
  }, [persona, user, isAdmin, getPersonaAccessTime]);

  // Initialize Session
  useEffect(() => {
    if (!user || !persona) return;

    // Reset confirmation state when persona changes
    setConfirmNewChat(false);

    // Load history directly
    const history = getChatHistory(user.id, personaId);
    
    // Set messages state
    setMessages(history);

    let mounted = true;
    setIsConnecting(true);

    const initGemini = async () => {
      try {
        const session = await createChatSession(
            persona.model,
            persona.systemPrompt,
            history,
            persona.baseUrl,
            persona.customApiKey
        );
        if (mounted) {
            setChatSession(session);
            setIsConnecting(false);
            // Auto focus input once ready
            setTimeout(() => inputRef.current?.focus(), 100);
        }
      } catch (e) {
        console.error("Chat Init Failed", e);
        if (mounted) setIsConnecting(false);
      }
    };

    initGemini();

    return () => { mounted = false; };
  }, [personaId, user, sessionKey, getChatHistory]);

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending, isConnecting]);

  // --- Rate Limit Logic ---
  const getUsageStats = () => {
      if (!persona?.rateLimit || !messages) return { used: 0, remaining: 9999, limit: 0 };
      
      const now = new Date();
      // Start of current day (local time)
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      const usedToday = messages.filter(m => 
          m.role === 'user' && m.timestamp >= startOfDay
      ).length;
      
      return {
          used: usedToday,
          remaining: Math.max(0, persona.rateLimit - usedToday),
          limit: persona.rateLimit
      };
  };

  const usageStats = getUsageStats();
  const isRateLimited = usageStats.limit > 0 && usageStats.remaining <= 0;

  const handleSend = async () => {
    // Prevent sending if empty, already sending, session not ready, or rate limited
    if (!inputValue.trim() || isSending || isConnecting || !chatSession) return;
    
    // Hard block for rate limit
    if (isRateLimited) {
        alert(`DAILY RATE LIMIT EXCEEDED.\nYou have used ${usageStats.used}/${usageStats.limit} messages today.\nResets at midnight.`);
        return;
    }

    const textPayload = inputValue.trim();
    setInputValue(''); // Clear immediately for UX
    setConfirmNewChat(false); // Reset confirmation if user sends a message

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textPayload,
      timestamp: Date.now(),
    };

    // Optimistic Update
    setMessages(prev => [...prev, userMsg]);
    if (user && persona) saveChatMessage(user.id, persona.id, userMsg);
    
    setIsSending(true);

    try {
      const responseText = await sendMessageToGemini(chatSession, textPayload);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);
      if (user && persona) saveChatMessage(user.id, persona.id, modelMsg);

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
      // Re-focus input
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleNewSessionAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if(!user) return;
    
    if (confirmNewChat) {
        // Second click - Execute
        // 1. Clear Context Store
        clearChatHistory(user.id, personaId);
        // 2. Clear Local State
        setMessages([]); 
        setChatSession(null); 
        // 3. Force Effect Re-run
        setSessionKey(prev => prev + 1); 
        setConfirmNewChat(false);
    } else {
        // First click - Confirm
        setConfirmNewChat(true);
        // Timeout to reset state
        setTimeout(() => setConfirmNewChat(false), 3000);
    }
  }

  if (!persona) {
      return (
        <Layout title="Error" isChatMode={true}>
            <div className="flex h-full items-center justify-center text-red-500 font-mono">
                [ERROR]: TARGET PERSONA NOT FOUND
            </div>
        </Layout>
      );
  }

  const customColor = persona.themeColor || '#22c55e'; // Default green if not set
  const headerStyle = persona.themeColor ? { borderBottomColor: persona.themeColor } : {};

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-neutral-950 relative">
        
        {/* Header */}
        <div 
          className="flex-shrink-0 h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-20"
          style={headerStyle}
        >
             <div className="flex items-center gap-3">
                 <div className="relative flex items-center justify-center w-3 h-3">
                     <span 
                        className={`w-2 h-2 rounded-full absolute ${isConnecting ? 'animate-pulse bg-yellow-500' : ''}`} 
                        style={{ backgroundColor: isConnecting ? undefined : customColor, boxShadow: isConnecting ? undefined : `0 0 8px ${customColor}80` }}
                     ></span>
                 </div>
                 <div className="flex items-center gap-2">
                    {persona.avatarUrl && <img src={persona.avatarUrl} alt="" className="w-6 h-6 rounded object-cover border border-neutral-700" />}
                    <div>
                        <h1 className="font-bold text-white text-sm tracking-wide flex items-center gap-2">
                            {persona.name}
                            {usageStats.limit > 0 && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isRateLimited ? 'text-red-500 bg-red-900/20 border-red-900/50' : 'text-neutral-400 bg-neutral-800 border-neutral-700'}`}>
                                    {usageStats.remaining} LEFT
                                </span>
                            )}
                        </h1>
                        <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">{isConnecting ? 'ESTABLISHING LINK...' : 'LINK SECURE'}</div>
                    </div>
                 </div>
             </div>
             
             {/* New Session Button */}
             <button 
                 type="button"
                 onClick={handleNewSessionAction} 
                 className={`p-2 h-8 px-3 text-xs flex items-center gap-2 border rounded-md transition-all active:scale-95 cursor-pointer font-bold ${
                    confirmNewChat 
                    ? 'bg-neutral-800 text-brand-500 border-brand-500 hover:bg-neutral-700 shadow-md'
                    : 'text-neutral-400 bg-neutral-900/50 border-neutral-800 hover:text-white hover:border-neutral-600'
                 }`}
                 title="Reset Session"
             >
                 {confirmNewChat ? (
                     <span>CONFIRM RESET?</span>
                 ) : (
                    <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="hidden sm:inline">New Session</span>
                    </>
                 )}
             </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth" ref={scrollRef}>
          {messages.length === 0 && !isConnecting && (
             <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-60 select-none pb-20 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6 shadow-xl">
                    {persona.avatarUrl ? (
                         <img src={persona.avatarUrl} className="w-8 h-8 opacity-50 grayscale" />
                    ) : (
                        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                </div>
                <h3 className="text-lg font-medium text-neutral-300 mb-2">Initial State</h3>
                <p className="max-w-md text-center text-sm font-mono">Model: {persona.model}<br/>Ready for input.</p>
                {usageStats.limit > 0 && (
                    <div className="mt-4 text-xs font-mono text-neutral-500 bg-neutral-900 px-3 py-1 rounded border border-neutral-800">
                        Daily Limit: {usageStats.limit} messages
                    </div>
                )}
             </div>
          )}
          
          {/* Loading Skeleton for Session Init */}
          {isConnecting && messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
                 <div className="flex gap-2">
                    <div className="w-3 h-3 bg-brand-600 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-brand-600 rounded-full animate-bounce delay-100"></div>
                    <div className="w-3 h-3 bg-brand-600 rounded-full animate-bounce delay-200"></div>
                 </div>
                 <p className="text-xs text-brand-500 font-mono tracking-widest uppercase">Negotiating Handshake</p>
             </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[90%] lg:max-w-[80%] xl:max-w-[70%] p-5 rounded-2xl text-base shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-neutral-800 text-white rounded-br-none border border-neutral-700' 
                    : 'bg-transparent text-neutral-200 pl-0'
                }`}
              >
                {msg.role === 'model' && (
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider select-none" style={{ color: persona.themeColor || '#ef4444' }}>
                        <div 
                            className="w-5 h-5 rounded flex items-center justify-center text-[10px] border"
                            style={{ 
                                backgroundColor: `${persona.themeColor || '#7f1d1d'}20`, 
                                borderColor: `${persona.themeColor || '#7f1d1d'}50` 
                            }}
                        >AI</div>
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
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-brand-500 uppercase tracking-wider" style={{ color: persona.themeColor }}>
                        <div 
                            className="w-5 h-5 rounded flex items-center justify-center text-[10px] border"
                            style={{ 
                                backgroundColor: `${persona.themeColor || '#7f1d1d'}20`, 
                                borderColor: `${persona.themeColor || '#7f1d1d'}50` 
                            }}
                        >AI</div>
                        Thinking
                    </div>
                    <div className="flex gap-1 h-6 items-center pl-4">
                        <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse"></div>
                        <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse delay-150"></div>
                        <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse delay-300"></div>
                    </div>
                 </div>
             </div>
          )}
          <div className="h-2"></div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 bg-neutral-950 border-t border-neutral-800 z-20">
           <div className="max-w-4xl mx-auto relative group">
                {isRateLimited && (
                    <div className="absolute -top-10 left-0 right-0 text-center">
                        <span className="text-xs bg-red-900/80 text-white px-3 py-1.5 rounded-full shadow-lg border border-red-700 backdrop-blur-sm">
                            Daily Quota Exceeded ({usageStats.limit}/{usageStats.limit})
                        </span>
                    </div>
                )}
                <input
                    ref={inputRef}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white pl-5 pr-14 py-4 rounded-xl focus:ring-1 outline-none transition-all shadow-lg font-sans placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                        borderColor: isSending ? undefined : (persona.themeColor ? `${persona.themeColor}50` : undefined),
                    }}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={isConnecting ? "Initializing uplink..." : (isRateLimited ? "Daily limit reached." : `Message ${persona.name}...`)}
                    disabled={isSending || isConnecting || isRateLimited}
                    autoComplete="off"
                />
                <button 
                    onClick={handleSend}
                    disabled={isSending || isConnecting || !inputValue.trim() || isRateLimited}
                    className="absolute right-2 top-2 bottom-2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:bg-transparent disabled:text-neutral-700 transition-colors"
                    style={!isSending && inputValue.trim() && persona.themeColor && !isRateLimited ? { backgroundColor: persona.themeColor } : {}}
                >
                    {isSending ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                </button>
           </div>
           {!isConnecting && (
             <p className="text-center text-[10px] text-neutral-600 mt-2 font-mono">
                Created by BT4
             </p>
           )}
        </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;