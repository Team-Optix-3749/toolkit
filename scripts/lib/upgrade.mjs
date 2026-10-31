// Shared local inventory rules; never connect to or mutate a hosted database.
export const mappings = [
  ['build_zones','build_locations', {gps_lat:'latitude',gps_lng:'longitude',gps_radius_m:'radius_m'}],
  ['build_schedule','build_sessions', {starts_at:'opens_at',ends_at:'closes_at',zone_id:'location_id'}],
  ['build_checkins','build_records', {user_id:'member_id',checked_in_at:'check_in',checked_out_at:'check_out'}],
  ['outreach_planned_attendance','outreach_rsvps', {user_id:'member_id'}],
  ['outreach_checkins','outreach_attendance', {user_id:'member_id',checked_in_at:'arrival',departed_at:'departure'}],
  ['opi_initiatives','opis', {user_id:'submitter_id',description:'summary',doc_url:'document_url',linked_event_id:'event_id'}],
  ['opi_comments','opi_feedback', {initiative_id:'opi_id',body:'feedback'}],
]
export const knownTables = new Set([
  'seasons','profiles','invitations','groups','group_members','task_groups','tasks','task_assignees','task_assigned_groups','task_reviewers','task_evidence','task_history','task_submissions','task_submission_evidence',
  'members','login_events','events','event_checkins','hours_log','individual_outreach','purchases','notifications','notification_preferences','notification_templates','org_settings','email_templates','qr_tokens',
  'build_locations','build_sessions','build_records','build_qr_tokens','outreach_events','outreach_leads','outreach_rsvps','outreach_attendance','opis','opi_versions','opi_feedback',
  'scout_events','scout_event_members','scout_schedule','scout_assignments','scout_match_entries','scout_pit_entries','scout_matches','scout_pits','match_scouting','pit_scouting','scout_match_schedule','scout_match_assignments','scout_pit_assignments','scout_event_schedule','scout_event_assignments','scouting_events','scouting_matches','scouting_assignments','scouting_match_entries','scouting_pit_entries',
  ...mappings.map(([source]) => source),
])
const correctionFields = {
  profiles: ['account_type','role','display_name'], build_locations:['name','latitude','longitude','radius_m'],
  build_sessions:['season_id','location_id','closes_at','title'], outreach_events:['season_id','ends_at','title','location'],
  build_records:['session_id','check_out'], outreach_attendance:['event_id','departure'],
  tasks:['season_id','owner_group_id'], individual_outreach:['season_id'], opis:['season_id'],
}
export function rowKey(row) {
  return row.id ?? row.key ?? (row.submission_id?`${row.submission_id}:${row.evidence_id}`:`${row.event_id ?? row.task_id ?? row.group_id ?? ''}:${row.member_id ?? row.user_id ?? ''}`)
}
export function normalize(source, row) {
  const result = { ...row }
  const entry = mappings.find(([name]) => name === source)
  for (const [oldName,newName] of Object.entries(entry?.[2] ?? {})) {
    if (oldName in result) { result[newName] = result[oldName]; delete result[oldName] }
  }
  if (source === 'opi_comments' && row.author_id != null) result.user_id = row.author_id
  if (source === 'outreach_events') {
    for (const [oldName,newName] of [['lat','latitude'],['lng','longitude']]) {
      if (result[newName] == null && oldName in result) result[newName] = result[oldName]
    }
    delete result.lat; delete result.lng; delete result.lead_ids
  }
  if (source === 'build_checkins' || source === 'build_records') {
    result.checkout_method = result.automatically_closed ? 'automatic' : ({manual:'member',self:'member',gps:'member',qr:'member',auto:'automatic',admin:'administrative correction',correction:'administrative correction'}[result.checkout_method] ?? result.checkout_method ?? 'member')
    if (result.check_out != null) result.credited_minutes = (Date.parse(result.check_out) - Date.parse(result.check_in)) / 60000
  }
  if ((source === 'outreach_checkins' || source === 'outreach_attendance') && result.departure != null) result.credited_minutes = (Date.parse(result.departure) - Date.parse(result.arrival)) / 60000
  return result
}
export function analyze(data, mapping = {}) {
  const errors = []
  const targets = {}
  const legacy = mappings.some(([name]) => name in data)
  const current = ['build_locations','build_sessions','build_records','outreach_rsvps','outreach_attendance','opis'].some(name => name in data)
  const shape = legacy && current ? 'both' : legacy ? 'legacy' : current ? 'current' : Object.keys(data).length ? 'legacy' : 'fresh'
  for (const table of Object.keys(data)) if (!knownTables.has(table)) errors.push({table, error:'unrecognized public table'})
  for (const [table, rows] of Object.entries(mapping)) {
    if (!correctionFields[table] || !rows || typeof rows !== 'object' || Array.isArray(rows)) { errors.push({table,error:'invalid mapping table'}); continue }
    for (const [id, patch] of Object.entries(rows)) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) { errors.push({table,id,error:'invalid correction'}); continue }
      for (const [field,value] of Object.entries(patch)) {
        if (!correctionFields[table].includes(field)) errors.push({table,id,field,error:'unsupported correction field'})
        if (value == null || (typeof value === 'string' && !value.trim())) errors.push({table,id,field,error:'correction must supply a value'})
        if ((field.endsWith('_id') || field === 'id') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) errors.push({table,id,field,error:'invalid UUID correction'})
        if (field === 'account_type' && !['member','mentor'].includes(value)) errors.push({table,id,field,error:'invalid account type'})
        if (field === 'role' && !['PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER'].includes(value)) errors.push({table,id,field,error:'invalid role'})
        if (['closes_at','ends_at','check_out','departure'].includes(field) && (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) errors.push({table,id,field,error:'end must be an offset-qualified timestamp'})
        if (['latitude','longitude','radius_m'].includes(field) && (typeof value !== 'number' || !Number.isFinite(value) || (field==='latitude' && Math.abs(value)>90) || (field==='longitude' && Math.abs(value)>180) || (field==='radius_m' && value<=0))) errors.push({table,id,field,error:'invalid location correction'})
      }
    }
  }
  for (const [source,rows] of Object.entries(data)) {
    const table = mappings.find(([name]) => name === source)?.[1] ?? source
    targets[table] ??= new Map()
    for (const original of rows) {
      const row = normalize(source,original)
      const id = rowKey(row)
      const previous = targets[table].get(id)
      if (previous) {
        // Missing optional legacy-only keys are retained privately, not official duplicates.
        const conflicts = Object.keys(row).filter(key => key in previous && JSON.stringify(previous[key]) !== JSON.stringify(row[key]))
        if (conflicts.length) errors.push({table,id,fields:conflicts,error:'duplicate ID has conflicting mapped values'})
      } else targets[table].set(id,row)
    }
  }
  for (const [table,rows] of Object.entries(mapping)) for (const [id,patch] of Object.entries(rows ?? {})) {
    const row = targets[table]?.get(id)
    if (!row) errors.push({table,id,error:'correction target does not exist'})
    else Object.assign(row,patch)
  }
  const rows = table => [...(targets[table]?.values() ?? [])]
  const requireFields = (table,fields) => {
    for (const row of rows(table)) for (const field of fields) if (row[field] == null || row[field] === '') errors.push({table,id:rowKey(row),field,value:row[field] ?? null,error:'explicit association/correction required'})
  }
  requireFields('profiles',['display_name','account_type'])
  requireFields('build_locations',['name'])
  requireFields('build_sessions',['season_id','location_id','opens_at','closes_at','title'])
  requireFields('outreach_events',['season_id','starts_at','ends_at','title','location'])
  requireFields('build_records',['member_id','session_id','check_in'])
  requireFields('outreach_attendance',['member_id','event_id','arrival'])
  requireFields('individual_outreach',['season_id'])
  requireFields('tasks',['season_id','owner_group_id'])
  requireFields('opis',['season_id','submitter_id'])
  const owners = rows('profiles').filter(row => row.role === 'OWNER')
  if (rows('profiles').length && owners.length !== 1) errors.push({table:'profiles',ids:owners.map(row => row.id),error:'exactly one explicitly selected President required'})
  const permissionNames = new Set(['manage_accounts','manage_invitations','manage_tasks','manage_groups','manage_seasons','manage_outreach_events','manage_outreach_attendance','manage_build_hours','manage_opis','export_records','manage_scouting','manage_purchases'])
  const permissionChanges = rows('profiles').filter(row => ['OFFICER','LEADERSHIP'].includes(row.role)).map(row => ({id:row.id,role:row.role,retained_explicit_permissions:[...new Set([...(row.permissions ?? []),...(row.special_perms ?? [])])].filter(permission => permissionNames.has(permission)),implicit_domain_access_removed:row.role === 'OFFICER'}))
  for (const row of rows('profiles')) {
    if (!['member','mentor'].includes(row.account_type)) errors.push({table:'profiles',id:row.id,error:'explicit member/mentor account type required'})
    if (!['PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER'].includes(row.role)) errors.push({table:'profiles',id:row.id,error:'unrecognized role; explicit role mapping required'})
    if (['OWNER','LEADERSHIP','OFFICER'].includes(row.role) && row.account_type !== 'member') errors.push({table:'profiles',id:row.id,error:'student administrator must have member account type'})
    const unknown = [...new Set([...(row.permissions ?? []),...(row.special_perms ?? [])])].filter(permission => !permissionNames.has(permission))
    if (unknown.length) errors.push({table:'profiles',id:row.id,permissions:unknown,error:'unrecognized historical permissions; correct source explicitly'})
  }
  const references = [
    ['build_sessions','location_id','build_locations'],['build_sessions','season_id','seasons'],['outreach_events','season_id','seasons'],['tasks','season_id','seasons'],['tasks','owner_group_id','groups'],['individual_outreach','season_id','seasons'],['opis','season_id','seasons'],
    ['build_records','session_id','build_sessions'],['build_records','member_id','profiles'],['outreach_attendance','event_id','outreach_events'],['outreach_attendance','member_id','profiles'],['opis','submitter_id','profiles'],['opis','event_id','outreach_events'],
  ]
  for (const [table,field,target] of references) for (const row of rows(table)) if (row[field] != null && !targets[target]?.has(row[field])) errors.push({table,id:rowKey(row),field,value:row[field],error:`missing ${target} association`})
  for (const [table,start,end] of [['build_sessions','opens_at','closes_at'],['outreach_events','starts_at','ends_at'],['build_records','check_in','check_out'],['outreach_attendance','arrival','departure']]) {
    for (const row of rows(table)) if (row[end] != null && (!Number.isFinite(Date.parse(row[start])) || !Number.isFinite(Date.parse(row[end])) || Date.parse(row[end]) <= Date.parse(row[start]))) errors.push({table,id:rowKey(row),error:'end must be later than start'})
  }
  for (const [table,parent] of [['outreach_attendance','event_id'],['outreach_rsvps','event_id']]) {
    const seen = new Set()
    for (const row of rows(table)) { const key = `${row[parent]}:${row.member_id}`; if (seen.has(key)) errors.push({table,id:rowKey(row),error:'duplicate member/event record'}); seen.add(key) }
  }
  const intervals = []
  for (const [table,start,end] of [['build_records','check_in','check_out'],['outreach_attendance','arrival','departure']]) for (const row of rows(table)) {
    if (row.credit_enabled === false) continue
    intervals.push({table,id:rowKey(row),member:row.member_id,start:Date.parse(row[start]),end:row[end] == null ? Infinity : Date.parse(row[end])})
  }
  intervals.sort((a,b) => String(a.member).localeCompare(String(b.member)) || a.start-b.start)
  for (let i=0;i<intervals.length;i++) for (let j=i+1;j<intervals.length && intervals[j].member === intervals[i].member && intervals[j].start<intervals[i].end;j++) errors.push({table:intervals[j].table,id:intervals[j].id,conflicts_with:intervals[i].id,error:'overlapping credited attendance; correct source explicitly'})
  const links = new Set()
  for (const row of rows('opis')) {
    if ((row.status === 'CONVERTED') !== Boolean(row.event_id)) errors.push({table:'opis',id:row.id,error:'inconsistent converted OPI/event link'})
    if (row.event_id && links.has(row.event_id)) errors.push({table:'opis',id:row.id,error:'event linked to multiple OPIs'})
    if (row.event_id) links.add(row.event_id)
  }
  return {shape,errors,permissionChanges,counts:Object.fromEntries(Object.entries(data).map(([name,items]) => [name,items.length])),targets:Object.fromEntries(Object.entries(targets).map(([name,items]) => [name,[...items.values()]]))}
}
