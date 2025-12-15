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
    // Correct Signature: (code, language)
    renderer.code = (code: string, language: string | undefined) => {
      const validLang = language || 'text';
      const encodedRaw = encodeURIComponent(code);
      
      const escapedCode = code.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');

      return `
        <div class="not-prose my-4 rounded-lg overflow-hidden border border-[#2e2e2e] bg-[#0d0d0d] group">
          <div class="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#2e2e2e]">
            <span class="text-xs font-mono font-bold text-neutral-400 lowercase">${validLang}</span>
            <button 
              class="copy-btn flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-all px-2 py-1 rounded"
              data-code="${encodedRaw}"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <div class="p-4 overflow-x-auto custom-scrollbar bg-[#0d0d0d]">
             <pre class="m-0 p-0 bg-transparent text-sm font-mono leading-relaxed text-[#e0e0e0]"><code class="language-${validLang}">${escapedCode}</code></pre>
          </div>
        </div>
      `;
    };

    try {
        return marked.parse(content, { renderer }) as string;
    } catch (e) {
        console.error("Markdown parse error", e);
        return content;
    }
  }, [content]);

  // Handle Copy Button Clicks
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
        btn.innerHTML = `<span class="text-green-400">Copied</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
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
                 prose-code:text-brand-200 prose-code:font-mono prose-code:text-xs prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-neutral-700
                 prose-strong:text-white
                 prose-ul:list-disc prose-ul:pl-4 prose-ul:my-4
                 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-4
                 prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent"
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
  const [confirmClear, setConfirmClear] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
      setMessages([]);
      setTimeout(() => textareaRef.current?.focus(), 100);
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
        let selectedKey = persona.customApiKey;
        if (persona.keyPoolId) {
             const vaultKey = getValidKey(persona.keyPoolId);
             if (vaultKey) selectedKey = vaultKey;
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
            setTimeout(() => textareaRef.current?.focus(), 100);
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
  }, [personaId, user, getChatHistory]);


  const handleClearChat = () => {
      if (confirmClear) {
          clearChatHistory(user!.id, personaId);
          setMessages([]);
          setChatSession(null); 
          window.location.reload(); 
      } else {
          setConfirmClear(true);
          setTimeout(() => setConfirmClear(false), 3000);
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !persona || !user || !chatSession) return;

    const dailyLimit = persona.rateLimit || 0;
    const currentUsage = getUsageCount(user.id, persona.id);
    
    if (dailyLimit > 0 && currentUsage >= dailyLimit) {
        alert(`DAILY RATE LIMIT EXCEEDED.\nYou have used ${currentUsage}/${dailyLimit} messages today.`);
        return;
    }

    const textPayload = inputValue.trim();
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto'; 
    setConfirmClear(false);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textPayload,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    saveChatMessage(user.id, persona.id, userMsg);
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
      const errStr = error.message || '';
      if (persona.keyPoolId && currentKey && (errStr.includes('401') || errStr.includes('403') || errStr.includes('429'))) {
          reportKeyFailure(persona.keyPoolId, currentKey);
          const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: `**SYSTEM ALERT:** API Key Failure Detected. Rotating keys... please retry.`,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errorMsg]);
          setChatSession(null);
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
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div className="flex h-full items-center justify-center text-red-500 font-mono">[ERROR]: TARGET INVALID</div></Layout>;

  // Usage Stats
  const dailyLimit = persona.rateLimit || 0;
  const currentUsage = (user && persona) ? getUsageCount(user.id, persona.id) : 0;
  const remaining = Math.max(0, dailyLimit - currentUsage);
  const isRateLimited = dailyLimit > 0 && remaining === 0;
  const themeColor = persona.themeColor || '#22c55e'; // Default Green

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex flex-col h-full bg-[#212121] relative w-full min-w-0">
            
            {/* Header */}
            <div className="flex-shrink-0 h-14 flex items-center justify-between px-4 lg:px-6 z-20 border-b border-[#2e2e2e] bg-[#212121]/95 backdrop-blur">
                <div className="flex items-center gap-3">
                     <div className="relative">
                         {persona.avatarUrl ? (
                            <img src={persona.avatarUrl} className="w-8 h-8 rounded-full bg-[#2f2f2f] object-cover" />
                         ) : (
                            <div className="w-8 h-8 rounded-full bg-[#2f2f2f] flex items-center justify-center text-xs font-bold text-neutral-400">
                                {persona.name.charAt(0)}
                            </div>
                         )}
                         <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#212121] ${isConnecting ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                     </div>
                     <div>
                         <div className="flex items-center gap-2">
                             <span className="text-sm font-bold text-white tracking-tight">{persona.name}</span>
                             {dailyLimit > 0 && (
                                <span className={`text-[10px] px-1.5 rounded font-mono ${isRateLimited ? 'text-red-400 bg-red-900/20' : 'text-neutral-400 bg-[#2f2f2f]'}`}>
                                    {remaining} left
                                </span>
                             )}
                         </div>
                         <div className="text-[10px] text-neutral-500 font-medium">
                            {isConnecting ? 'ESTABLISHING SECURE LINK...' : 'ENCRYPTED CHANNEL ACTIVE'}
                         </div>
                     </div>
                </div>

                <button 
                    onClick={handleClearChat}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors border ${
                        confirmClear 
                        ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                        : 'border-transparent text-neutral-500 hover:text-white hover:bg-[#2f2f2f]'
                    }`}
                >
                     {confirmClear ? "CONFIRM WIPE" : "Clear Chat"}
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth" ref={scrollRef}>
                <div className="max-w-3xl mx-auto py-6 space-y-8">
                    {/* EMPTY STATE */}
                    {messages.length === 0 && !isConnecting && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40 select-none px-6 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-[#2f2f2f] border border-[#404040] flex items-center justify-center mb-6 shadow-xl">
                                {persona.avatarUrl ? (
                                    <img src={persona.avatarUrl} className="w-8 h-8 opacity-50 grayscale" />
                                ) : (
                                    <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                )}
                            </div>
                            <h3 className="text-xl font-medium text-white mb-2">{persona.name}</h3>
                            <p className="max-w-md text-sm text-neutral-400 font-mono leading-relaxed">{persona.description}</p>
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
                             <span className="text-xs text-neutral-600 font-mono">HANDSHAKE IN PROGRESS</span>
                         </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'user' ? (
                                <div className="max-w-[85%] bg-[#2f2f2f] text-[#ececec] px-5 py-3 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed shadow-sm border border-[#3a3a3a]">
                                    <MessageContent content={msg.text} />
                                </div>
                            ) : (
                                <div className="flex gap-4 max-w-full w-full px-2 md:px-0">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-transparent flex items-start justify-center mt-1">
                                        {persona.avatarUrl ? (
                                            <img src={persona.avatarUrl} className="w-6 h-6 rounded-sm object-cover" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-sm bg-brand-900/30 text-brand-500 flex items-center justify-center text-xs font-bold border border-brand-900/50">AI</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 text-[#d4d4d4] text-[15px] leading-relaxed pt-1">
                                        <MessageContent content={msg.text} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* THINKING EFFECT - Restored */}
                    {isSending && (
                        <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2 px-2 md:px-0">
                             <div className="max-w-[80%] pl-0">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: themeColor }}>
                                    <div 
                                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] border"
                                        style={{ 
                                            backgroundColor: `${themeColor}20`, 
                                            borderColor: `${themeColor}50` 
                                        }}
                                    >AI</div>
                                    Thinking
                                </div>
                                <div className="flex gap-1.5 h-6 items-center pl-12">
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor }}></div>
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-150" style={{ backgroundColor: themeColor }}></div>
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-300" style={{ backgroundColor: themeColor }}></div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Input Area */}
            <div className="flex-shrink-0 p-4 md:pb-6 z-20">
                <div className={`max-w-3xl mx-auto bg-[#2f2f2f] rounded-2xl p-2 relative shadow-2xl border transition-colors ${isRateLimited ? 'border-red-900/50 opacity-75' : 'border-[#404040]/50 focus-within:border-[#505050] focus-within:ring-1 focus-within:ring-[#505050]'}`}>
                    {isRateLimited && (
                        <div className="absolute inset-0 z-10 bg-black/50 rounded-2xl flex items-center justify-center backdrop-blur-[1px]">
                            <span className="bg-red-900/90 text-white px-4 py-2 rounded-lg text-xs font-bold border border-red-700 shadow-xl">
                                ⛔ DAILY LIMIT REACHED
                            </span>
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-transparent text-white text-[15px] px-3 py-2 outline-none resize-none max-h-48 min-h-[44px] custom-scrollbar placeholder:text-neutral-500"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 192) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={isRateLimited ? "Limit exceeded." : "Send a message..."}
                        disabled={isSending || isRateLimited}
                        rows={1}
                        autoFocus
                    />
                    
                    <div className="flex justify-between items-center px-2 pb-1">
                        <div className="flex items-center gap-2">
                             {/* Future: Attachments */}
                        </div>
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isSending || isRateLimited}
                                className={`p-2 rounded-xl transition-all ${
                                    inputValue.trim() && !isSending && !isRateLimited
                                    ? 'text-white hover:brightness-110 shadow-lg' 
                                    : 'bg-[#404040] text-neutral-500 cursor-not-allowed'
                                }`}
                                style={
                                    inputValue.trim() && !isSending && !isRateLimited
                                    ? { backgroundColor: themeColor }
                                    : {}
                                }
                             >
                                {isSending ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                )}
                             </button>
                        </div>
                    </div>
                </div>
                <p className="text-center text-[10px] text-neutral-600 mt-3 font-mono">
                    Created by BT4
                </p>
            </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;