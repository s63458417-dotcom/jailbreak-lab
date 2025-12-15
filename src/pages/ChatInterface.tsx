
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
    if (!content) return '';

    const renderer = new marked.Renderer();
    
    // Custom Code Block Renderer - DeepSeek Style
    // Uses 'not-prose' to escape Tailwind Typography defaults
    renderer.code = ({ text, lang }) => {
      const language = lang || 'text';
      // We encode the raw text to be safe in a data attribute
      const encodedRaw = encodeURIComponent(text);
      
      // Escape for HTML display
      const escapedCode = text.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');

      return `
        <div class="not-prose my-4 rounded-lg overflow-hidden border border-[#2e2e2e] bg-[#1e1e1e] shadow-lg group">
          <div class="flex items-center justify-between px-3 py-2 bg-[#252525] border-b border-[#2e2e2e] select-none">
            <span class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">${language}</span>
            <button 
              class="copy-btn flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
              data-code="${encodedRaw}"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <div class="p-3 overflow-x-auto custom-scrollbar bg-[#161616]">
             <pre class="m-0 p-0 bg-transparent text-sm font-mono leading-relaxed text-[#cecece]"><code class="language-${language} border-0 p-0 m-0 bg-transparent">${escapedCode}</code></pre>
          </div>
        </div>
      `;
    };

    // Use the renderer
    try {
        return marked.parse(content, { renderer }) as string;
    } catch (e) {
        console.error("Markdown parse error", e);
        return content;
    }
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
          <span class="text-green-400">Copied</span>
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
                 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-neutral-300
                 prose-headings:font-semibold prose-headings:text-neutral-100 prose-headings:mt-6 prose-headings:mb-3
                 prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline
                 prose-code:text-brand-200 prose-code:font-mono prose-code:text-xs prose-code:bg-neutral-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                 prose-strong:text-white
                 prose-ul:list-disc prose-ul:pl-4 prose-ul:my-4
                 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-4
                 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0"
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

