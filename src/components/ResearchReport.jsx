import { useState } from 'react'
import { ChevronLeft, Save, CheckCircle, Star, AlertTriangle } from 'lucide-react'
import SegmentedControl from './ui/SegmentedControl'
import CompanyLogo from './CompanyLogo'

const SECTIONS = [
  { key: 'companyAnalysis',      label: 'Company' },
  { key: 'financialHealth',      label: 'Financial' },
  { key: 'technicalAnalysis',    label: 'Technical' },
  { key: 'recentDevelopments',   label: 'Events' },
]

const getRatingColor = (rating) => {
  if (rating >= 90) return 'text-emerald-400'
  if (rating >= 75) return 'text-emerald-400'
  if (rating >= 60) return 'text-amber-400'
  if (rating >= 40) return 'text-orange-400'
  return 'text-rose-400'
}

const getRatingIcon = (rating) => {
  if (rating >= 75) return <CheckCircle className="h-5 w-5 text-emerald-400" />
  if (rating >= 50) return <AlertTriangle className="h-5 w-5 text-amber-400" />
  return <AlertTriangle className="h-5 w-5 text-rose-400" />
}

function DetailedSubsection({ subsection }) {
  if (!subsection) return null
  return (
    <div className="surface-2 rounded-2xl p-5 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-semibold text-blue-400">{subsection.title}</h5>
        <div className={`flex items-center space-x-1 ${getRatingColor(subsection.rating)}`}>
          <Star className="h-4 w-4 fill-current" />
          <span className="font-bold text-sm">{subsection.rating}/100</span>
        </div>
      </div>
      <p className="text-secondary text-sm leading-relaxed">{subsection.content}</p>
    </div>
  )
}

