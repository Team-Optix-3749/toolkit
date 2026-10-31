import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {useAuth} from '~/lib/auth'
import {can} from '~/lib/rbac'
import {taskOverviews} from '~/lib/task-overviews'
import {legalTaskActions,TASK_ACTION_LABEL,type TaskOperation} from '~/lib/tasks'
import {isOverdue} from '~/lib/time'
import {fmtDate,fmtDateTime} from '~/lib/format'
import {PrivateAttachment} from '~/components/PrivateAttachment'
import {Badge} from '~/components/Badge'
import {TaskEditor} from '~/components/TaskEditor'
import {ConfirmDialog} from '~/components/ConfirmDialog'
import type {TaskOverview,TaskEvidence,TaskHistory,Group} from '~/lib/types'
import {card,cardHead,cardTitle,input,textarea,label,btn,btnGhost} from '~/lib/ui'
export const Route=createFileRoute('/_app/tasks/$id')({component:TaskDetail})
function TaskDetail(){
 const {id}=Route.useParams();const {user,profile}=useAuth();const manager=can(profile,'manage_tasks')
 const [task,setTask]=useState<TaskOverview|null>(null),[evidence,setEvidence]=useState<TaskEvidence[]>([]),[history,setHistory]=useState<TaskHistory[]>([]),[submissions,setSubmissions]=useState<{id:string;author_id:string;submitted_at:string}[]>([]),[names,setNames]=useState<Record<string,string>>({}),[groups,setGroups]=useState<Group[]>([])
 const [work,setWork]=useState(false),[note,setNote]=useState(''),[link,setLink]=useState(''),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [confirmOperation,setConfirmOperation]=useState<TaskOperation|null>(null)
 async function load(){
  setLoading(true);setError('')
  try{
   const row=(await taskOverviews()).find(row=>row.id===id);if(!row)throw new Error('Task not found')
   setTask(row);const allowed=row.is_assignee||row.is_reviewer||manager;setWork(allowed)
   const [g,p]=await Promise.all([supabase.from('groups').select('*'),supabase.from('historical_profiles').select('id,display_name')]);setGroups(g.data as Group[]??[]);setNames(Object.fromEntries((p.data??[]).map(row=>[row.id,row.display_name])))
   if(allowed){const [e,h,s]=await Promise.all([supabase.from('task_evidence').select('*').eq('task_id',id).order('created_at'),supabase.from('task_history').select('*').eq('task_id',id).order('created_at'),supabase.from('task_submissions').select('*').eq('task_id',id).order('submitted_at')]);const failure=e.error||h.error||s.error;if(failure)throw failure;setEvidence(e.data as TaskEvidence[]);setHistory(h.data as TaskHistory[]);setSubmissions(s.data as {id:string;author_id:string;submitted_at:string}[])}else{setEvidence([]);setHistory([]);setSubmissions([])}
  }catch(cause){setError(cause&&typeof cause==='object'&&'message'in cause?String(cause.message):String(cause))}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[id,profile?.permissions])
 async function action(operation:TaskOperation| 'evidence'|'move_group'|'remove_file',fields:Record<string,unknown>={}){
  setBusy(true);setError('');const {data,error}=await supabase.rpc('task_action',{payload:{action:operation,id,expected_status:task!.status,...fields,...(operation==='request_changes'?{feedback}:{})}});setBusy(false);if(error){setError(error.message);return}
  if(operation==='remove_file'&&data.removed_path){const removal=await supabase.storage.from('task-evidence').remove([data.removed_path]);if(removal.error)setError('Metadata marked removed; object cleanup failed: '+removal.error.message)}
  setNote('');setLink('');setFeedback('');await load()
 }
 async function upload(file:File){
  const policy=await supabase.rpc('task_evidence_settings',{payload:{action:'get'}})
  if(policy.error){setError(policy.error.message);return}
  if(!policy.data.mime_types.includes(file.type)||file.size>policy.data.max_bytes){setError('Picture violates the configured task evidence MIME or size policy.');return}
  setBusy(true);const path=`${user!.id}/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
  const result=await supabase.storage.from('task-evidence').upload(path,file,{contentType:file.type})
  if(result.error){setError(result.error.message);setBusy(false);return}
  const registered=await supabase.rpc('task_action',{payload:{action:'evidence',id,kind:'picture',content:file.name,file_url:path}})
  if(registered.error){await supabase.storage.from('task-evidence').remove([path]);setError(registered.error.message)}else await load()
  setBusy(false)
 }
 if(loading&&!task)return <p role="status">Loading task…</p>
 if(!task)return <div role="alert">{error||'Task unavailable'}<button onClick={()=>void load()}>Retry task</button></div>
 const confirmation=<ConfirmDialog open={!!confirmOperation} title={confirmOperation?TASK_ACTION_LABEL[confirmOperation]:'Confirm task action'} description="Current group membership, selected-reviewer authority and task state are rechecked before commit." busy={busy} onCancel={()=>setConfirmOperation(null)} onConfirm={()=>{if(confirmOperation){void action(confirmOperation);setConfirmOperation(null)}}}/>
 const actions=legalTaskActions(task,task.is_assignee,task.is_reviewer,manager)
 return <div className="space-y-5">{confirmation}{error&&<p role="alert">{error}</p>}<section className={card}><div className={cardHead}><h1 className={cardTitle}>{task.title}</h1><Badge label={task.status} tone={task.status}/></div><div className="p-5 space-y-3"><p className="whitespace-pre-wrap">{task.description}</p><p>Owning group: {task.owner_group_name}</p><p>Current assignees: {task.assignee_names.join(', ')||'No current members'}</p><p>Category: {task.category_name??'None'} · {task.requires_review?'Review required':'No review required'}</p><p>{task.deadline?`Due ${fmtDate(task.deadline)} at Los Angeles end of day`:'No deadline'}{isOverdue(task.deadline,task.status)?' · Overdue':''}</p>{manager&&<label className={label}>Move whole task to owning group<select className={input} value={task.owner_group_id} disabled={busy} onChange={e=>void action('move_group',{owner_group_id:e.target.value})}>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
 {actions.includes('request_changes')&&<label className={label}>Required change feedback<textarea className={textarea} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label>}<div className="flex flex-wrap gap-3">{actions.map(operation=><button key={operation} disabled={busy} className={btnGhost} onClick={()=>setConfirmOperation(operation)}>{TASK_ACTION_LABEL[operation]}</button>)}</div></div></section>
 {manager&&<TaskEditor task={task} onSaved={()=>void load()}/>}
 {work?<><section className={card}><div className={cardHead}><h2 className={cardTitle}>Private work and evidence</h2></div><div className="p-5 space-y-4">{evidence.map(row=><div key={row.id} className="border-t border-line py-3"><p className="text-xs text-ink-soft">{names[row.user_id??'']??'Retained author'} · {fmtDateTime(row.created_at)}</p>{row.removed?<p>File removed; metadata and submitted history retained.</p>:row.kind==='picture'&&row.file_url?<PrivateAttachment bucket="task-evidence" reference={row.file_url} label={row.content}/>:row.kind==='link'?<a href={row.content} target="_blank" rel="noopener noreferrer" className="text-accent">{row.content}</a>:<p>{row.content}</p>}{manager&&row.file_url&&!row.removed&&<button className={btnGhost} onClick={()=>void action('remove_file',{evidence_id:row.id})}>Remove file, retain history</button>}</div>)}
 {task.is_assignee&&!['submitted','resubmitted','completed','cancelled'].includes(task.status)&&<div className="space-y-3"><label className={label}>Optional work note<textarea className={textarea} value={note} onChange={e=>setNote(e.target.value)}/></label><button disabled={busy||!note.trim()} className={btn} onClick={()=>void action('evidence',{kind:'note',content:note})}>Add note</button><label className={label}>Optional HTTP(S) link<input className={input} value={link} onChange={e=>setLink(e.target.value)}/></label><button disabled={busy||!link} className={btnGhost} onClick={()=>void action('evidence',{kind:'link',content:link})}>Add link</button><label className={label}>Optional picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0])}}/></label></div>}
 </div></section><section className={card}><div className={cardHead}><h2 className={cardTitle}>Retained submissions and review</h2></div><div className="p-5 space-y-3">{submissions.map(row=><p key={row.id}>Submitted by {names[row.author_id]??'Retained author'} · {fmtDateTime(row.submitted_at)}</p>)}{history.map(row=><div key={row.id}><p>{names[row.user_id??'']??'Retained reviewer'} · {row.to_status} · {fmtDateTime(row.created_at)}</p><p className="whitespace-pre-wrap">{row.feedback}</p></div>)}</div></section></>:<p>Overview only. Evidence, submission history and reviewer feedback are private to current task participants and task managers.</p>}</div>
}
