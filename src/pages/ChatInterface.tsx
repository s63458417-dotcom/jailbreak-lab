
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/Layout';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToGemini } from '../services/geminiService';
import { marked } from 'marked';

// --- Types ---
interface ChatInterfaceProps {
    personaId: string;
    initialSessionId?: string;
}

// --- Components ---

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }) => {
      const language = lang || 'text';
      const escapedCode = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const encodedRaw = encodeURIComponent(text);
      return `
        <div class="code-block-wrapper relative group my-4 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900">
          <div class="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
            <span class="text-xs font-mono text-neutral-400 lowercase">${language}</span>
            <button class="copy-btn flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors" data-code="${encodedRaw}">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre class="p-4 overflow-x-auto custom-scrollbar text-sm font-mono leading-relaxed text-brand-100 bg-transparent m-0"><code class="language-${language}">${escapedCode}</code></pre>
        </div>
      `;
    };
    return marked.parse(content, { renderer });
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
        btn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg><span class="text-green-400">Copied!</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
      } catch (err) { console.error('Failed to copy', err); }
    };
    container.addEventListener('click', handleCopy);
    return () => container.removeEventListener('click', handleCopy);
  }, [htmlContent]);

  return <div ref={containerRef} className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:mb-4 prose-headings:font-bold prose-headings:text-neutral-100 prose-headings:mt-6 prose-headings:mb-3 prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline prose-code:text-brand-200 prose-code:font-mono prose-code:text-xs prose-code:bg-neutral-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-strong:text-white prose-ul:list-disc prose-ul:pl-4 prose-ul:my-4 prose-ol:list-decimal prose-ol:pl-4 prose-ol:my-4 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0 prose-pre:rounded-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ personaId, initialSessionId }) => {
  const { personas, getUserSessions, createSession, getSession, saveMessageToSession, renameSession, deleteSession } = useStore();
  const { user, getPersonaAccessTime, isAdmin } = useAuth();
  const persona = personas.find(p => p.id === personaId);
  
  // -- Local State --
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar
  const [historyList, setHistoryList] = useState<any[]>([]); // List of past chats
  
  // Renaming State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Session Initialization Logic
  useEffect(() => {
      if (!user || !persona) return;

      // Fetch all sessions for this persona
      const sessions = getUserSessions(user.id, personaId);
      setHistoryList(sessions);

      // Determine which session to load
      let targetId = activeSessionId;
      
      // If URL has ID, verify it exists. If not, fallback.
      if (initialSessionId) {
          const exists = sessions.find(s => s.id === initialSessionId);
          if (exists) targetId = initialSessionId;
          else targetId = null; 
      }

      // If no active session ID, try to load the most recent one OR create new
      if (!targetId) {
          if (sessions.length > 0) {
              // Load most recent
              targetId = sessions[0].id;
          } else {
              // Create first session
              targetId = createSession(user.id, personaId);
              // Refresh list
              setHistoryList(getUserSessions(user.id, personaId));
          }
      }

      // If we decided on a new ID that isn't in URL, update state (and potentially URL)
      if (targetId && targetId !== activeSessionId) {
         setActiveSessionId(targetId);
         // Update URL without reloading to allow bookmarking
         window.history.replaceState(null, '', `#/chat/${personaId}/${targetId}`);
      }
  }, [personaId, user, createSession, getUserSessions]);

  // 2. Load Messages when Active Session Changes
  useEffect(() => {
      if (!activeSessionId) return;
      const session = getSession(activeSessionId);
      if (session) {
          setMessages(session.messages);
      }
  }, [activeSessionId, getSession]);

  // 3. Security Check
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

  // 4. Auto-Scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  // --- Actions ---

  const handleCreateNewSession = () => {
      if (!user || !persona) return;
      const newId = createSession(user.id, persona.id);
      setActiveSessionId(newId);
      setHistoryList(getUserSessions(user.id, persona.id)); // Update list
      setMessages([]); // Clear view immediately
      window.history.pushState(null, '', `#/chat/${persona.id}/${newId}`);
      if (window.innerWidth < 1024) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const handleSwitchSession = (sessionId: string) => {
      setActiveSessionId(sessionId);
      window.history.pushState(null, '', `#/chat/${personaId}/${sessionId}`);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (confirm("Permanently delete this operation log?")) {
          deleteSession(sessionId);
          // If we deleted the active one, switch to another or create new
          const remaining = getUserSessions(user!.id, personaId).filter(s => s.id !== sessionId);
          setHistoryList(remaining);
          
          if (activeSessionId === sessionId) {
              if (remaining.length > 0) {
                  handleSwitchSession(remaining[0].id);
              } else {
                  handleCreateNewSession();
              }
          }
      }
  };

  const startRenaming = (e: React.MouseEvent, session: any) => {
      e.stopPropagation();
      setRenamingId(session.id);
      setRenameValue(session.title);
  };

  const saveRename = (e: React.FormEvent) => {
      e.preventDefault();
      if (renamingId && renameValue.trim()) {
          renameSession(renamingId, renameValue.trim());
          // Refresh list locally
          setHistoryList(prev => prev.map(s => s.id === renamingId ? { ...s, title: renameValue.trim() } : s));
          setRenamingId(null);
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !activeSessionId || !persona) return;

    const textPayload = inputValue.trim();
    setInputValue('');
    
    // 1. Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textPayload,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveMessageToSession(activeSessionId, userMsg);
    
    setIsSending(true);

    try {
      // 2. Prepare Connection
      const sessionData = getSession(activeSessionId); // Get fresh state
      const history = sessionData ? sessionData.messages : messages;

      const apiSession = await createChatSession(
          persona.model,
          persona.systemPrompt,
          history, // Send full history context
          persona.baseUrl,
          persona.customApiKey
      );

      // 3. Send
      const responseText = await sendMessageToGemini(apiSession, textPayload);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, modelMsg]);
      saveMessageToSession(activeSessionId, modelMsg);
      
      // Update history list sort order (last modified updated)
      if (user) setHistoryList(getUserSessions(user.id, persona.id));

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: error.message || "**SYSTEM ERROR:** Uplink unstable. Retrying advisable.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  if (!persona) return <Layout title="Error" isChatMode={true}><div className="flex h-full items-center justify-center text-red-500 font-mono">[ERROR]: TARGET INVALID</div></Layout>;

  const activeSession = historyList.find(s => s.id === activeSessionId);

  return (
    <Layout title={persona.name} isChatMode={true}>
      <div className="flex h-full bg-neutral-950 overflow-hidden relative">
        
        {/* Mobile History Toggle Overlay */}
        {isSidebarOpen && (
            <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* History Sidebar */}
        <div className={`
            fixed lg:relative z-50 w-72 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-300
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Mission Logs</h3>
                <button onClick={handleCreateNewSession} className="p-1.5 bg-brand-600 text-white rounded hover:bg-brand-500 transition-colors" title="New Operation">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {historyList.map(session => (
                    <div 
                        key={session.id}
                        onClick={() => handleSwitchSession(session.id)}
                        className={`group flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer transition-all ${activeSessionId === session.id ? 'bg-neutral-800 border border-neutral-700 shadow-sm' : 'hover:bg-neutral-800/50 border border-transparent'}`}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeSessionId === session.id ? 'bg-green-500' : 'bg-neutral-600'}`}></div>
                        
                        {renamingId === session.id ? (
                            <form onSubmit={saveRename} className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                                <input 
                                    autoFocus
                                    className="w-full bg-neutral-950 text-xs text-white px-1 py-0.5 rounded border border-brand-500 outline-none"
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onBlur={() => setRenamingId(null)}
                                />
                            </form>
                        ) : (
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-300'}`}>
                                    {session.title}
                                </div>
                                <div className="text-[10px] text-neutral-600 font-mono truncate">
                                    {new Date(session.lastModified).toLocaleDateString()}
                                </div>
                            </div>
                        )}

                        {activeSessionId === session.id && !renamingId && (
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => startRenaming(e, session)} className="p-1 text-neutral-500 hover:text-white" title="Rename">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={(e) => handleDeleteSession(e, session.id)} className="p-1 text-neutral-500 hover:text-red-400" title="Delete">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full bg-neutral-950 relative w-full min-w-0">
            
            {/* Header */}
            <div className="flex-shrink-0 h-14 border-b border-neutral-800 flex items-center justify-between px-4 lg:px-6 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-20" style={{ borderBottomColor: persona.themeColor }}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden text-neutral-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    {persona.avatarUrl && <img src={persona.avatarUrl} className="w-6 h-6 rounded object-cover border border-neutral-700 hidden sm:block" />}
                    <div className="flex flex-col min-w-0">
                        <h1 className="font-bold text-white text-sm flex items-center gap-2 truncate">
                            {persona.name}
                            <span className="text-neutral-600 px-1">/</span>
                            <span className="text-neutral-400 font-normal truncate">{activeSession?.title}</span>
                        </h1>
                    </div>
                </div>
                <div className="text-[10px] font-mono text-green-500 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="hidden sm:inline">ONLINE</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-60 select-none pb-20 animate-in fade-in zoom-in duration-500">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6 shadow-xl">
                            {persona.avatarUrl ? <img src={persona.avatarUrl} className="w-8 h-8 opacity-50 grayscale" /> : <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                        </div>
                        <h3 className="text-lg font-medium text-neutral-300 mb-2">{persona.name} Initialized</h3>
                        <p className="max-w-md text-center text-sm font-mono text-neutral-500">{activeSession?.title}</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] lg:max-w-[80%] p-5 rounded-2xl text-base shadow-sm ${msg.role === 'user' ? 'bg-neutral-800 text-white rounded-br-none border border-neutral-700' : 'bg-transparent text-neutral-200 pl-0'}`}>
                            {msg.role === 'model' && (
                                <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider select-none" style={{ color: persona.themeColor || '#ef4444' }}>
                                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] border" style={{ backgroundColor: `${persona.themeColor || '#7f1d1d'}20`, borderColor: `${persona.themeColor || '#7f1d1d'}50` }}>AI</div>
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
                                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] border" style={{ backgroundColor: `${persona.themeColor || '#7f1d1d'}20`, borderColor: `${persona.themeColor || '#7f1d1d'}50` }}>AI</div>
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
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 bg-neutral-950 border-t border-neutral-800 z-20">
                <div className="max-w-4xl mx-auto relative">
                    <input
                        ref={inputRef}
                        className="w-full bg-neutral-900 border border-neutral-800 text-white pl-5 pr-14 py-4 rounded-xl focus:ring-1 outline-none transition-all shadow-lg font-sans placeholder:text-neutral-600 disabled:opacity-50"
                        style={{ borderColor: isSending ? undefined : (persona.themeColor ? `${persona.themeColor}50` : undefined) }}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder={`Message ${persona.name}...`}
                        disabled={isSending}
                        autoComplete="off"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isSending || !inputValue.trim()}
                        className="absolute right-2 top-2 bottom-2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:bg-transparent disabled:text-neutral-700 transition-colors"
                        style={!isSending && inputValue.trim() && persona.themeColor ? { backgroundColor: persona.themeColor } : {}}
                    >
                        {isSending ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                    </button>
                </div>
                <p className="text-center text-[10px] text-neutral-600 mt-2 font-mono">Encrypted Connection • Logged</p>
            </div>

        </div>
      </div>
    </Layout>
  );
};

export default ChatInterface;
