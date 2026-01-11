
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, ModelType, AppState, Message, ChatSession, Attachment } from './types';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import KeySelector from './components/KeySelector';
import MessageActions from './components/MessageActions';
import AttachmentMenu from './components/AttachmentMenu';
import DeepResearchView from './components/DeepResearchView';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    mode: AppMode.CHAT,
    model: ModelType.PRO,
    isThinking: false,
    useSearch: false,
    messages: [],
    sessions: [],
    currentSessionId: null,
    isGenerating: false,
    hasKey: false,
    canvasContent: "",
    isCanvasOpen: false,
    sidebarOpen: true
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Dropdown states
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const hasMessages = state.messages.length > 0;

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.isGenerating]);

  // Sync messages
  useEffect(() => {
    if (state.currentSessionId && state.messages.length > 0) {
      setState(prev => {
        const updatedSessions = prev.sessions.map(session => {
          if (session.id === prev.currentSessionId) {
            let title = session.title;
            if (title === "新しいチャット" && prev.messages.length > 0) {
              const firstUserMsg = prev.messages.find(m => m.role === 'user');
              if (firstUserMsg) {
                title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
              }
            }
            return {
              ...session,
              messages: prev.messages,
              title: title,
              timestamp: Date.now(),
              mode: prev.mode,
              isThinking: prev.isThinking
            };
          }
          return session;
        });
        return { ...prev, sessions: updatedSessions };
      });
    }
  }, [state.messages, state.mode, state.isThinking]);

  useEffect(() => {
    if (state.mode === AppMode.CANVAS && !state.isCanvasOpen) {
        setState(prev => ({ ...prev, isCanvasOpen: true }));
    }
  }, [state.mode]);

  const createNewSession = () => {
    const newSessionId = Math.random().toString(36).substring(7);
    const newSession: ChatSession = {
      id: newSessionId,
      title: "新しいチャット",
      messages: [],
      timestamp: Date.now(),
      mode: state.mode,
      isThinking: state.isThinking
    };
    
    setState(prev => ({
      ...prev,
      sessions: [newSession, ...prev.sessions],
      currentSessionId: newSessionId,
      messages: []
    }));
    setPendingAttachments([]);
  };

  const switchSession = (sessionId: string) => {
    const session = state.sessions.find(s => s.id === sessionId);
    if (session) {
      setState(prev => ({
        ...prev,
        currentSessionId: sessionId,
        messages: session.messages,
        mode: session.mode,
        isThinking: session.isThinking || false,
        isCanvasOpen: session.mode === AppMode.CANVAS,
        model: session.mode === AppMode.DEEP_RESEARCH ? ModelType.PRO : 
               session.mode === AppMode.CANVAS ? ModelType.PRO :
               (session.isThinking ? ModelType.PRO : ModelType.PRO)
      }));
      setPendingAttachments([]);
    }
  };

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...msg,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));
    return newMessage.id;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  // File Handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const result = readEvent.target?.result as string;
        const newAttachment: Attachment = {
          id: Math.random().toString(36).substring(7),
          type: file.type.startsWith('image/') ? 'image' : 'file',
          mimeType: file.type,
          data: result,
          name: file.name
        };
        setPendingAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isGenerating: false }));
  };

  const resetMode = () => {
    setState(prev => ({
        ...prev,
        mode: AppMode.CHAT,
        isCanvasOpen: false
    }));
  };

  const handleStartDeepResearch = async (messageId: string, steps: string[]) => {
    // Update message state to in_progress with confirmed steps
    updateMessage(messageId, {
        researchSteps: steps,
        researchState: 'in_progress',
        currentResearchStep: 0
    });

    setState(prev => ({ ...prev, isGenerating: true }));

    // Find original query
    const messageIndex = state.messages.findIndex(m => m.id === messageId);
    const userMessage = state.messages[messageIndex - 1];
    const originalQuery = userMessage?.content || steps.join(' ');

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
        let streamedContent = "";
        
        // Use the new agentic method
        const result = await geminiService.executeDeepResearch(
            originalQuery,
            steps,
            (stepIndex) => {
                // Update active step in UI
                updateMessage(messageId, { currentResearchStep: stepIndex });
            },
            (chunk) => {
                // Update content (Report)
                if (signal.aborted) return;
                streamedContent += chunk;
                updateMessage(messageId, { content: streamedContent });
            },
            signal
        );

        if (!signal.aborted) {
            updateMessage(messageId, { 
                researchState: 'completed', 
                groundingUrls: result.groundingUrls 
            });
        }
    } catch (error: any) {
        if (error.name !== 'AbortError') {
             console.error(error);
             updateMessage(messageId, { content: "エラーが発生しました: " + (error.message || "Unknown error") });
        }
    } finally {
        abortControllerRef.current = null;
        setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || state.isGenerating) return;

    if (!state.currentSessionId) {
      createNewSession();
    }

    const currentInput = input;
    const currentAttachments = [...pendingAttachments];
    
    setInput("");
    setPendingAttachments([]);
    
    addMessage({
      role: 'user',
      content: currentInput,
      type: 'text',
      attachments: currentAttachments
    });

    setState(prev => {
        if (!prev.currentSessionId) {
           const newId = Math.random().toString(36).substring(7);
           const newSession = {
             id: newId,
             title: currentInput.slice(0, 20) + "...",
             messages: [],
             timestamp: Date.now(),
             mode: prev.mode,
             isThinking: prev.isThinking
           };
           return {
             ...prev,
             sessions: [newSession, ...prev.sessions],
             currentSessionId: newId,
             isGenerating: true
           };
        }
        return { ...prev, isGenerating: true };
    });

    // Setup AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (state.mode === AppMode.IMAGE_GENERATION) {
        const assistantMsgId = addMessage({
            role: 'assistant',
            content: "", 
            type: 'text'
        });
        const result = await geminiService.generateImage(currentInput);
        if (!signal.aborted) {
            updateMessage(assistantMsgId, {
                content: result.text || "画像が生成されました",
                type: 'image',
                images: result.images
            });
        }
      } else if (state.mode === AppMode.VIDEO_GENERATION) {
        const assistantMsgId = addMessage({
            role: 'assistant',
            content: "動画を生成しています... (数分かかる場合があります)", 
            type: 'text'
        });
        const videoUri = await geminiService.generateVideo(currentInput);
        if (!signal.aborted) {
            updateMessage(assistantMsgId, {
                content: "動画が生成されました",
                type: 'video',
                videoUri: videoUri
            });
        }
      } else if (state.mode === AppMode.DEEP_RESEARCH) {
        // Deep Research Flow
        
        // 1. Create a placeholder message for Research Status
        const assistantMsgId = addMessage({
            role: 'assistant',
            content: "",
            type: 'deep_research',
            researchState: 'planning',
            researchSteps: []
        });

        // 2. Step 1: Generate Plan
        const steps = await geminiService.createResearchPlan(currentInput);
        
        if (signal.aborted) return;

        updateMessage(assistantMsgId, {
            researchSteps: steps,
            researchState: 'proposed' // Pause here for user confirmation
        });

        // We stop generation here to wait for user interaction
        setState(prev => ({ ...prev, isGenerating: false }));
        abortControllerRef.current = null;

      } else {
        // Normal Chat, Canvas
        const assistantMsgId = addMessage({
          role: 'assistant',
          content: "", 
          type: 'text'
        });

        let streamedContent = "";
        const tempUserMessage: Message = { 
             role: 'user', 
             content: currentInput, 
             type: 'text', 
             id: 'temp', 
             timestamp: Date.now(),
             attachments: currentAttachments
        };

        const currentHistory = [...state.messages, tempUserMessage];

        await geminiService.generateText(
          state.model,
          currentHistory,
          state.mode,
          state.isThinking,
          state.canvasContent, 
          (chunk) => {
            if (signal.aborted) return;
            streamedContent += chunk;
            
            if (state.mode === AppMode.CANVAS) {
                setState(prev => ({ ...prev, canvasContent: streamedContent }));
                updateMessage(assistantMsgId, { content: streamedContent });
            } else {
                updateMessage(assistantMsgId, { content: streamedContent });
            }
          },
          signal
        );
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
          addMessage({
            role: 'assistant',
            content: "エラーが発生しました: " + (error.message || "Unknown error"),
            type: 'error'
          });
          if (error.message?.includes("not found")) {
            setState(prev => ({ ...prev, hasKey: false }));
          }
      }
    } finally {
      // For deep research, we might have already stopped earlier, but this is safe
      if (state.mode !== AppMode.DEEP_RESEARCH) {
        abortControllerRef.current = null;
        setState(prev => ({ ...prev, isGenerating: false }));
      }
    }
  };

  // Switch Model (Fast, Thinking, Pro)
  const handleModelSelect = (option: 'fast' | 'thinking' | 'pro') => {
    setState(prev => {
        let newState = { ...prev, modelDropdownOpen: false };
        switch (option) {
            case 'fast':
                newState.model = ModelType.FLASH;
                newState.isThinking = false;
                break;
            case 'thinking':
                newState.model = ModelType.PRO;
                newState.isThinking = true;
                break;
            case 'pro':
                newState.model = ModelType.PRO;
                newState.isThinking = false;
                break;
        }
        return newState;
    });
  };

  // Switch Tool/Mode (Deep Research, Image, Video, Canvas)
  const handleToolSelect = (tool: 'deep_research' | 'video' | 'image' | 'canvas' | 'guide') => {
    setState(prev => {
        let newState = { ...prev, toolsDropdownOpen: false, mode: AppMode.CHAT, isCanvasOpen: false };
        switch(tool) {
            case 'deep_research':
                newState.mode = AppMode.DEEP_RESEARCH;
                newState.model = ModelType.PRO;
                break;
            case 'video':
                newState.mode = AppMode.VIDEO_GENERATION;
                break;
            case 'image':
                newState.mode = AppMode.IMAGE_GENERATION;
                break;
            case 'canvas':
                newState.mode = AppMode.CANVAS;
                newState.isCanvasOpen = true;
                newState.model = ModelType.PRO;
                break;
            case 'guide':
                // Placeholder
                break;
        }
        return newState;
    });
  };

  const getModelLabel = () => {
    if (state.model === ModelType.FLASH) return 'Fast';
    if (state.isThinking) return 'Thinking';
    return 'Pro';
  };
  
  const getModeIcon = () => {
      switch(state.mode) {
          case AppMode.DEEP_RESEARCH: return 'fas fa-search-location';
          case AppMode.VIDEO_GENERATION: return 'fas fa-video';
          case AppMode.IMAGE_GENERATION: return 'fas fa-image';
          case AppMode.CANVAS: return 'fas fa-pen-nib';
          default: return 'fas fa-sparkles';
      }
  };

  const getModeLabel = () => {
      switch(state.mode) {
          case AppMode.DEEP_RESEARCH: return 'Deep Research';
          case AppMode.VIDEO_GENERATION: return '動画を作成 (Veo 3.1)';
          case AppMode.IMAGE_GENERATION: return '画像を作成';
          case AppMode.CANVAS: return 'Canvas';
          default: return '';
      }
  };

  const renderMarkdown = (text: string) => {
    // @ts-ignore
    if (typeof window.marked !== 'undefined') {
        // @ts-ignore
        return { __html: window.marked.parse(text) };
    }
    return { __html: text };
  };

  // Render the Input Bar component logic (extracted to avoid duplication)
  const renderInputBar = () => (
    <div className="relative">
        {/* Pending Attachments & Active Mode Indicator */}
        {(pendingAttachments.length > 0 || (state.mode !== AppMode.CHAT)) && (
            <div className="flex gap-2 mb-2 overflow-x-auto p-2 items-center">
                {/* Active Mode Chip */}
                {state.mode !== AppMode.CHAT && (
                    <div className="flex items-center gap-2 bg-[#1E1F20] text-[#A8C7FA] px-3 py-1.5 rounded-lg border border-[#444746] text-xs whitespace-nowrap">
                        <i className={`${getModeIcon()}`}></i>
                        <span>{getModeLabel()}</span>
                        <button 
                            onClick={resetMode}
                            className="ml-1 hover:bg-[#2D2E31] rounded-full w-5 h-5 flex items-center justify-center text-[#C4C7C5] hover:text-white transition-colors"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}

                {/* Attachments */}
                {pendingAttachments.map(att => (
                    <div key={att.id} className="relative group flex-shrink-0">
                        {att.type === 'image' ? (
                            <img src={att.data} className="h-16 w-16 rounded-lg object-cover border border-[#444746]" alt="Preview" />
                        ) : (
                            <div className="h-16 w-16 bg-[#2D2E31] rounded-lg border border-[#444746] flex items-center justify-center text-[#C4C7C5]">
                                <i className="fas fa-file"></i>
                            </div>
                        )}
                        <button 
                            onClick={() => removeAttachment(att.id)}
                            className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* Main Input Pill */}
        <form onSubmit={handleSubmit} className={`bg-[#1E1F20] rounded-[28px] flex items-end transition-colors relative ${state.isGenerating ? 'opacity-80' : ''}`}>
            
            {/* Left Controls: Plus & Tools */}
            <div className="flex items-center pl-2 pb-1 gap-1">
                {/* Attachment Button */}
                <div className="relative">
                    <button 
                        type="button"
                        disabled={state.isGenerating}
                        onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E31] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fas fa-plus"></i>
                    </button>
                    
                    <AttachmentMenu 
                        isOpen={attachmentMenuOpen} 
                        onClose={() => setAttachmentMenuOpen(false)}
                        onUploadFile={() => fileInputRef.current?.click()}
                        onDriveSelect={() => alert("Googleドライブ連携機能（シミュレーション）")}
                        onPhotosSelect={() => alert("Googleフォト連携機能（シミュレーション）")}
                    />
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        multiple 
                    />
                </div>

                {/* Tools Button */}
                <div className="relative">
                    <button 
                        type="button"
                        disabled={state.isGenerating}
                        onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#2D2E31] hover:bg-[#38393A] text-[#E3E3E3] text-sm transition-colors border border-transparent hover:border-[#444746] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className={`${getModeIcon()} text-xs text-[#A8C7FA]`}></i>
                        <span className="font-medium">ツール</span>
                    </button>

                    {/* Tools Dropdown Menu */}
                    {toolsDropdownOpen && (
                        <>
                        <div className="fixed inset-0 z-30" onClick={() => setToolsDropdownOpen(false)}></div>
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1E1F20] border border-[#444746] rounded-2xl shadow-2xl z-40 overflow-hidden py-1">
                            {[
                                { id: 'deep_research', label: 'Deep Research', icon: 'fas fa-search-location' },
                                { id: 'video', label: '動画を作成 (Veo 3.1)', icon: 'fas fa-video' },
                                { id: 'image', label: '画像を作成', icon: 'fas fa-image' },
                                { id: 'canvas', label: 'Canvas', icon: 'fas fa-pen-nib' },
                                { id: 'guide', label: 'ガイド付き学習', icon: 'fas fa-book-open' }
                            ].map((tool: any) => (
                                <button 
                                    key={tool.id}
                                    onClick={() => handleToolSelect(tool.id)}
                                    className="w-full text-left px-4 py-3 hover:bg-[#2D2E31] flex items-center gap-3 transition-colors text-[#E3E3E3]"
                                >
                                    <i className={`${tool.icon} w-5 text-center text-[#C4C7C5]`}></i>
                                    <span className="text-sm">{tool.label}</span>
                                </button>
                            ))}
                        </div>
                        </>
                    )}
                </div>
            </div>

            {/* Text Input */}
            <textarea
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                    }
                }}
                placeholder={
                    state.mode === AppMode.IMAGE_GENERATION ? "どんな画像を生成しますか？" :
                    state.mode === AppMode.VIDEO_GENERATION ? "どんな動画を生成しますか？" :
                    "Gemini 3 に相談"
                }
                disabled={state.isGenerating}
                rows={1}
                className="flex-1 bg-transparent border-none text-[#E3E3E3] py-4 px-3 focus:outline-none placeholder-[#8E918F] text-[15px] resize-none max-h-[150px] custom-scrollbar disabled:cursor-not-allowed"
                style={{ height: '56px' }}
            />

            {/* Right Side Controls: Model & Mic/Send */}
            <div className="flex items-center gap-2 pr-4 pb-2 mb-1">
                {/* Model Selector (Right side) */}
                <div className="relative">
                    <button 
                        type="button"
                        disabled={state.isGenerating}
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        className="flex items-center gap-1 text-xs font-medium text-[#C4C7C5] hover:text-[#E3E3E3] transition-colors px-2 py-1 rounded hover:bg-[#2D2E31] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {getModelLabel()}
                        <i className={`fas fa-caret-down text-[10px] transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`}></i>
                    </button>

                    {modelDropdownOpen && (
                        <>
                        <div className="fixed inset-0 z-30" onClick={() => setModelDropdownOpen(false)}></div>
                        <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#1E1F20] border border-[#444746] rounded-xl shadow-2xl z-40 overflow-hidden py-2">
                            <div className="px-4 py-2 text-xs font-medium text-[#8E918F]">Gemini 3</div>
                            
                            <button 
                                onClick={() => handleModelSelect('fast')}
                                className="w-full text-left px-4 py-2.5 hover:bg-[#2D2E31] flex items-center justify-between transition-colors"
                            >
                                <div>
                                    <div className="text-sm font-medium text-[#E3E3E3]">高速モード</div>
                                    <div className="text-[11px] text-[#C4C7C5]">素早く回答</div>
                                </div>
                                {state.model === ModelType.FLASH && <span className="text-[#A8C7FA] text-xs"><i className="fas fa-check"></i></span>}
                            </button>

                            <button 
                                onClick={() => handleModelSelect('thinking')}
                                className="w-full text-left px-4 py-2.5 hover:bg-[#2D2E31] flex items-center justify-between transition-colors"
                            >
                                <div>
                                    <div className="text-sm font-medium text-[#E3E3E3]">思考モード</div>
                                    <div className="text-[11px] text-[#C4C7C5]">複雑な問題を解決</div>
                                </div>
                                {state.isThinking && <span className="text-[#A8C7FA] text-xs"><i className="fas fa-check"></i></span>}
                            </button>

                            <button 
                                onClick={() => handleModelSelect('pro')}
                                className="w-full text-left px-4 py-2.5 hover:bg-[#2D2E31] flex items-center justify-between transition-colors"
                            >
                                <div>
                                    <div className="text-sm font-medium text-[#E3E3E3]">Pro</div>
                                    <div className="text-[11px] text-[#C4C7C5]">高度な数学とコード</div>
                                </div>
                                {state.model === ModelType.PRO && !state.isThinking && <span className="text-[#A8C7FA] text-xs"><i className="fas fa-check"></i></span>}
                            </button>
                        </div>
                        </>
                    )}
                </div>

                {/* Mic / Submit / Stop Button */}
                {state.isGenerating ? (
                    <button 
                        type="button"
                        onClick={handleStopGeneration}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3E3E3] text-[#131314] hover:bg-white transition-colors"
                    >
                        <i className="fas fa-stop text-xs"></i>
                    </button>
                ) : (input.trim() || pendingAttachments.length > 0) ? (
                    <button 
                        onClick={handleSubmit}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3E3E3] text-[#131314] hover:bg-white transition-colors"
                    >
                        <i className="fas fa-arrow-up text-xs"></i>
                    </button>
                ) : (
                    <button className="w-9 h-9 flex items-center justify-center rounded-full text-[#E3E3E3] hover:bg-[#2D2E31] transition-colors">
                        <i className="fas fa-microphone text-sm"></i>
                    </button>
                )}
            </div>
        </form>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#131314] text-[#E3E3E3] overflow-hidden font-sans">
      {!state.hasKey && (
        <KeySelector onKeySelected={() => setState(prev => ({ ...prev, hasKey: true }))} />
      )}

      <Sidebar 
        state={state} 
        setState={setState} 
        onCreateSession={createNewSession}
        onSwitchSession={switchSession}
      />

      <main className="flex-1 flex flex-col relative h-full min-w-0">
        
        {/* Header - Minimal navigation */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-4 bg-[#131314] z-20">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setState(prev => ({...prev, sidebarOpen: !prev.sidebarOpen}))}
                    className="p-2 rounded-full hover:bg-[#2D2E31] text-[#C4C7C5] transition-colors"
                >
                    <i className="fas fa-bars"></i>
                </button>
                <div className="text-xl font-google text-[#E3E3E3]">Gemini</div>
            </div>

            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285F4] to-[#9B72CB] flex items-center justify-center text-white text-xs font-bold shadow-lg">
                AJ
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
            
            <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${state.isCanvasOpen ? 'max-w-[55%]' : 'max-w-full'}`}>
                
                {!hasMessages ? (
                    // Initial State: Centered Content
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                        <div className="max-w-3xl w-full">
                            <div className="mb-8 pl-4">
                                <h1 className="text-3xl md:text-4xl font-google font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#4285F4] to-[#D96570] mb-2 tracking-tight">
                                    AJ Gemini Studio
                                </h1>
                                <div className="text-[#444746] font-medium leading-relaxed">
                                    <p className="text-base md:text-lg text-[#C4C7C5]">今日はどのようなお手伝いをしましょうか？</p>
                                    <p className="text-base md:text-lg text-[#C4C7C5]">こちらはAPI利用でProが制限なく使用可能です</p>
                                </div>
                            </div>
                            
                            {/* Centered Input */}
                            <div className="mb-4">
                                {renderInputBar()}
                            </div>

                            {/* Suggestion Chips - Compact Single Line */}
                            <div className="flex items-center justify-center gap-2 mt-3 overflow-x-auto no-scrollbar w-full px-2 md:px-0">
                                <div className="flex flex-nowrap gap-2">
                                    <button onClick={() => handleToolSelect('image')} className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#444746] bg-[#1E1F20] hover:bg-[#2D2E31] text-[#E3E3E3] text-xs font-medium flex items-center gap-2 transition-colors">
                                        <span className="text-sm">🎨</span>
                                        画像の作成
                                    </button>
                                    <button onClick={() => handleToolSelect('video')} className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#444746] bg-[#1E1F20] hover:bg-[#2D2E31] text-[#E3E3E3] text-xs font-medium flex items-center gap-2 transition-colors">
                                        <span className="text-sm">🎥</span>
                                        動画の作成
                                    </button>
                                    <button onClick={() => handleToolSelect('canvas')} className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#444746] bg-[#1E1F20] hover:bg-[#2D2E31] text-[#E3E3E3] text-xs font-medium flex items-center gap-2 transition-colors">
                                        <span className="text-sm">📝</span>
                                        何でも書く
                                    </button>
                                    <button onClick={() => handleToolSelect('deep_research')} className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#444746] bg-[#1E1F20] hover:bg-[#2D2E31] text-[#E3E3E3] text-xs font-medium flex items-center gap-2 transition-colors">
                                        <span className="text-sm">🎓</span>
                                        知識習得サポート
                                    </button>
                                    <button 
                                        onClick={() => setInput("面白い話をして一日を盛り上げて！")}
                                        className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#444746] bg-[#1E1F20] hover:bg-[#2D2E31] text-[#E3E3E3] text-xs font-medium flex items-center gap-2 transition-colors"
                                    >
                                        <span className="text-sm">🎉</span>
                                        一日を盛り上げる
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Chat State: Messages + Bottom Input
                    <>
                        {/* Messages Area */}
                        <div 
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6"
                        >
                            {state.messages.map((message) => (
                                <div key={message.id} className={`flex gap-4 max-w-3xl mx-auto ${message.role === 'user' ? 'justify-end' : ''}`}>
                                    {message.role === 'assistant' && (
                                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-1">
                                            {message.content === "" && state.isGenerating && message.type !== 'deep_research' ? (
                                                <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" alt="Thinking" className="w-full h-full animate-sparkle" />
                                            ) : (
                                                <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" alt="Gemini" className="w-full h-full" />
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className={`flex flex-col gap-1 max-w-[85%] ${message.role === 'user' ? 'items-end' : ''}`}>
                                        {/* Attachments Display for User */}
                                        {message.attachments && message.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2 justify-end">
                                                {message.attachments.map((att) => (
                                                    <div key={att.id} className="relative">
                                                        {att.type === 'image' ? (
                                                            <img src={att.data} alt={att.name} className="h-24 w-auto rounded-lg border border-[#444746]" />
                                                        ) : (
                                                            <div className="h-20 w-20 flex flex-col items-center justify-center bg-[#2D2E31] rounded-lg border border-[#444746] text-xs p-2 text-center overflow-hidden">
                                                                <i className="fas fa-file mb-1"></i>
                                                                <span className="truncate w-full">{att.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {message.content === "" && state.isGenerating && message.role === 'assistant' && message.type !== 'deep_research' ? (
                                            <div className="flex items-center gap-2 py-2 px-1">
                                                <div className="text-sm text-[#C4C7C5] animate-pulse">思考中...</div>
                                            </div>
                                        ) : (
                                            <div className={`py-2 px-4 rounded-2xl text-[14px] leading-6 group ${
                                                message.role === 'user' 
                                                    ? 'bg-[#2D2E31] text-[#E3E3E3] rounded-br-sm' 
                                                    : 'text-[#E3E3E3]'
                                            }`}>
                                                {/* Deep Research Plan View */}
                                                {message.type === 'deep_research' && message.researchSteps && (
                                                    <DeepResearchView 
                                                        steps={message.researchSteps} 
                                                        state={message.researchState || 'planning'}
                                                        currentStepIndex={message.currentResearchStep}
                                                        onStartResearch={(modifiedSteps) => handleStartDeepResearch(message.id, modifiedSteps)}
                                                    />
                                                )}

                                                {/* Content Type Rendering */}
                                                {message.type === 'image' && message.images ? (
                                                    <div className="grid gap-2">
                                                        {message.content && <p className="mb-2">{message.content}</p>}
                                                        {message.images.map((img, idx) => (
                                                            <img key={idx} src={img} className="rounded-xl w-full max-w-md border border-[#444746]" alt="Generated" />
                                                        ))}
                                                    </div>
                                                ) : message.type === 'video' && message.videoUri ? (
                                                    <div className="grid gap-2">
                                                        {message.content && <p className="mb-2">{message.content}</p>}
                                                        <video controls src={message.videoUri} className="rounded-xl w-full max-w-md border border-[#444746]" />
                                                    </div>
                                                ) : (
                                                    message.content && <div className="markdown-body" dangerouslySetInnerHTML={renderMarkdown(message.content)}></div>
                                                )}

                                                {message.groundingUrls && message.groundingUrls.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-[#444746]/50">
                                                        {message.groundingUrls.map((url, i) => (
                                                            <a key={i} href={url.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1E1F20] border border-[#444746] rounded-full text-[11px] text-[#A8C7FA] hover:bg-[#2D2E31] transition-colors no-underline">
                                                                <span className="truncate max-w-[120px]">{url.title}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}

                                                {message.role === 'assistant' && !state.isGenerating && (
                                                    <MessageActions content={message.content} model={state.model} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area (Footer) */}
                        <div className="flex-shrink-0 p-4 z-10">
                            <div className="max-w-3xl mx-auto relative">
                                {renderInputBar()}
                                
                                <div className="text-center mt-3 text-[10px] text-[#8E918F]">
                                    Gemini は不正確な情報を表示する場合があります。重要な情報は確認してください。
                                </div>
                            </div>
                        </div>
                    </>
                )}

            </div>

            {/* Canvas Panel */}
            <Canvas 
                content={state.canvasContent} 
                isOpen={state.isCanvasOpen} 
                onClose={() => setState(prev => ({...prev, isCanvasOpen: false}))}
                onChange={(newContent) => setState(prev => ({...prev, canvasContent: newContent}))}
            />

        </div>
      </main>
    </div>
  );
};

export default App;
