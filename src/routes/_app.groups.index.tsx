import {createFileRoute,Link} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import type {Group} from '~/lib/types'
import {card,cardHead,cardTitle} from '~/lib/ui'
export const Route=createFileRoute('/_app/groups/')({component:Groups})
function Groups(){const [groups,setGroups]=useState<Group[]>([]),[error,setError]=useState('');useEffect(()=>{void supabase.from('groups').select('id,name').order('name').then(({data,error})=>{if(error)setError(error.message);else setGroups(data as Group[])})},[]);return <section className={card}><div className={cardHead}><h1 className={cardTitle}>Member groups</h1><Link to="/tasks">Combined task workspace</Link></div><div className="p-5 space-y-3">{error&&<p role="alert">{error}</p>}{groups.map(group=><Link key={group.id} to="/groups/$id" params={{id:group.id}} className="block text-accent">{group.name} — group task list</Link>)}</div></section>}
