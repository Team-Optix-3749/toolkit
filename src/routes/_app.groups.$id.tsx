import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {TaskWorkspace} from '~/components/TaskWorkspace'
import {supabase} from '~/lib/supabase'
export const Route=createFileRoute('/_app/groups/$id')({component:GroupTasks})
function GroupTasks(){
 const {id}=Route.useParams(),[name,setName]=useState(''),[members,setMembers]=useState<string[]>([]),[error,setError]=useState('')
 useEffect(()=>{void Promise.all([supabase.from('groups').select('name').eq('id',id).maybeSingle(),supabase.from('group_members').select('user_id').eq('group_id',id),supabase.from('public_directory').select('id,display_name')]).then(([group,links,people])=>{const failure=group.error||links.error||people.error;if(failure){setError(failure.message);return}setName(group.data?.name??'Group unavailable');setMembers((links.data??[]).map(link=>people.data?.find(person=>person.id===link.user_id)?.display_name).filter((value):value is string=>!!value))})},[id])
 return <div className="space-y-4"><section><h1 className="text-xl">{name}</h1><p>Current member names: {members.join(', ')||'No active members'}</p><p>Browsing this group grants no task or membership-management authority.</p>{error&&<p role="alert">{error}</p>}</section><TaskWorkspace groupId={id}/></div>
}
