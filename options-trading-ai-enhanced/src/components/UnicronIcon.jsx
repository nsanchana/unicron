function UnicronIcon({ className = "h-8 w-8" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer hexagon ring */}
      <path
        d="M50 5 L85 25 L85 65 L50 85 L15 65 L15 25 Z"
        stroke="url(#gradient1)"
        strokeWidth="3"
        fill="none"
        opacity="0.8"
      />

      {/* Inner hexagon */}
      <path
        d="M50 15 L75 30 L75 60 L50 75 L25 60 L25 30 Z"
        fill="url(#gradient2)"
        opacity="0.2"
      />

      {/* Central diamond/unicorn horn shape */}
      <path
        d="M50 25 L65 45 L50 55 L35 45 Z"
        fill="url(#gradient3)"
      />

      {/* Ascending line pattern (representing growth) */}
      <path
        d="M30 60 L35 55 L40 58 L45 50 L50 52 L55 45 L60 48 L65 40 L70 42"
        stroke="url(#gradient4)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Glowing dots at key points */}
      <circle cx="50" cy="25" r="2.5" fill="#60A5FA" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="65" cy="40" r="2" fill="#34D399" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite" />
      </circle>

      {/* Gradients */}
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.3" />
        </linearGradient>

        <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        <linearGradient id="gradient4" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default UnicronIcon
