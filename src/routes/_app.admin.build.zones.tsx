import {createFileRoute} from '@tanstack/react-router'
import {useEffect,useState} from 'react'
import {supabase} from '~/lib/supabase'
import {card,cardHead,cardTitle,input,label,btn,btnGhost} from '~/lib/ui'
export const Route=createFileRoute('/_app/admin/build/zones')({component:Locations})
type Location={id:string;name:string;latitude:number|null;longitude:number|null;radius_m:number|null}
function Locations(){
 const [rows,setRows]=useState<Location[]>([]),[id,setId]=useState(''),[name,setName]=useState(''),[lat,setLat]=useState(''),[lng,setLng]=useState(''),[radius,setRadius]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function load(){const {data,error}=await supabase.from('build_locations').select('*').order('name');if(error)setError(error.message);else setRows(data as Location[])}
 useEffect(()=>{void load()},[])
 async function save(){
  const configured=!!lat||!!lng||!!radius
  if(configured&&(!lat||!lng||!radius)){setError('GPS needs latitude, longitude and radius together.');return}
  setBusy(true);const {error}=await supabase.rpc('build_action',{payload:{action:'location',...(id?{id}:{}),name,latitude:configured?Number(lat):null,longitude:configured?Number(lng):null,radius_m:configured?Number(radius):null}});setBusy(false)
  if(error){setError(error.message);return}setId('');setName('');setLat('');setLng('');setRadius('');setError('');await load()
 }
 return <section className={card}><div className={cardHead}><h1 className={cardTitle}>Build locations</h1></div><div className="p-5 space-y-4"><p>QR works without GPS configuration. GPS uses only this location's configured geofence, never a shared school fallback.</p><label className={label}>Name<input className={input} value={name} onChange={e=>setName(e.target.value)}/></label><div className="grid sm:grid-cols-3 gap-3"><label className={label}>Latitude<input type="number" step="any" className={input} value={lat} onChange={e=>setLat(e.target.value)}/></label><label className={label}>Longitude<input type="number" step="any" className={input} value={lng} onChange={e=>setLng(e.target.value)}/></label><label className={label}>Radius (meters)<input type="number" step="any" className={input} value={radius} onChange={e=>setRadius(e.target.value)}/></label></div><button disabled={busy} className={btn} onClick={()=>void save()}>{id?'Save location':'Create location'}</button>{error&&<p role="alert">{error}</p>}{rows.map(row=><div key={row.id} className="border-t border-line py-3 flex justify-between"><p>{row.name} · {row.latitude===null?'QR only':`${row.latitude}, ${row.longitude} · ${row.radius_m}m`}</p><button className={btnGhost} onClick={()=>{setId(row.id);setName(row.name);setLat(row.latitude===null?'':String(row.latitude));setLng(row.longitude===null?'':String(row.longitude));setRadius(row.radius_m===null?'':String(row.radius_m))}}>Edit geofence</button></div>)}</div></section>
}
