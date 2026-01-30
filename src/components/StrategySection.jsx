import { useState, useRef, useEffect } from 'react'
import { Save, Bold, Italic, Underline, List, Highlighter, Type, Target, Brain, Sparkles, Check } from 'lucide-react'

const StrategySection = ({ notes, onSave }) => {
    const [content, setContent] = useState(notes || '')
    const [isEditing, setIsEditing] = useState(false)
    const [saveStatus, setSaveStatus] = useState('idle') // idle, saving, saved
    const editorRef = useRef(null)

    useEffect(() => {
        if (notes && editorRef.current && !isEditing) {
            if (editorRef.current.innerHTML !== notes) {
                editorRef.current.innerHTML = notes
            }
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
        if (editorRef.current) {
            // Check if text is actually empty (handling <br> remnants)
            const text = editorRef.current.innerText.trim()
            if (!text && !editorRef.current.querySelector('img')) {
                setContent('')
            } else {
                setContent(editorRef.current.innerHTML)
            }
        }
    }

    const handleBlur = () => {
        setIsEditing(false)
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML)
        }
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
                        <Brain className="h-6 w-6 text-purple-300" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                            Strategy Board <Sparkles className="h-4 w-4 text-yellow-400" />
                        </h3>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">MASTER PLAN & TRADING IDEAS</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300
            ${saveStatus === 'saved'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20 shadow-lg hover:shadow-purple-500/20'}
          `}
                >
                    {saveStatus === 'saving' ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveStatus === 'saved' ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    <span>{saveStatus === 'saved' ? 'Saved' : 'Save Plan'}</span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="relative z-10 bg-[#0f172a]/80 backdrop-blur-md rounded-t-xl border border-white/10 p-2 flex flex-wrap gap-2 items-center mb-0">
                <div className="flex items-center space-x-1 border-r border-white/10 pr-2 mr-1">
                    <button onClick={() => handleHeading('heading')} className="p-2 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 hover:text-white" title="Heading">H1</button>
                    <button onClick={() => handleHeading('subheading')} className="p-2 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 hover:text-white" title="Sub-heading">H2</button>
                    <button onClick={() => handleHeading('body')} className="p-2 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 hover:text-white" title="Body Text">Body</button>
                </div>

                <div className="flex items-center space-x-1 border-r border-white/10 pr-2 mr-1">
                    <button onClick={() => handleFormat('bold')} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white" title="Bold">
                        <Bold className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleFormat('italic')} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white" title="Italic">
                        <Italic className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleFormat('underline')} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white" title="Underline">
                        <Underline className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center space-x-1">
                    <button onClick={() => handleFormat('insertUnorderedList')} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white" title="Bullet List">
                        <List className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleFormat('hiliteColor', '#facc1550')} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-yellow-400" title="Highlight">
                        <Highlighter className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="relative z-10 bg-black/40 rounded-b-xl border-x border-b border-white/10 min-h-[300px]">
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onBlur={handleBlur}
                    className="w-full h-full min-h-[300px] p-6 text-gray-200 focus:outline-none prose prose-invert max-w-none prose-headings:font-bold prose-headings:text-white prose-p:leading-relaxed prose-li:text-gray-300 strategy-editor"
                    suppressContentEditableWarning={true}
                    style={{
                        textShadow: '0 0 1px rgba(0,0,0,0.5)'
                    }}
                />


            </div>

            <style>{`
        .strategy-editor h3 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #e2e8f0; }
        .strategy-editor h4 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #94a3b8; }
        .strategy-editor p { margin-bottom: 0.75rem; }
        .strategy-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .strategy-editor b, .strategy-editor strong { color: #fff; font-weight: 700; }
        .strategy-editor i, .strategy-editor em { color: #cbd5e1; }
        .strategy-editor span[style*="background-color"] { padding: 0 4px; border-radius: 4px; color: #fff; }
      `}</style>
        </div>
    )
}

export default StrategySection
