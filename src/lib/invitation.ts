const KEY = 'optix.pending-invitation'
export function pendingInvitation(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('code') || window.sessionStorage.getItem(KEY) || ''
}
export function rememberInvitation(code: string) {
  if (code) window.sessionStorage.setItem(KEY,code)
}
export function clearInvitation() { window.sessionStorage.removeItem(KEY) }
export function authReturn(path = 'auth/callback'): string {
  const url = new URL(`${import.meta.env.BASE_URL}${path}`,window.location.origin)
  const code = pendingInvitation()
  if (code) url.searchParams.set('code',code)
  return url.href
}