function SectionContent({ sectionKey, data, companyData, symbol }) {
  if (!data) return <p className="text-tertiary text-sm">Loading section data...</p>

  const isCompanyAnalysis = sectionKey === 'companyAnalysis'
  const isTechnicalAnalysis = sectionKey === 'technicalAnalysis'
  const isRecentDevelopments = sectionKey === 'recentDevelopments'

  return (
    <div className="space-y-3">
      {/* Summary Analysis */}
      {data.analysis && (
        <div>
          <h4 className="overline mb-2">Executive Summary</h4>
          <p className="text-secondary text-sm leading-relaxed surface-1 rounded-xl p-3">{data.analysis}</p>
        </div>
      )}

      {/* Key Metrics — Technical Analysis special rendering */}
      {data.metrics && data.metrics.length > 0 && isTechnicalAnalysis && (
        <div>
          <h4 className="overline mb-3">Key Metrics</h4>

          {/* Current Price */}
          {data.metrics.find(m => m.label === 'Current Price') && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-secondary text-sm">Current Price</span>
                <span className="text-xl sm:text-3xl font-bold text-primary">
                  {(companyData?.symbol || symbol || '').toUpperCase()} ${data.metrics.find(m => m.label === 'Current Price')?.value || '0.00'}
                </span>
              </div>
            </div>
          )}

          {/* Target Price Analysis */}
          {data.detailedTechnical?.targetPriceAnalysis && (
            <div className="bg-blue-500/[0.06] border border-blue-500/15 rounded-2xl p-4 mb-4">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.targetPriceAnalysis.title}</h5>
              {data.detailedTechnical.targetPriceAnalysis.targetPrice && (
                <div className="flex items-center mb-3">
                  <span className="text-secondary text-sm mr-2">Analyst Target:</span>
                  <span className="text-2xl font-bold text-blue-300">{data.detailedTechnical.targetPriceAnalysis.targetPrice}</span>
                </div>
              )}
              <p className="text-secondary text-sm leading-relaxed">{data.detailedTechnical.targetPriceAnalysis.content}</p>
            </div>
          )}

          {/* Support & Resistance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface-2 border-emerald-500/20 rounded-2xl p-5">
              <h5 className="text-emerald-400 font-semibold mb-3 flex items-center">
                <span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
                Support Levels
              </h5>
              <div className="space-y-2">
                {data.metrics.filter(m => m.label.includes('Support')).map((metric, i) => (
                  <div key={i} className="surface-1 rounded-xl px-3 py-2">
                    <div className="text-emerald-400 font-medium text-lg">{metric.value.split(' - ')[0]}</div>
                    <div className="text-tertiary text-sm mt-1">{metric.value.split(' - ').slice(1).join(' - ')}</div>
                  </div>
                ))}
                {data.metrics.filter(m => m.label.includes('Support')).length === 0 && (
                  <p className="text-tertiary text-sm">No support levels identified</p>
                )}
              </div>
            </div>
            <div className="surface-2 border-rose-500/20 rounded-2xl p-5">
              <h5 className="text-rose-400 font-semibold mb-3 flex items-center">
                <span className="w-3 h-3 bg-rose-500 rounded-full mr-2"></span>
                Resistance Levels
              </h5>
              <div className="space-y-2">
                {data.metrics.filter(m => m.label.includes('Resistance')).map((metric, i) => (
                  <div key={i} className="surface-1 rounded-xl px-3 py-2">
                    <div className="text-rose-400 font-medium text-lg">{metric.value.split(' - ')[0]}</div>
                    <div className="text-tertiary text-sm mt-1">{metric.value.split(' - ').slice(1).join(' - ')}</div>
                  </div>
                ))}
                {data.metrics.filter(m => m.label.includes('Resistance')).length === 0 && (
                  <p className="text-tertiary text-sm">No resistance levels identified</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics — Standard rendering for non-technical sections */}
      {data.metrics && data.metrics.length > 0 && !isTechnicalAnalysis && (
        <div>
          <h4 className="font-medium mb-2 text-primary">Key Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.metrics.map((metric, index) => (
              <div key={index} className="flex justify-between text-sm surface-1 rounded-xl p-2">
                <span className="text-secondary">{metric.label}:</span>
                <span className="font-medium text-primary">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis — Company Analysis */}
      {isCompanyAnalysis && data.detailedAnalysis && (
        <div>
          <h4 className="font-medium mb-3 mt-4 text-lg border-b border-white/[0.06] pb-2 text-primary">Detailed Analysis</h4>
          <DetailedSubsection subsection={data.detailedAnalysis.marketPosition} />
          <DetailedSubsection subsection={data.detailedAnalysis.businessModel} />
          <DetailedSubsection subsection={data.detailedAnalysis.industryTrends} />
          <DetailedSubsection subsection={data.detailedAnalysis.customerBase} />
          <DetailedSubsection subsection={data.detailedAnalysis.growthStrategy} />
          <DetailedSubsection subsection={data.detailedAnalysis.economicMoat} />
        </div>
      )}

      {/* Detailed Technical Analysis */}
      {isTechnicalAnalysis && data.detailedTechnical && (
        <div>
          <h4 className="font-medium mb-3 mt-4 text-lg border-b border-white/[0.06] pb-2 text-primary">Technical Details</h4>
          {data.detailedTechnical.trend30to60Days && (
            <div className="surface-2 rounded-2xl p-5 mb-3">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.trend30to60Days.title}</h5>
              <p className="text-secondary text-sm leading-relaxed">{data.detailedTechnical.trend30to60Days.content}</p>
            </div>
          )}
          {data.detailedTechnical.optionsStrategy && (
            <div className="surface-2 rounded-2xl p-5 mb-3">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedTechnical.optionsStrategy.title}</h5>
              <p className="text-secondary text-sm leading-relaxed">{data.detailedTechnical.optionsStrategy.content}</p>
            </div>
          )}
        </div>
      )}

      {/* Recent Developments details */}
      {isRecentDevelopments && data.detailedDevelopments && (
        <div>
          <h4 className="font-medium mb-3 mt-4 text-lg border-b border-white/[0.06] pb-2 text-primary">Event Details</h4>
          {data.detailedDevelopments.nextEarningsCall && (
            <div className="surface-2 rounded-2xl p-5 mb-3">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.nextEarningsCall.title}</h5>
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Next Earnings</span>
                <span className="text-primary">{data.detailedDevelopments.nextEarningsCall.date}</span>
              </div>
              <p className="text-secondary text-sm leading-relaxed">{data.detailedDevelopments.nextEarningsCall.expectation}</p>
            </div>
          )}
          {data.detailedDevelopments.majorEvents && data.detailedDevelopments.majorEvents.events?.length > 0 && (
            <div className="surface-2 rounded-2xl p-5 mb-3">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.majorEvents.title}</h5>
              <div className="space-y-3">
                {data.detailedDevelopments.majorEvents.events.map((event, i) => (
                  <div key={i} className="border-l-2 border-blue-500 pl-3">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-primary">{event.event}</span>
                      {event.date && <span className="text-xs text-tertiary ml-2">{event.date}</span>}
                    </div>
                    {event.expectedImpact && (
                      <p className="text-sm text-secondary mt-1">{event.expectedImpact}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.detailedDevelopments.catalysts && (
            <div className="surface-2 rounded-2xl p-5 mb-3">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.catalysts.title}</h5>
              <p className="text-secondary text-sm leading-relaxed">{data.detailedDevelopments.catalysts.content}</p>
            </div>
          )}
          {data.detailedDevelopments.optionsImplication && (
            <div className="surface-2 rounded-2xl p-5 mb-3">
              <h5 className="font-semibold text-blue-400 mb-2">{data.detailedDevelopments.optionsImplication.title}</h5>
              <p className="text-secondary text-sm leading-relaxed">{data.detailedDevelopments.optionsImplication.content}</p>
            </div>
          )}
        </div>
      )}

      {/* Signals */}
      {data.signals && data.signals.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 text-primary">Signals</h4>
          <div className="space-y-1">
            {data.signals.map((signal, index) => (
              <div key={index} className={`text-sm p-2 rounded-xl ${
                signal.type === 'positive' ? 'bg-emerald-500/15 text-emerald-400' :
                signal.type === 'negative' ? 'bg-rose-500/15 text-rose-400' :
                'bg-amber-500/15 text-amber-400'
              }`}>
                {signal.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResearchReport({ companyData, onBack, onSave, onOpenChat }) {
  const [activeSection, setActiveSection] = useState(0)

  if (!companyData) return null

  const currentKey = SECTIONS[activeSection].key
  const currentData = companyData[currentKey]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header card */}
      <div className="surface-2 rounded-2xl overflow-hidden">
        <div className={`h-0.5 ${companyData.overallRating >= 75 ? 'bg-gradient-to-r from-emerald-500 to-transparent' : companyData.overallRating >= 50 ? 'bg-gradient-to-r from-amber-500 to-transparent' : 'bg-gradient-to-r from-rose-500 to-transparent'}`} />
        <div className="p-5">
          {/* Back + actions */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="flex items-center gap-1.5 text-footnote text-tertiary hover:text-secondary transition-colors group min-h-[44px]">
              <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              Research
            </button>
            {!companyData.saved ? (
              <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold transition-spring min-h-[44px]">
                <Save className="h-3.5 w-3.5" /> Save Report
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium">
                <CheckCircle className="h-3.5 w-3.5" /> Saved
              </div>
            )}
          </div>

          {/* Symbol + score */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CompanyLogo symbol={companyData.symbol} className="w-12 h-12" textSize="text-sm" />
                <div>
                  <h2 className="text-title-1 text-primary">{companyData.symbol}</h2>
                  <p className="text-footnote text-tertiary mt-0.5">Full Intelligence Report</p>
                </div>
              </div>
              {/* Section score pills */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {SECTIONS.map(({ key, label }) => {
                  const score = companyData[key]?.rating
                  if (!score) return null
                  return (
                    <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-footnote font-medium ${
                      score >= 70 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      score >= 50 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                      'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      <span className="text-tertiary">{label}</span>
                      <span className="font-semibold">{score}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={`text-3xl sm:text-5xl font-semibold font-mono ${
                companyData.overallRating >= 75 ? 'text-emerald-400' :
                companyData.overallRating >= 50 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {companyData.overallRating}
              </div>
              <div className="overline mt-0.5">Overall Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback Warning */}
      {(companyData.isFallback || companyData.companyAnalysis?.isFallback) && (
        <div className="p-4 bg-orange-900/30 border border-orange-500/50 rounded-xl text-orange-200 flex items-start space-x-3 animate-fade-in">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Displaying Basic Analysis</p>
            <p className="text-sm opacity-90">The AI engine encountered an issue. Please check your GEMINI_API_KEY. {(companyData.error || companyData.companyAnalysis?.error) && `(Error: ${companyData.error || companyData.companyAnalysis?.error})`}</p>
          </div>
        </div>
      )}

      {/* Segmented control */}
      <SegmentedControl
        segments={SECTIONS.map(s => ({ key: s.key, label: s.label }))}
        activeIndex={activeSection}
        onChange={setActiveSection}
      />

      {/* Active section content */}
      <div className="animate-fade-in" key={currentKey}>
        <SectionContent
          sectionKey={currentKey}
          data={currentData}
          companyData={companyData}
          symbol={companyData.symbol}
        />
      </div>

      {/* Floating chat FAB */}
      <button
        onClick={onOpenChat}
        className="fixed bottom-24 md:bottom-8 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-spring z-40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </div>
  )
}
