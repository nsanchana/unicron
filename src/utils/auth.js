/** Returns Authorization header object for API calls */
export function authHeaders(extra = {}) {
  const token = localStorage.getItem('unicron_token') || ''
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...extra }
}
