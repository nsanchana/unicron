export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div
        className="surface-3 border-t border-white/[0.06] flex justify-around items-center px-2 pt-2 pb-safe"
        style={{ minHeight: 56 }}
      >
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id)
                if (navigator.vibrate) navigator.vibrate(10)
              }}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 transition-colors"
            >
              <Icon
                className={`h-[22px] w-[22px] transition-colors ${
                  isActive ? 'text-blue-500' : 'text-white/35'
                }`}
                fill={isActive ? 'currentColor' : 'none'}
                strokeWidth={isActive ? 1.5 : 2}
              />
              <span className={`text-[10px] font-medium ${
                isActive ? 'text-blue-500' : 'text-white/35'
              }`}>
                {tab.shortLabel || tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
