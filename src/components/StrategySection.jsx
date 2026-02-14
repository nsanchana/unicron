import { useState, useRef, useEffect } from 'react'
import { Save, Bold, Italic, Underline, List, Highlighter, Brain, Sparkles, Check } from 'lucide-react'

const StrategySection = ({ notes, onSave, theme }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [saveStatus, setSaveStatus] = useState('idle') // idle, saving, saved
    const editorRef = useRef(null)
    const lastSyncedNotesRef = useRef(notes || '')
    const isInitiallySynced = useRef(false)

    useEffect(() => {
        if (!editorRef.current) return

        const currentNotes = notes || ''
        const shouldSync = !isEditing && (currentNotes !== lastSyncedNotesRef.current || !isInitiallySynced.current)

        if (shouldSync) {
            if (editorRef.current.innerHTML !== currentNotes) {
                editorRef.current.innerHTML = currentNotes
            }
            lastSyncedNotesRef.current = currentNotes
            isInitiallySynced.current = true
        }
    }, [notes, isEditing])

    const handleFormat = (command, value = null) => {
        document.execCommand(command, false, value)
        editorRef.current.focus()
    }

    const handleHeading = (type) => {
        if (type === 'heading') document.execCommand('formatBlock', false, '<h3>')
        if (type === 'subheading') document.execCommand('formatBlock', false, '<h4>')
        if (type === 'body') document.execCommand('formatBlock', false, '<p>')
        editorRef.current.focus()
    }

    const handleSave = () => {
        setSaveStatus('saving')
        const html = editorRef.current.innerHTML
        onSave(html)

        setTimeout(() => {
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2000)
        }, 800)
    }

    const handleInput = () => {
        setIsEditing(true)
    }

    const handleBlur = () => {
        setIsEditing(false)
    }

    return (
        <div className="glass-card relative overflow-hidden group animate-slide-in-up mt-8">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-white/10 shadow-lg">
                        <Brain className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                            Tactical Strategy Board <Sparkles className="h-4 w-4 text-yellow-500" />
                        </h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">Master Directives & Execution Alpha</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className={`
            flex items-center space-x-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300
            ${saveStatus === 'saved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 shadow-lg shadow-blue-500/20 active:scale-95'}
          `}
                >
                    {saveStatus === 'saving' ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveStatus === 'saved' ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    <span>{saveStatus === 'saved' ? 'Synced' : 'Save'}</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="relative z-10 bg-[var(--inner-card-bg)] backdrop-blur-md rounded-t-2xl border border-white/5 p-2.5 flex flex-wrap gap-2 items-center">
                <div className="flex items-center space-x-1 border-r border-white/5 pr-3 mr-1">
                    <button onClick={() => handleHeading('heading')} className="px-3 py-1.5 hover:bg-white/5 rounded-lg text-[10px] font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase tracking-widest" title="Heading">H1</button>
                    <button onClick={() => handleHeading('subheading')} className="px-3 py-1.5 hover:bg-white/5 rounded-lg text-[10px] font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase tracking-widest" title="Sub-heading">H2</button>
                    <button onClick={() => handleHeading('body')} className="px-3 py-1.5 hover:bg-white/5 rounded-lg text-[10px] font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase tracking-widest" title="Body Text">Txt</button>
                </div>

                <div className="flex items-center space-x-1 border-r border-white/5 pr-3 mr-1">
                    <button onClick={() => handleFormat('bold')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-secondary)] hover:text-blue-400 transition-colors" title="Bold">
                        <Bold className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleFormat('italic')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-secondary)] hover:text-blue-400 transition-colors" title="Italic">
                        <Italic className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleFormat('underline')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-secondary)] hover:text-blue-400 transition-colors" title="Underline">
                        <Underline className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center space-x-1">
                    <button onClick={() => handleFormat('insertUnorderedList')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-secondary)] hover:text-blue-400 transition-colors" title="Bullet List">
                        <List className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleFormat('hiliteColor', '#3b82f630')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-secondary)] hover:text-yellow-500 transition-colors" title="Highlight">
                        <Highlighter className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="relative z-10 bg-[var(--inner-card-bg)] !bg-opacity-40 rounded-b-2xl border-x border-b border-white/5 min-h-[400px]">
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onFocus={() => setIsEditing(true)}
                    onBlur={handleBlur}
                    className={`
                        w-full h-full min-h-[400px] p-8 text-[var(--text-primary)] focus:outline-none 
                        prose ${theme === 'dark' ? 'prose-invert' : 'prose-slate'} max-w-none 
                        prose-headings:font-black prose-headings:tracking-tight prose-headings:text-[var(--text-primary)]
                        prose-p:leading-relaxed prose-li:text-[var(--text-secondary)] strategy-editor
                    `}
                    suppressContentEditableWarning={true}
                />
            </div>

            <style>{`
                .strategy-editor h3 { font-size: 1.5rem; margin-bottom: 0.75rem; font-weight: 900; letter-spacing: -0.025em; }
                .strategy-editor h4 { font-size: 1.1rem; margin-bottom: 0.5rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
                .strategy-editor p { margin-bottom: 1rem; font-size: 0.95rem; }
                .strategy-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
                .strategy-editor b, .strategy-editor strong { color: var(--text-primary); font-weight: 900; }
                .strategy-editor i, .strategy-editor em { color: var(--text-secondary); opacity: 0.9; }
                .strategy-editor span[style*="background-color"] { padding: 2px 6px; border-radius: 6px; }
            `}</style>
        </div>
    )
}

export default StrategySection
