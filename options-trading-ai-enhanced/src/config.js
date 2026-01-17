// API configuration
export const API_BASE_URL = import.meta.env.PROD
  ? '/api'  // Production: use relative path (Vercel handles routing)
  : 'http://localhost:3001'  // Development: use local server
