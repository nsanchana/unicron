// API base URL - uses relative path in production, localhost in development
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3002';

export const getApiUrl = (path) => `${API_BASE_URL}${path}`;

export default API_BASE_URL;