const ChatInterface: React.FC<{ personaId: string }> = ({ personaId }) => {
  const { 
    personas, getChatHistory, saveChatMessage, clearChatHistory, config,
    getValidKey, reportKeyFailure,
    getUsageCount, incrementUsage
  } = useStore();
  const { user, getPersonaAccessTime, isAdmin } = useAuth();
  
  const persona = personas.find(p => p.id === personaId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [chatSession, setChatSession] = useState<any>(null);
  const [sessionKey, setSessionKey] = useState(0); 
  const [confirmClear, setConfirmClear] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [personaId]);

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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  // Initialize Session
  useEffect(() => {
    if (!user || !persona) return;
    setConfirmClear(false);
    const history = getChatHistory(user.id, personaId);
    setMessages(history);
    
    let mounted = true;
    setIsConnecting(true);

    const initGemini = async () => {
      try {
        // --- KEY SELECTION LOGIC ---
        let selectedKey = persona.customApiKey;
        
        // If Vault is active, prioritize fetching from Pool
        if (persona.keyPoolId) {
             const vaultKey = getValidKey(persona.keyPoolId);
             if (!vaultKey) {
                 throw new Error("KEY VAULT EXHAUSTED: No active keys available in pool.");
             }
             selectedKey = vaultKey;
        }

        if (mounted) setCurrentKey(selectedKey || null);

        const session = await createChatSession(
            persona.model,
            persona.systemPrompt,
            history,
            persona.baseUrl,
            selectedKey
        );
        
        if (mounted) {
            setChatSession(session);
            setIsConnecting(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
      } catch (e: any) {
        console.error("Chat Init Failed", e);
        if (mounted) {
            setIsConnecting(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                text: `**SYSTEM ALERT:** Connection Initialization Failed.\nReason: ${e.message}`,
                timestamp: Date.now()
            }]);
        }
      }
    };
    initGemini();
    return () => { mounted = false; };
  }, [personaId, user, sessionKey, getChatHistory]);


  const handleClearChat = () => {
      if (confirmClear) {
          clearChatHistory(user!.id, personaId);
          setMessages([]);
          setChatSession(null); 
          setSessionKey(prev => prev + 1); 
          setConfirmClear(false);
      } else {
          setConfirmClear(true);
          setTimeout(() => setConfirmClear(false), 3000);
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user || !chatSession) return;

    // --- RATE LIMIT CHECK (PERSISTENT) ---
    const dailyLimit = persona.rateLimit || 0;
    const currentUsage = getUsageCount(user.id, persona.id);
    
    if (dailyLimit > 0 && currentUsage >= dailyLimit) {
        alert(`DAILY RATE LIMIT EXCEEDED.\nYou have used ${currentUsage}/${dailyLimit} messages today for this AI.\nResets at midnight local time.`);
        return;
    }

    const textPayload = inputValue.trim();
    setInputValue('');
    setConfirmClear(false);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textPayload,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    saveChatMessage(user.id, persona.id, userMsg);
    
    // Increment Usage IMMEDIATELY upon attempt
    incrementUsage(user.id, persona.id);

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
      saveChatMessage(user.id, persona.id, modelMsg);

    } catch (error: any) {
      // --- AUTO-ROTATION LOGIC ---
      const errStr = error.message || '';
      if (persona.keyPoolId && currentKey && (errStr.includes('401') || errStr.includes('403') || errStr.includes('429'))) {
          console.warn(`Reporting key failure for pool ${persona.keyPoolId}`);
          reportKeyFailure(persona.keyPoolId, currentKey);
          
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: `**SYSTEM ALERT:** API Key Failure Detected. Rotating keys... please retry.`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          
          setChatSession(null);
          setSessionKey(prev => prev + 1);
      } else {
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: error.message || "**SYSTEM ERROR:** Uplink unstable.",
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div className="flex h-full items-center justify-center text-red-500 font-mono">[ERROR]: TARGET INVALID</div></Layout>;

  // Usage Stats for UI
  const dailyLimit = persona.rateLimit || 0;
  const currentUsage = (user && persona) ? getUsageCount(user.id, persona.id) : 0;
  const remaining = Math.max(0, dailyLimit - currentUsage);
  const isRateLimited = dailyLimit > 0 && remaining === 0;

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-[#212121] relative w-full min-w-0">
            
            {/* Header */}
            <div className="flex-shrink-0 h-14 flex items-center justify-between px-4 lg:px-6 z-20 border-b border-[#2e2e2e]">
                <div className="flex items-center gap-2">
                     <span className="text-neutral-400 text-sm hidden sm:inline">To:</span>
                     <div className="flex items-center gap-2 bg-[#2f2f2f] px-2 py-1 rounded text-sm text-white">
                        {persona.name} 
                        {dailyLimit > 0 && (
                             <span className={`text-[10px] px-1.5 rounded border ${isRateLimited ? 'text-red-400 border-red-900/50 bg-red-900/20' : 'text-neutral-400 border-neutral-700 bg-neutral-800'}`}>
                                 {remaining} Left
                             </span>
                        )}
                     </div>
                </div>

                <button 
                    onClick={handleClearChat}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                        confirmClear ? 'bg-red-500/20 text-red-400' : 'text-neutral-400 hover:bg-[#2f2f2f] hover:text-white'
                    }`}
                >
                     {confirmClear ? "Confirm Wipe" : "Clear Context"}
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth" ref={scrollRef}>
                <div className="max-w-3xl mx-auto py-6 space-y-6">
                    {/* EMPTY STATE */}
                    {messages.length === 0 && !isConnecting && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40 select-none px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#2f2f2f] border border-[#404040] flex items-center justify-center mb-6 shadow-xl">
                                {persona.avatarUrl ? (
                                    <img src={persona.avatarUrl} className="w-8 h-8 opacity-50 grayscale" />
                                ) : (
                                    <div className="text-neutral-400">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">{persona.name}</h3>
                            <p className="max-w-md text-sm text-neutral-400 font-mono leading-relaxed">{persona.description}</p>
                            {isRateLimited && <p className="text-red-500 text-xs mt-4">DAILY QUOTA EXCEEDED</p>}
                        </div>
                    )}
                    
                    {/* LOADING STATE */}
                    {isConnecting && messages.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center space-y-4 pt-20">
                             <div className="flex gap-2">
                                <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce delay-100"></div>
                                <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce delay-200"></div>
                             </div>
                         </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                                <div className="max-w-[85%] bg-[#2f2f2f] text-[#ececec] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                                    <MessageContent content={msg.text} />
                                </div>
                            ) : (
                                <div className="flex gap-4 max-w-full w-full">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2b2b2b] border border-[#404040] flex items-center justify-center text-xs font-bold text-brand-500 mt-0.5 shadow-sm">
                                        AI
                                    </div>
                                    <div className="flex-1 min-w-0 text-[#d4d4d4] text-[15px] leading-relaxed pt-1">
                                        <MessageContent content={msg.text} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {isSending && (
                        <div className="flex gap-4 w-full">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2b2b2b] border border-[#404040] flex items-center justify-center mt-0.5">
                                <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></div>
                            </div>
                            <div className="flex-1 pt-2">
                                <span className="text-neutral-400 text-sm animate-pulse">Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Input Area */}
            <div className="flex-shrink-0 p-4 md:pb-6 z-20">
                <div className={`max-w-3xl mx-auto bg-[#2f2f2f] rounded-2xl p-3 relative shadow-lg border transition-colors ${isRateLimited ? 'border-red-900/50 opacity-75' : 'border-[#404040]/50'}`}>
                    {isRateLimited && (
                        <div className="absolute inset-0 z-10 bg-black/50 rounded-2xl flex items-center justify-center backdrop-blur-[1px]">
                            <span className="bg-red-900/90 text-white px-4 py-2 rounded-lg text-xs font-bold border border-red-700 shadow-xl">
                                ⛔ DAILY LIMIT REACHED ({dailyLimit}/{dailyLimit})
                            </span>
                        </div>
                    )}
                    <textarea
                        ref={inputRef}
                        className="w-full bg-transparent text-white text-sm px-2 py-1 outline-none resize-none max-h-32 min-h-[44px] custom-scrollbar placeholder:text-neutral-500"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isRateLimited ? "Limit exceeded." : "Message..."}
                        disabled={isSending || isRateLimited}
                        rows={1}
                    />
                    
                    <div className="flex justify-between items-center mt-2 px-1">
                        <div className="flex items-center gap-2"></div>
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isSending || isRateLimited}
                                className={`p-2 rounded-full transition-all ${
                                    inputValue.trim() && !isSending && !isRateLimited
                                    ? 'bg-white text-black hover:bg-neutral-200' 
                                    : 'bg-[#404040] text-neutral-500 cursor-not-allowed'
                                }`}
                             >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                             </button>
                        </div>
                    </div>
                </div>
                <p className="text-center text-[10px] text-neutral-600 mt-2">{config.creatorName}</p>
            </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
