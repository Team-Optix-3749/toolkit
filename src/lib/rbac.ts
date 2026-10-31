export const ROLES = ['PENDING', 'MEMBER', 'LEADERSHIP', 'OFFICER', 'OWNER'] as const
export type Role = (typeof ROLES)[number]

// Presentation ordering only; domain authority comes from independent grants.
export const roleLevel = (role?: string | null): number => Math.max(0, ROLES.indexOf(role as Role))
export const isApproved = (role?: string | null) => ['MEMBER', 'LEADERSHIP', 'OFFICER', 'OWNER'].includes(role ?? '')
export const isAdmin = (role?: string | null) => ['LEADERSHIP', 'OFFICER', 'OWNER'].includes(role ?? '')
export const isOwner = (role?: string | null) => role === 'OWNER'
export const ROLE_LABEL: Record<Role, string> = {
  PENDING: 'Pending', MEMBER: 'Member', LEADERSHIP: 'Leadership', OFFICER: 'Officer', OWNER: 'President',
}

type AuthorizationProfile = {
  role: string
  permissions?: string[] | null
  account_status?: string
  verified?: boolean
}
export const can = (profile: AuthorizationProfile | null | undefined, permission: string): boolean =>
  !!profile && isApproved(profile.role) && profile.account_status === 'active' && profile.verified === true &&
  (profile.role === 'OWNER' || !!profile.permissions?.includes(permission))

export const hasAdminAccess = (profile: AuthorizationProfile | null | undefined): boolean =>
  !!profile && isApproved(profile.role) && profile.account_status === 'active' && profile.verified === true &&
  (isAdmin(profile.role) || !!profile.permissions?.length)

export const publicRole = (profile: {role: string; displayed_role?: string | null} | null | undefined): string =>
  profile?.displayed_role ?? profile?.role ?? 'PENDING'
