import type {TaskStatus} from './types'
export type TaskOperation='start'|'submit'|'resubmit'|'complete'|'request_changes'|'approve'|'cancel'|'reopen'|'override_complete'
export function legalTaskActions(task:{status:TaskStatus;requires_review:boolean},assignee:boolean,reviewer:boolean,manager:boolean):TaskOperation[]{
 const actions:TaskOperation[]=[]
 if(assignee){if(task.status==='assigned')actions.push('start');if(['assigned','in_progress'].includes(task.status))actions.push(task.requires_review?'submit':'complete');if(task.requires_review&&task.status==='changes_requested')actions.push('resubmit')}
 if(reviewer&&['submitted','resubmitted'].includes(task.status))actions.push('request_changes','approve')
 if(manager){if(!['completed','cancelled'].includes(task.status))actions.push('cancel','override_complete');if(task.status==='completed')actions.push('reopen')}
 return actions
}
export const TASK_ACTION_LABEL:Record<TaskOperation,string>={start:'Start',submit:'Submit for review',resubmit:'Resubmit',complete:'Complete',request_changes:'Request changes',approve:'Approve',cancel:'Cancel',reopen:'Reopen',override_complete:'Override complete'}
