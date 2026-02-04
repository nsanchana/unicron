import { useState, useEffect, useRef } from 'react'
import { Send, Mic, Sparkles, MessageSquare, Trash2, X, ChevronRight, ChevronLeft, Volume2, StopCircle, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { UNICRON_AI_VERSION } from '../config'

const UnicronAI = ({ userName, researchData, tradeData, stockData, settings, strategyNotes, chatHistory, onUpdateHistory }) => {
    const [messages, setMessages] = useState([])
    const [activeSessionId, setActiveSessionId] = useState(null)
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const messagesEndRef = useRef(null)
    const recognitionRef = useRef(null)
    const isFirstRender = useRef(true)
    const shouldScrollRef = useRef(false)

    // Initialize active session
    useEffect(() => {
        if (chatHistory && chatHistory.length > 0) {
            if (!activeSessionId) {
                // Default to most recent session
                const lastSession = [...chatHistory].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))[0] || chatHistory[chatHistory.length - 1]
                setActiveSessionId(lastSession.id)
                setMessages(lastSession.messages)
            } else {
                // If activeSessionId is set, make sure messages are in sync with chatHistory (e.g. from cloud)
                const currentSession = chatHistory.find(s => s.id === activeSessionId)
                if (currentSession && JSON.stringify(currentSession.messages) !== JSON.stringify(messages)) {
                    setMessages(currentSession.messages)
                }
            }
        } else if (!activeSessionId) {
            // No history, create first session
            handleNewChat(true)
        }
    }, [chatHistory])

    const handleNewChat = (isInitial = false) => {
        const newId = `session-${Date.now()}`
        const welcomeMessage = [{
            id: 'welcome',
            role: 'assistant',
            content: `I am Unicron AI. Greetings, ${userName}! I have access to your portfolio, trades, and strategy. How can I assist you today?`
        }]

        setActiveSessionId(newId)
        setMessages(welcomeMessage)

        const newSession = {
            id: newId,
            title: 'New Chat',
            messages: welcomeMessage,
            lastModified: new Date().toISOString()
        }

        const updatedHistory = isInitial ? [newSession] : [...chatHistory, newSession]
        onUpdateHistory(updatedHistory)
        if (!isInitial) setIsSidebarOpen(false)
    }

    const handleSwitchSession = (sessionId) => {
        const session = chatHistory.find(s => s.id === sessionId)
        if (session) {
            setActiveSessionId(sessionId)
            setMessages(session.messages)
            shouldScrollRef.current = true
            if (window.innerWidth < 768) setIsSidebarOpen(false)
        }
    }

    // Scroll to bottom on new message
    useEffect(() => {
        if (shouldScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            shouldScrollRef.current = false // Reset
        }
    }, [messages])

    // Voice Recognition Setup
    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition()
            recognition.continuous = false
            recognition.interimResults = false
            recognition.lang = 'en-US'

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript
                setInput(prev => prev ? `${prev} ${transcript}` : transcript)
                setIsListening(false)
            }

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error)
                setIsListening(false)
            }

            recognition.onend = () => {
                setIsListening(false)
            }

            recognitionRef.current = recognition
        }
    }, [])

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop()
        } else {
            setIsListening(true)
            recognitionRef.current?.start()
        }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = { id: Date.now().toString(), role: 'user', content: input }
        const updatedMessages = [...messages, userMessage]
        shouldScrollRef.current = true // Allow scroll for manual message
        setMessages(updatedMessages)
        setInput('')
        setIsLoading(true)

        // Prepare context
        const portfolioValue = settings.portfolioSize // Simplified, ideally calculated from stockData + cash
        // We can calculate actual total value if we had available cash + stock value
        // For now, let's use what we have available directly or assume settings.portfolioSize is the base capital

        // Construct simplified context summary
        const userContext = {
            userName,
            portfolio: {
                totalValue: settings.portfolioSize,
                allocated: tradeData.reduce((acc, t) => acc + (t.status !== 'Closed' ? (t.strike * 100) : 0), 0), // Rough estimate of exposure
                activeTradesCount: tradeData.filter(t => t.status !== 'Closed').length
            },
            strategyNotes,
            recentTrades: tradeData.slice(0, 5).map(t => ({
                symbol: t.symbol,
                type: t.type,
                strike: t.strike,
                expirationDate: t.expirationDate,
                premium: t.premium,
                status: t.status
            })),
            researchSummary: researchData.slice(0, 5).map(r => ({
                symbol: r.symbol,
                rating: r.overallRating
            }))
        }

        try {
            const response = await fetch('/api/unicron-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    userContext,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                })
            })

            const data = await response.json()

            if (response.ok) {
                const aiMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response }
                const finalMessages = [...updatedMessages, aiMessage]
                shouldScrollRef.current = true // Allow scroll for AI response
                setMessages(finalMessages)

                // Update history item in the array
                const updatedHistory = chatHistory.map(s => {
                    if (s.id === activeSessionId) {
                        const isNewChat = s.title === 'New Chat'
                        return {
                            ...s,
                            messages: finalMessages,
                            lastModified: new Date().toISOString(),
                            title: isNewChat ? (input.substring(0, 30) + (input.length > 30 ? '...' : '')) : s.title
                        }
                    }
                    return s
                })
                onUpdateHistory(updatedHistory)
            } else {
                const detailedError = data.details ? `${data.error}: ${data.details}` : data.error
                throw new Error(detailedError || 'Failed to get response')
            }
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage = error.message || "I'm having trouble connecting to the neural network. Please try again."
            shouldScrollRef.current = true // Allow scroll for error message
            const errorMessages = [...updatedMessages, { id: Date.now().toString(), role: 'assistant', content: `❌ **Error**: ${errorMessage}` }]
            setMessages(errorMessages)

            // Still save the user message even if AI failed
            const updatedHistory = chatHistory.map(s =>
                s.id === activeSessionId
                    ? { ...s, messages: errorMessages, lastModified: new Date().toISOString() }
                    : s
            )
            onUpdateHistory(updatedHistory)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteSession = (sessionId, e) => {
        e.stopPropagation()
        if (confirm('Delete this chat history?')) {
            const updatedHistory = chatHistory.filter(s => s.id !== sessionId)
            onUpdateHistory(updatedHistory)

            if (activeSessionId === sessionId) {
                if (updatedHistory.length > 0) {
                    const last = updatedHistory[0]
                    setActiveSessionId(last.id)
                    setMessages(last.messages)
                } else {
                    handleNewChat(true)
                }
            }
        }
    }

    const handleClearHistory = () => {
        if (confirm('Clear ALL chat sessions? This cannot be undone.')) {
            onUpdateHistory([])
            handleNewChat(true)
        }
    }

    return (
        <div className="mt-12 mb-8 relative group">
            {/* "Flashy" Background Glows */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 rounded-2xl opacity-20 blur-xl group-hover:opacity-40 transition duration-1000 animate-pulse"></div>

            <div className="relative glass-card border border-white/10 overflow-hidden flex flex-col md:flex-row h-[800px] transition-all duration-500">

                {/* Sidebar (Chat History / Settings) */}
                <div className={`
          ${isSidebarOpen ? 'w-64' : 'w-0'} 
          bg-[#0f172a]/95 backdrop-blur-xl border-r border-white/5 transition-all duration-300 relative overflow-hidden flex flex-col z-20
        `}>
                    <div className="p-4 border-b border-white/5 whitespace-nowrap space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare className="h-3 w-3" /> History
                        </h3>
                        <button
                            onClick={() => handleNewChat()}
                            className="w-full flex items-center justify-center gap-2 p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 border border-white/10"
                        >
                            <Sparkles className="h-3 w-3" /> New Chat
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
                        {chatHistory && [...chatHistory].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)).map(session => (
                            <div
                                key={session.id}
                                onClick={() => handleSwitchSession(session.id)}
                                className={`p-3 rounded-xl border cursor-pointer hover:bg-white/10 transition-all group/item relative ${activeSessionId === session.id ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/5 border-white/5'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold truncate ${activeSessionId === session.id ? 'text-blue-400' : 'text-gray-200'}`}>
                                            {session.title}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate mt-1">
                                            {session.messages[session.messages.length - 1]?.content || 'Empty Chat'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteSession(session.id, e)}
                                        className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-all"
                                        title="Delete Session"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                                {activeSessionId === session.id && (
                                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-white/5">
                        <button
                            onClick={handleClearHistory}
                            className="w-full flex items-center justify-center gap-2 p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider"
                        >
                            <Trash2 className="h-3 w-3" /> Wipe All History
                        </button>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#0f172a]/50 to-black/50">

                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                title="Toggle Sidebar"
                            >
                                {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg shadow-lg shadow-purple-500/20">
                                    <Sparkles className="h-5 w-5 text-white animate-pulse" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                                        UNICRON AI <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">BETA</span>
                                        <span className="text-[9px] text-gray-500 font-medium ml-1 opacity-50">{UNICRON_AI_VERSION}</span>
                                    </h2>
                                </div>
                            </div>
                        </div>
                        {/* Status Indicator */}
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-ping' : 'bg-emerald-400'}`}></div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hidden sm:block">
                                {isLoading ? 'Processing...' : 'Online'}
                            </span>
                        </div>
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`
                  max-w-[85%] rounded-2xl p-4 shadow-xl backdrop-blur-sm
                  ${msg.role === 'user'
                                        ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-tr-md'
                                        : 'bg-[#1e293b]/80 border border-white/10 text-gray-100 rounded-tl-md'}
                `}>
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${msg.role === 'user' ? 'text-blue-300 text-right' : 'text-purple-300'}`}>
                                            {msg.role === 'user' ? 'You' : 'Unicron AI'}
                                        </span>
                                        <div className="text-[13px] leading-relaxed max-w-none tracking-tight prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-img:rounded-xl prose-img:shadow-2xl prose-img:border prose-img:border-white/10">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 rounded-tl-md flex items-center gap-2">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-black/20 border-t border-white/10 backdrop-blur-md">
                        <div className="flex items-end gap-3 max-w-4xl mx-auto">
                            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-1 pl-4 flex items-center focus-within:bg-white/10 focus-within:border-white/20 transition-all shadow-inner">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Ask about your portfolio, specific trades, or market strategy..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 h-12 text-xs"
                                    disabled={isLoading}
                                />

                                {/* Voice Button */}
                                <button
                                    onClick={toggleListening}
                                    className={`
                      p-3 rounded-xl transition-all duration-300 mx-1
                      ${isListening
                                            ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                                            : 'text-gray-400 hover:text-white hover:bg-white/10'}
                    `}
                                    title="Voice Input"
                                >
                                    {isListening ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                                </button>
                            </div>

                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className={`
                   h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg
                   ${!input.trim() || isLoading
                                        ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                                        : 'bg-gradient-to-br from-blue-600 to-purple-600 text-white hover:shadow-blue-500/25 hover:scale-105 border border-white/10'}
                 `}
                            >
                                <Send className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-[10px] text-gray-600 font-medium">
                                AI can make mistakes. Consider checking important information.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default UnicronAI
