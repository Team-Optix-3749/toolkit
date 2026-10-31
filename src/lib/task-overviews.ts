import {supabase} from './supabase'
import type {TaskOverview} from './types'
export async function taskOverviews(filters:{scope?:'all'|'mine'|'review';owner_group_id?:string}={}){
 const rows:TaskOverview[]=[];let cursor:string|null=null
 do{
  const result = await supabase.rpc('task_overviews',{payload:{...filters,...(cursor?{cursor}:{})}})
  if(result.error)throw result.error
  const page: {rows:TaskOverview[];next_cursor:string|null} = result.data
  if(!page||!Array.isArray(page.rows))throw new Error('Invalid task overview response')
  rows.push(...page.rows);cursor=page.next_cursor
 }while(cursor)
 return rows
}
