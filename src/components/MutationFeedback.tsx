import {useEffect,useId} from 'react'
export function MutationFeedback({error,success,fieldErrors={}}:{error?:string|null;success?:string|null;fieldErrors?:Record<string,string>}){
 const id=useId()
 useEffect(()=>{
  const entries=Object.entries(fieldErrors)
  for(const [control,message]of entries){const field=document.getElementById(control);field?.setAttribute('aria-invalid','true');field?.setAttribute('aria-describedby',`${id}-${control}`)}
  if(entries.length)document.getElementById(entries[0][0])?.focus()
  return()=>{for(const [control]of entries){const field=document.getElementById(control);field?.removeAttribute('aria-invalid');field?.removeAttribute('aria-describedby')}}
 },[fieldErrors,id])
 return <div aria-live="polite" className="space-y-2">{error&&<p role="alert" className="text-danger">{error}</p>}{Object.entries(fieldErrors).map(([field,message])=><p key={field} id={`${id}-${field}`} role="alert" className="text-danger">{message}</p>)}{success&&<p role="status">{success}</p>}</div>
}
