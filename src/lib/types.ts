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
  qr_token: string | null
}

export type OutreachCheckin = {
  id: string
  event_id: string | null
  user_id: string
  method: string
  checked_in_at: string
  minutes_logged: number | null
}

export type OpiInitiative = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  title: string
  description: string | null
  doc_url: string | null
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'EXECUTED' | 'REJECTED'
  reviewer_id: string | null
}

export type OpiComment = {
  id: string
  created_at: string
  initiative_id: string
  user_id: string
  body: string
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
  avatar_url: string | null
  bio: string | null
}
