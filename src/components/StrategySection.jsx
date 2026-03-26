import { useState, useRef, useEffect } from 'react'
import { Save, Bold, Italic, Underline, List, Highlighter, Brain, Check } from 'lucide-react'

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
        if (type === 'heading')    document.execCommand('formatBlock', false, '<h3>')
        if (type === 'subheading') document.execCommand('formatBlock', false, '<h4>')
        if (type === 'body')       document.execCommand('formatBlock', false, '<p>')
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

    const handleInput = () => { setIsEditing(true) }
    const handleBlur  = () => { setIsEditing(false) }

    return (
        <div className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden mt-6 animate-slide-in-up">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-white/[0.06] gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/15 rounded-xl border border-purple-500/20">
                        <Brain className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-white">Strategy Board</h3>
                        <p className="text-xs text-white/40 font-medium">Master directives &amp; notes</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className={`flex items-center justify-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                        saveStatus === 'saved'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                    {saveStatus === 'saving' ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveStatus === 'saved' ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {saveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-1.5 items-center px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.03]">
                <div className="flex items-center gap-1 border-r border-white/[0.08] pr-2.5 mr-1">
                    <button onClick={() => handleHeading('heading')}    className="px-2.5 py-1 hover:bg-white/[0.08] rounded-lg text-xs font-semibold text-white/50 hover:text-white transition-colors">H1</button>
                    <button onClick={() => handleHeading('subheading')} className="px-2.5 py-1 hover:bg-white/[0.08] rounded-lg text-xs font-semibold text-white/50 hover:text-white transition-colors">H2</button>
                    <button onClick={() => handleHeading('body')}       className="px-2.5 py-1 hover:bg-white/[0.08] rounded-lg text-xs font-semibold text-white/50 hover:text-white transition-colors">P</button>
                </div>
                <div className="flex items-center gap-1 border-r border-white/[0.08] pr-2.5 mr-1">
                    <button onClick={() => handleFormat('bold')}      className="p-1.5 hover:bg-white/[0.08] rounded-lg text-white/50 hover:text-white transition-colors"><Bold      className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleFormat('italic')}    className="p-1.5 hover:bg-white/[0.08] rounded-lg text-white/50 hover:text-white transition-colors"><Italic    className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleFormat('underline')} className="p-1.5 hover:bg-white/[0.08] rounded-lg text-white/50 hover:text-white transition-colors"><Underline className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => handleFormat('insertUnorderedList')}       className="p-1.5 hover:bg-white/[0.08] rounded-lg text-white/50 hover:text-white transition-colors"><List        className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleFormat('hiliteColor', '#3b82f630')} className="p-1.5 hover:bg-white/[0.08] rounded-lg text-white/50 hover:text-amber-400 transition-colors"><Highlighter className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {/* Editor */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onFocus={() => setIsEditing(true)}
                onBlur={handleBlur}
                className={`w-full min-h-[380px] p-5 sm:p-8 text-white/85 focus:outline-none prose prose-invert max-w-none prose-headings:font-semibold prose-headings:text-white prose-p:leading-relaxed strategy-editor`}
                suppressContentEditableWarning={true}
            />

            <style>{`
                .strategy-editor h3 { font-size: 1.25rem; margin-bottom: 0.6rem; font-weight: 600; }
                .strategy-editor h4 { font-size: 1rem; margin-bottom: 0.5rem; font-weight: 600; color: rgba(255,255,255,0.6); }
                .strategy-editor p  { margin-bottom: 0.85rem; font-size: 0.9rem; }
                .strategy-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.85rem; }
                .strategy-editor b, .strategy-editor strong { color: white; font-weight: 700; }
                .strategy-editor i, .strategy-editor em { color: rgba(255,255,255,0.7); }
                .strategy-editor span[style*="background-color"] { padding: 2px 5px; border-radius: 5px; }
            `}</style>
        </div>
    )
}

export default StrategySection
