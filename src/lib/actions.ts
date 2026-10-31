import { supabase } from './supabase'
import type { AccountAction, AccountDirectoryRow, ProfileAction, ProfileRow, OutreachActionPayload, IndividualOutreachActionPayload, IndividualOutreach, IndividualCredit } from './types'
import type { BuildActionPayload } from './types'

export async function profileAction(payload: ProfileAction) {
  const result = await supabase.rpc('profile_action', { payload })
  return { ...result, data: result.data as ProfileRow | null }
}
export async function accountAction(payload: AccountAction) {
  const result = await supabase.rpc('account_action', { payload })
  return { ...result, data: result.data as ProfileRow | null }
}
export async function accountDirectory() {
  const result = await supabase.rpc('account_directory', { payload: {} })
  return { ...result, data: result.data as AccountDirectoryRow[] | null }
}

export async function outreachAction(payload: OutreachActionPayload) {
  return supabase.rpc('outreach_action', { payload })
}
export async function individualOutreachAction(payload: IndividualOutreachActionPayload) {
  const result = await supabase.rpc('individual_outreach_action', { payload })
  return { ...result, data: result.data as IndividualOutreach | null }
}
export async function individualCredit(payload: {season_id: string; member_id?: string}) {
  const result = await supabase.rpc('individual_credit', { payload })
  return { ...result, data: result.data as IndividualCredit | null }
}

export async function buildAction(payload: BuildActionPayload) {
  return supabase.rpc('build_action', {payload})
}
