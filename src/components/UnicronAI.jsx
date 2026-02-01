import { useState, useEffect, useRef } from 'react'
import { Send, Mic, Sparkles, MessageSquare, Trash2, X, ChevronRight, ChevronLeft, Volume2, StopCircle, RefreshCw } from 'lucide-react'

const UnicronAI = ({ researchData, tradeData, stockData, settings, strategyNotes, chatHistory, onUpdateHistory }) => {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const messagesEndRef = useRef(null)
    const recognitionRef = useRef(null)
    const isFirstRender = useRef(true)

    // Initialize chat history from props or start fresh
    useEffect(() => {
        if (chatHistory && chatHistory.length > 0) {
            // Load the most recent conversation or empty/welcome state
            // For now, we'll just start empty or load the last session if we had session management
            // A simple approach is to load the last 20 messages if they exist
            if (messages.length === 0) {
                setMessages(chatHistory.slice(-50)) // Load last 50 messages
            }
        } else if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: "I am Unicron AI. I have access to your portfolio, trades, and strategy. How can I assist you today?"
            }])
        }
    }, [chatHistory])

    // Scroll to bottom on new message
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
        setMessages(updatedMessages)
        setInput('')
        setIsLoading(true)

        // Prepare context
        const portfolioValue = settings.portfolioSize // Simplified, ideally calculated from stockData + cash
        // We can calculate actual total value if we had available cash + stock value
        // For now, let's use what we have available directly or assume settings.portfolioSize is the base capital

        // Construct simplified context summary
        const userContext = {
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
                    history: updatedMessages.map(m => ({ role: m.role, content: m.content }))
                })
            })

            const data = await response.json()

            if (response.ok) {
                const aiMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response }
                const finalMessages = [...updatedMessages, aiMessage]
                setMessages(finalMessages)
                onUpdateHistory(finalMessages) // Sync to App.jsx -> Cloud
            } else {
                const detailedError = data.details ? `${data.error}: ${data.details}` : data.error
                throw new Error(detailedError || 'Failed to get response')
            }
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage = error.message || "I'm having trouble connecting to the neural network. Please try again."
            setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: `❌ **Error**: ${errorMessage}` }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleClearHistory = () => {
        if (confirm('Clear chat history? This cannot be undone.')) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: "Chat history cleared. I am ready for new queries."
            }])
            onUpdateHistory([])
        }
    }

    return (
        <div className="mt-12 mb-8 relative group">
            {/* "Flashy" Background Glows */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-blue-600 to-emerald-600 rounded-2xl opacity-20 blur-xl group-hover:opacity-40 transition duration-1000 animate-pulse"></div>

            <div className="relative glass-card border border-white/10 overflow-hidden flex flex-col md:flex-row h-[600px] transition-all duration-500">

                {/* Sidebar (Chat History / Settings) */}
                <div className={`
          ${isSidebarOpen ? 'w-64' : 'w-0'} 
          bg-black/40 border-r border-white/5 transition-all duration-300 relative overflow-hidden flex flex-col
        `}>
                    <div className="p-4 border-b border-white/5 whitespace-nowrap">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare className="h-3 w-3" /> History
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {/* Placeholder for session list - for now just one active session */}
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <div className="text-xs font-bold text-white mb-1">Current Session</div>
                            <div className="text-[10px] text-gray-500 truncate">
                                {messages.length > 1 ? messages[messages.length - 1].content : 'New Chat'}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-white/5">
                        <button
                            onClick={handleClearHistory}
                            className="w-full flex items-center justify-center gap-2 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                            <Trash2 className="h-3 w-3" /> Clear Chat
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
                                        <div className="prose prose-invert prose-sm max-w-none leading-relaxed" dangerouslySetInnerHTML={{
                                            // Simple formatted text rendering if model returns markdown-like syntax
                                            // For production, use a library like ReactMarkdown. handling basic spacing here.
                                            __html: msg.content.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                                        }} />
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
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 h-12 text-sm"
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
