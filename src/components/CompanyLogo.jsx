import { useState } from 'react'

const CompanyLogo = ({ symbol, className = "w-10 h-10", textSize = "text-sm", showVisual = true }) => {
    const [error, setError] = useState(false)

    // Clean symbol (remove special chars if needed)
    const cleanSymbol = symbol ? symbol.replace(/[^a-zA-Z]/g, '').toUpperCase() : ''

    if (error || !symbol || !showVisual) {
        return (
            <div className={`${className} rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-[1px] shadow-lg shadow-blue-500/20 flex-shrink-0`}>
                <div className="w-full h-full rounded-xl bg-gray-900/90 backdrop-blur-xl flex items-center justify-center">
                    <span className={`${textSize} font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 capitalize select-none`}>
                        {cleanSymbol.slice(0, 2)}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className={`${className} bg-white rounded-xl p-1 shadow-lg shadow-blue-500/10 flex-shrink-0 flex items-center justify-center overflow-hidden relative`}>
            <img
                src={`https://financialmodelingprep.com/image-stock/${cleanSymbol}.png`}
                alt={`${symbol} logo`}
                className="w-full h-full object-contain"
                onError={() => setError(true)}
            />
            {/* Subtle inner border for polish */}
            <div className="absolute inset-0 rounded-xl border border-black/5 pointer-events-none"></div>
        </div>
    )
}

export default CompanyLogo
