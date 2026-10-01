export type Zone = {
  id: string
  name: string
  description: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number | null
  qr_token: string | null
  active: boolean
}

export type BuildSession = {
  id: string
  title: string
  zone_id: string | null
  season_id: string | null
  starts_at: string
  ends_at: string | null
  rrule: string | null
  is_recurring: boolean
  short_notice: boolean
}

export type BuildCheckin = {
  id: string
  session_id: string | null
  zone_id: string | null
  user_id: string
  method: string
  checked_in_at: string
  checked_out_at: string | null
  minutes_logged: number | null
  lat: number | null
  lng: number | null
}

export type OutreachEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  lat: number | null
  lng: number | null
  starts_at: string
  ends_at: string | null
  season_id: string | null
  qr_token: string | null
  cancelled: boolean
  lead_ids: string[]
}

export type OutreachCheckin = {
  id: string
  event_id: string | null
  user_id: string
  method: string
  checked_in_at: string
  departed_at: string | null
  credited_minutes: number | null
  minutes_logged: number | null
}

export type OpiStatus =
  | 'SUBMITTED'
  | 'CHANGES_REQUESTED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'

export type OpiInitiative = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  title: string
  description: string | null
  doc_url: string | null
  status: OpiStatus
  reviewer_id: string | null
  linked_event_id: string | null
}

export type OpiComment = {
  id: string
  created_at: string
  initiative_id: string
  user_id: string
  body: string
}

export const DEPARTMENTS = ['Build', 'Technology', 'Business', 'Outreach'] as const
export type Department = (typeof DEPARTMENTS)[number]

export type IndividualOutreach = {
  id: string
  created_at: string
  user_id: string
  full_name: string
  department: string | null
  event_name: string
  what_you_did: string
  impact: string
  hours: number
  credited_hours: number | null
  event_date: string
  proof_urls: string[]
  people_impacted: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewer_id: string | null
  decided_at: string | null
}

export type Purchase = {
  id: string
  created_at: string
  user_id: string
  kind: 'purchase' | 'reimbursement'
  description: string
  amount: number
  receipt_url: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewer_id: string | null
  decided_at: string | null
}

export type Notification = {
  id: string
  created_at: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
}

export type ProfileRow = {
  id: string
  display_name: string | null
  grade: string | null
  role: string
  special_perms: string[] | null
  permissions: string[]
  account_status: 'active' | 'deactivated' | 'rejected'
  avatar_url: string | null
  bio: string | null
  department: string | null
}

export const PERMISSIONS = [
  'manage_accounts',
  'manage_invitations',
  'manage_tasks',
  'manage_groups',
  'manage_seasons',
  'manage_outreach_events',
  'manage_outreach_attendance',
  'manage_build_hours',
  'manage_opis',
  'export_records',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_accounts: 'Manage accounts',
  manage_invitations: 'Manage invitations',
  manage_tasks: 'Manage tasks',
  manage_groups: 'Manage groups',
  manage_seasons: 'Manage seasons',
  manage_outreach_events: 'Manage outreach events',
  manage_outreach_attendance: 'Manage outreach attendance',
  manage_build_hours: 'Manage build hours',
  manage_opis: 'Manage OPIs',
  export_records: 'Export records',
}

export type Season = {
  id: string
  created_at: string
  name: string
  is_current: boolean
  outreach_target: number
  build_target: number
}

export type TaskStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'changes_requested'
  | 'resubmitted'
  | 'completed'
  | 'cancelled'

export type Task = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  title: string
  description: string | null
  status: TaskStatus
  requires_review: boolean
  deadline: string | null
  group_id: string | null
  season_id: string | null
}

export type TaskGroup = {
  id: string
  created_at: string
  name: string
  color: string
}

export type TaskEvidence = {
  id: string
  created_at: string
  task_id: string
  user_id: string | null
  kind: 'note' | 'link' | 'picture'
  content: string
  file_url: string | null
}

export type TaskHistory = {
  id: string
  created_at: string
  task_id: string
  user_id: string | null
  from_status: string | null
  to_status: string
  feedback: string | null
}

export type Invitation = {
  id: string
  created_at: string
  created_by: string | null
  code: string
  expires_at: string
  revoked: boolean
}

export type Group = {
  id: string
  created_at: string
  name: string
}
