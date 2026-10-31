import type { Role } from './rbac'

export type BuildLocation = {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  radius_m: number | null
}

export type BuildSession = {
  id: string
  title: string
  location_id: string
  season_id: string
  opens_at: string
  closes_at: string
  cancelled: boolean
}

export type BuildRecord = {
  id: string
  session_id: string
  member_id: string
  check_in: string
  check_out: string | null
  reserved_until: string | null
  checkout_method: string
  automatically_closed: boolean
  credit_override: boolean | null
  credit_enabled: boolean
  credited_minutes: number | null
  credit_interval: string | null
}

export type BuildActionPayload =
  | { action: 'location'; id?: string; name: string; latitude?: number | null; longitude?: number | null; radius_m?: number | null }
  | ({ action: 'session' } & Pick<BuildSession,'title'|'location_id'|'opens_at'|'closes_at'> & {season_id?: string})
  | ({ action: 'edit_session'; id: string } & Partial<Pick<BuildSession,'title'|'location_id'|'season_id'|'opens_at'|'closes_at'>>)
  | { action: 'cancel' | 'check_out'; id: string }
  | { action: 'qr'; session_id: string }
  | { action: 'check_in'; session_id: string; method: 'qr'; token: string }
  | { action: 'check_in'; session_id: string; method: 'gps'; latitude: number; longitude: number }
  | { action: 'correct'; id: string; check_in?: string; check_out?: string; credit_override?: boolean | null }
  | { action: 'add_record'; session_id: string; member_id: string; check_in: string; check_out: string; credit_override?: boolean | null }

export type OutreachEvent = {
  id: string
  title: string
  description: string
  location: string
  latitude: number | null
  longitude: number | null
  starts_at: string
  ends_at: string
  season_id: string
  cancelled: boolean
}

export type OutreachAttendance = {
  id: string
  event_id: string
  member_id: string
  arrival: string
  departure: string | null
  credit_enabled: boolean
  credited_minutes: number | null
  credit_interval: string | null
}

export type OutreachLead = {
  event_id: string
  member_id: string
}

export type OpiStatus =
  | 'SUBMITTED'
  | 'CHANGES_REQUESTED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'

export type Opi = {
  id: string
  created_at: string
  submitter_id: string
  status: OpiStatus
  title: string
  summary: string | null
  document_url: string | null
  event_id: string | null
}

export type OpiVersion = {
  id: string
  opi_id: string
  title: string
  summary: string | null
  document_url: string | null
  submitted_at: string
}

export type OpiFeedback = {
  id: string
  created_at: string
  opi_id: string
  feedback: string
  decision: string | null
}

export const DEPARTMENTS = ['Electrical', 'Software', 'Business', 'Outreach', 'Mechanical', 'Design'] as const
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
  season_id: string
  claimed_minutes: number
  approved_minutes: number | null
  event_date: string
  proof_urls: string[]
  people_impacted: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewer_id: string | null
  decided_at: string | null
}

export type IndividualCredit = {
  season_id: string; member_id: string; raw_approved_minutes: number; cap_minutes: number;
  counted_individual_minutes: number; event_minutes: number; official_outreach_minutes: number
}
export type OutreachEventFields = Pick<OutreachEvent,'title'|'description'|'location'|'starts_at'|'ends_at'> & Partial<Pick<OutreachEvent,'season_id'|'latitude'|'longitude'>>
export type OutreachAttendanceCorrection = { member_id: string; arrival: string; departure?: string | null }
export type OutreachActionPayload =
  | ({ action: 'create' } & OutreachEventFields)
  | ({ action: 'edit'; id: string; attendance_corrections?: OutreachAttendanceCorrection[] } & Partial<OutreachEventFields>)
  | { action: 'cancel' | 'restore'; id: string }
  | { action: 'leads'; id: string; member_ids: string[] }
  | { action: 'rsvp'; event_id: string; planned: boolean }
  | ({ action: 'attendance'; event_id: string } & OutreachAttendanceCorrection)
export type IndividualOutreachActionPayload =
  | ({ action: 'submit' } & Pick<IndividualOutreach,'season_id'|'full_name'|'department'|'event_name'|'what_you_did'|'impact'|'claimed_minutes'|'event_date'|'proof_urls'|'people_impacted'>)
  | { action: 'approve'; id: string; approved_minutes: number }
  | { action: 'reject'; id: string }
  | { action: 'set_cap'; season_id: string; cap_minutes: number }

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
  role: Role
  displayed_role: string | null
  account_type: 'member' | 'mentor'
  verified: boolean
  permissions: string[]
  account_status: 'active' | 'deactivated' | 'rejected'
  avatar_url: string | null
  bio: string | null
  department: string | null
}

export type ProfileAction =
  | { action: 'get_self' }
  | ({ action: 'edit_self' } & Partial<Pick<ProfileRow, 'display_name' | 'department' | 'grade' | 'avatar_url' | 'bio' | 'displayed_role'>>)
export type AccountAction =
  | { action: 'approve' | 'reject' | 'deactivate' | 'reactivate' | 'remove_administrator' | 'transfer_presidency'; id: string }
  | { action: 'set_permissions'; id: string; permissions: Permission[] }
  | { action: 'make_administrator'; id: string; role: 'LEADERSHIP' | 'OFFICER' }
export type AccountDirectoryRow = ProfileRow & { email?: string | null }

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
  'manage_purchases',
  'manage_scouting',
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
  manage_purchases: 'Manage purchases',
  manage_scouting: 'Manage scouting',
}

export type Season = {
  id: string
  created_at: string
  name: string
  is_current: boolean
  outreach_target: number
  build_target: number
  individual_outreach_cap_minutes: number
}

export type SeasonActionPayload =
  | { action: 'create'; name: string; outreach_target?: number; build_target?: number; is_current?: boolean }
  | { action: 'edit'; id: string; name?: string; outreach_target?: number; build_target?: number }
  | { action: 'set_current'; id: string }
export type SettingsActionPayload =
  | { action: 'get' }
  | { action: 'edit'; org_name?: string; timezone?: 'America/Los_Angeles'; build_default_radius_m?: number }
export type OrganizationSettings = { org_name: string; timezone: string; build_default_radius_m: string }

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
  season_id: string
  owner_group_id: string
}

export type TaskOverview = Task & {owner_group_name:string;category_name:string|null;category_color:string|null;assignee_names:string[];is_assignee:boolean;is_reviewer:boolean}

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
  removed: boolean
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
  expires_at: string
  revoked: boolean
}

export type Group = {
  id: string
  created_at: string
  name: string
}
