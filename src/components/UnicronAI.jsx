import { authHeaders } from '../utils/auth.js'
import { useState, useEffect, useRef } from 'react'
import { Send, Mic, Sparkles, MessageSquare, Trash2, ChevronRight, ChevronLeft, StopCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { UNICRON_AI_VERSION } from '../config'

const QUICK_PROMPTS = [
    { emoji: '⚠️', label: 'Assignment risk?', prompt: 'Which of my active trades are closest to assignment risk? Show strike vs current price for each.' },
    { emoji: '💰', label: 'Premium this month?', prompt: 'What is the total premium I have collected this month from executed trades?' },
    { emoji: '📅', label: 'Expiring soon?', prompt: 'Which of my trades expire in the next 14 days? List them with days remaining and variance.' },
    { emoji: '📊', label: 'Active positions', prompt: 'Give me a summary of all my active (non-expired, non-closed) trades with their current status.' },
    { emoji: '🐂', label: 'Bullish picks?', prompt: 'From my research history, which stocks have a Bullish sentiment (score ≥75)? Suggest which are good candidates for a cash-secured put.' },
    { emoji: '📣', label: 'Earnings risk?', prompt: 'Are there any upcoming earnings announcements that could affect my open trade positions before they expire?' },
    { emoji: '🎯', label: 'Max risk exposure?', prompt: 'What is my total maximum risk exposure right now across all active trades? Show max loss per trade and total.' },
    { emoji: '📈', label: 'Strategy review', prompt: 'Review my closed trades and overall performance. What patterns do you see? Any strategy improvements to suggest?' },
]

const UnicronAI = ({ userName, researchData, tradeData, stockData, settings, strategyNotes, chatHistory, onUpdateHistory, theme }) => {
    const [messages, setMessages] = useState([])
    const [activeSessionId, setActiveSessionId] = useState(null)
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const messagesEndRef = useRef(null)
    const recognitionRef = useRef(null)
    const shouldScrollRef = useRef(false)

    useEffect(() => {
        if (chatHistory && chatHistory.length > 0) {
            if (!activeSessionId) {
                const lastSession = [...chatHistory].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))[0] || chatHistory[chatHistory.length - 1]
                setActiveSessionId(lastSession.id)
                setMessages(lastSession.messages)
            } else {
                const currentSession = chatHistory.find(s => s.id === activeSessionId)
                if (currentSession && JSON.stringify(currentSession.messages) !== JSON.stringify(messages)) {
                    setMessages(currentSession.messages)
                }
            }
        } else if (!activeSessionId) {
            handleNewChat(true)
        }
    }, [chatHistory])

    const handleNewChat = (isInitial = false) => {
        const newId = `session-${Date.now()}`
        const welcomeMessage = [{
            id: 'welcome', role: 'assistant',
            content: `Hi ${userName}. I can see your full portfolio — active trades, research history, and strategy notes. Use the quick questions above for instant answers, or ask me anything about your positions, risk exposure, or next moves.`
        }]
        setActiveSessionId(newId)
        setMessages(welcomeMessage)
        const newSession = { id: newId, title: 'New Chat', messages: welcomeMessage, lastModified: new Date().toISOString() }
        onUpdateHistory(isInitial ? [newSession] : [...chatHistory, newSession])
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

    useEffect(() => {
        if (shouldScrollRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            shouldScrollRef.current = false
        }
    }, [messages])

    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new window.webkitSpeechRecognition()
            recognition.continuous = false
            recognition.interimResults = false
            recognition.lang = 'en-US'
            recognition.onresult = (event) => { setInput(prev => prev ? `${prev} ${event.results[0][0].transcript}` : event.results[0][0].transcript); setIsListening(false) }
            recognition.onerror = () => setIsListening(false)
            recognition.onend = () => setIsListening(false)
            recognitionRef.current = recognition
        }
    }, [])

    const toggleListening = () => {
        if (isListening) { recognitionRef.current?.stop() } else { setIsListening(true); recognitionRef.current?.start() }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return
        const userMessage = { id: Date.now().toString(), role: 'user', content: input }
        const updatedMessages = [...messages, userMessage]
        shouldScrollRef.current = true
        setMessages(updatedMessages)
        setInput('')
        setIsLoading(true)

        const userContext = {
            userName,
            portfolio: {
                totalValue: settings.portfolioSize,
                allocated: tradeData.reduce((acc, t) => acc + (t.status !== 'Closed' ? (t.strike * 100) : 0), 0),
                activeTradesCount: tradeData.filter(t => t.status !== 'Closed').length
            },
            strategyNotes,
            recentTrades: tradeData.slice(0, 5).map(t => ({ symbol: t.symbol, type: t.type, strike: t.strike, expirationDate: t.expirationDate, premium: t.premium, status: t.status })),
            researchSummary: researchData.slice(0, 5).map(r => ({ symbol: r.symbol, rating: r.overallRating }))
        }

        try {
            const response = await fetch('/api/unicron-ai', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ message: input, userContext, history: messages.map(m => ({ role: m.role, content: m.content })) })
            })
            const data = await response.json()
            if (response.ok) {
                const aiMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response }
                const finalMessages = [...updatedMessages, aiMessage]
                shouldScrollRef.current = true
                setMessages(finalMessages)
                onUpdateHistory(chatHistory.map(s => s.id === activeSessionId
                    ? { ...s, messages: finalMessages, lastModified: new Date().toISOString(), title: s.title === 'New Chat' ? (input.substring(0, 30) + (input.length > 30 ? '...' : '')) : s.title }
                    : s))
            } else {
                throw new Error(data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to get response')
            }
        } catch (error) {
            const errorMsg = error.message || "I'm having trouble connecting. Please try again."
            shouldScrollRef.current = true
            const errorMessages = [...updatedMessages, { id: Date.now().toString(), role: 'assistant', content: `❌ **Error**: ${errorMsg}` }]
            setMessages(errorMessages)
            onUpdateHistory(chatHistory.map(s => s.id === activeSessionId ? { ...s, messages: errorMessages, lastModified: new Date().toISOString() } : s))
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteSession = (sessionId, e) => {
        e.stopPropagation()
        if (!confirm('Delete this chat session?')) return
        const updatedHistory = chatHistory.filter(s => s.id !== sessionId)
        onUpdateHistory(updatedHistory)
        if (activeSessionId === sessionId) {
            if (updatedHistory.length > 0) { const last = updatedHistory[0]; setActiveSessionId(last.id); setMessages(last.messages) }
            else handleNewChat(true)
        }
    }

    const handleClearHistory = () => {
        if (confirm('Clear ALL chat sessions? This cannot be undone.')) { onUpdateHistory([]); handleNewChat(true) }
    }

    const handleQuickPrompt = (prompt) => {
        if (isLoading) return
        setInput(prompt)
        // Small delay so state updates before send fires
        setTimeout(() => {
            const syntheticSend = async () => {
                const userMessage = { id: Date.now().toString(), role: 'user', content: prompt }
                const updatedMessages = [...messages, userMessage]
                shouldScrollRef.current = true
                setMessages(updatedMessages)
                setInput('')
                setIsLoading(true)
                const userContext = {
                    userName,
                    portfolio: { totalValue: settings.portfolioSize, activeTradesCount: tradeData.filter(t => !t.closed).length },
                    strategyNotes,
                    recentTrades: tradeData.slice(0, 10).map(t => ({ symbol: t.symbol, type: t.type, strikePrice: t.strikePrice, expirationDate: t.expirationDate, premium: t.premium, status: t.status, currentMarketPrice: t.currentMarketPrice || t.stockPrice, closed: t.closed })),
                    researchSummary: researchData.slice(0, 10).map(r => ({ symbol: r.symbol, rating: r.overallRating, sentiment: r.overallRating >= 75 ? 'Bullish' : r.overallRating >= 50 ? 'Neutral' : 'Bearish' }))
                }
                try {
                    const response = await fetch('/api/unicron-ai', {
                        method: 'POST', headers: authHeaders(),
                        body: JSON.stringify({ message: prompt, userContext, history: messages.map(m => ({ role: m.role, content: m.content })) })
                    })
                    const data = await response.json()
                    if (response.ok) {
                        const aiMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response }
                        const finalMessages = [...updatedMessages, aiMessage]
                        shouldScrollRef.current = true
                        setMessages(finalMessages)
                        onUpdateHistory(chatHistory.map(s => s.id === activeSessionId
                            ? { ...s, messages: finalMessages, lastModified: new Date().toISOString(), title: s.title === 'New Chat' ? (prompt.substring(0, 30) + '…') : s.title }
                            : s))
                    } else {
                        throw new Error(data.error || 'Failed')
                    }
                } catch (error) {
                    const errMessages = [...updatedMessages, { id: Date.now().toString(), role: 'assistant', content: `❌ **Error**: ${error.message}` }]
                    setMessages(errMessages)
                    onUpdateHistory(chatHistory.map(s => s.id === activeSessionId ? { ...s, messages: errMessages, lastModified: new Date().toISOString() } : s))
                } finally {
                    setIsLoading(false)
                }
            }
            syntheticSend()
        }, 50)
    }

    return (
        <div className="space-y-6">

        {/* Page Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/[0.06]">
            <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                        <Sparkles className="h-6 w-6 text-purple-400" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Unicron AI</h1>
                </div>
                <p className="text-white/40 font-medium text-sm ml-[52px]">Your AI portfolio analyst and trading assistant.</p>
            </div>
        </header>

        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-[20px] overflow-hidden flex flex-col md:flex-row h-[780px] animate-fade-in">

            {/* Sidebar */}
            <div className={`${isSidebarOpen ? 'md:w-60' : 'md:w-0'} hidden md:flex border-r border-white/[0.06] transition-all duration-300 overflow-hidden flex-col flex-shrink-0`}>
                <div className="p-4 border-b border-white/[0.06] space-y-3">
                    <h3 className="text-xs font-semibold text-white/40 flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" /> Chat History
                    </h3>
                    <button onClick={() => handleNewChat()}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-xs font-semibold transition-all">
                        <Sparkles className="h-3 w-3" /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {chatHistory && [...chatHistory].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)).map(session => (
                        <div key={session.id} onClick={() => handleSwitchSession(session.id)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all group/item relative ${
                                activeSessionId === session.id
                                    ? 'bg-blue-500/15 border-blue-500/25'
                                    : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.07]'
                            }`}>
                            <div className="flex items-start justify-between gap-1.5">
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${activeSessionId === session.id ? 'text-blue-400' : 'text-white/70'}`}>{session.title}</p>
                                    <p className="text-[10px] text-white/30 truncate mt-0.5">{session.messages[session.messages.length - 1]?.content?.substring(0, 40) || '...'}</p>
                                </div>
                                <button onClick={(e) => handleDeleteSession(session.id, e)}
                                    className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-all flex-shrink-0">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-3 border-t border-white/[0.06]">
                    <button onClick={handleClearHistory}
                        className="w-full flex items-center justify-center gap-2 py-1.5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all text-xs font-medium">
                        <Trash2 className="h-3 w-3" /> Clear All
                    </button>
                </div>
            </div>

            {/* Main chat */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1.5 hover:bg-white/[0.08] rounded-lg text-white/40 hover:text-white transition-all">
                            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold text-white">Unicron AI</h2>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/25 font-medium">BETA</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className="text-[10px] text-white/30 font-medium hidden sm:block">{isLoading ? 'Thinking…' : 'Online'}</span>
                    </div>
                </div>

                {/* Quick Prompts */}
                <div className="px-4 py-3 border-b border-white/[0.05] bg-white/[0.01]">
                    <p className="text-[10px] font-medium text-white/25 mb-2">Quick questions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {QUICK_PROMPTS.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => handleQuickPrompt(p.prompt)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] rounded-xl text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                            >
                                <span className="text-sm flex-shrink-0">{p.emoji}</span>
                                <span className="text-[11px] font-medium text-white/50 group-hover:text-white/80 transition-colors leading-tight">{p.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 custom-scrollbar">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-blue-500/20 text-white rounded-[18px] rounded-br-sm'
                                    : 'bg-white/[0.06] text-white/90 rounded-[18px] rounded-bl-sm'
                            }`}>
                                <div className={`text-[10px] font-semibold mb-1.5 ${msg.role === 'user' ? 'text-blue-400 text-right' : 'text-purple-400'}`}>
                                    {msg.role === 'user' ? 'You' : 'Unicron AI'}
                                </div>
                                <div className={`prose max-w-none text-sm ${theme === 'dark' ? 'prose-invert' : 'prose-slate'} prose-p:mb-3 prose-p:leading-relaxed last:prose-p:mb-0 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-headings:mb-2`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white/[0.06] rounded-[18px] rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 bg-white/[0.06] border border-white/[0.10] rounded-2xl px-4 py-2.5 flex items-center gap-2 focus-within:border-blue-500/30 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                            <input
                                type="text" value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Ask about trades, portfolio, or strategy…"
                                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                                disabled={isLoading}
                            />
                            <button onClick={toggleListening}
                                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-white/30 hover:text-white hover:bg-white/10'}`}>
                                {isListening ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                            </button>
                        </div>
                        <button onClick={handleSend} disabled={!input.trim() || isLoading}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                                !input.trim() || isLoading
                                    ? 'bg-white/[0.06] text-white/20 cursor-not-allowed border border-white/[0.06]'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white hover:scale-105 active:scale-95'
                            }`}>
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                    <p className="text-[10px] text-white/20 text-center mt-2">AI responses may contain errors. Verify before acting.</p>
                </div>
            </div>
        </div>

        </div>
    )
}

export default UnicronAI
