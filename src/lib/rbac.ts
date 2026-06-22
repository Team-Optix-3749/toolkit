// Role hierarchy for the whole app. Higher index = more privilege.
export const ROLES = ['PENDING', 'MEMBER', 'LEADERSHIP', 'OFFICER', 'OWNER'] as const
export type Role = (typeof ROLES)[number]

export const roleLevel = (r?: string | null): number => {
  const i = ROLES.indexOf((r as Role) ?? 'PENDING')
  return i < 0 ? 0 : i
}

export const atLeast = (r: string | null | undefined, min: Role): boolean =>
  roleLevel(r) >= roleLevel(min)

// MEMBER+ may use the core app; PENDING is held at /pending-approval.
export const isApproved = (r?: string | null) => atLeast(r, 'MEMBER')
// LEADERSHIP+ may use /admin areas.
export const isAdmin = (r?: string | null) => atLeast(r, 'LEADERSHIP')
export const isOwner = (r?: string | null) => r === 'OWNER'

export const ROLE_LABEL: Record<Role, string> = {
  PENDING: 'Pending',
  MEMBER: 'Member',
  LEADERSHIP: 'Leadership',
  OFFICER: 'Officer',
  OWNER: 'Owner',
}
