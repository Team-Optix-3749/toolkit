import {useState} from 'react'
export function docsDocumentId(value:string|null|undefined):string|null{
 if(!value)return null
 try{const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.username||url.password||url.port)return null;return url.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]+)(?:\/.*)?$/)?.[1]??null}catch{return null}
}
export function OpiDocumentPreview({url}:{url:string|null|undefined}){
 const id=docsDocumentId(url),[attempt,setAttempt]=useState(0)
 if(!id)return <p>Document preview unavailable: this retained URL is not a valid Google Docs document.</p>
 return <section className="space-y-3"><div className="flex flex-wrap gap-4"><a href={`https://docs.google.com/document/d/${id}/edit`} target="_blank" rel="noopener noreferrer" className="text-accent">Open in Google Docs</a><button onClick={()=>setAttempt(value=>value+1)}>Reload preview</button></div><p className="text-sm text-ink-soft">Google sharing, sign-in or browser restrictions may prevent viewing. This live document is not an immutable copy of its submitted URL/summary. If access fails, request changes with feedback; the external link remains available.</p><iframe key={`${id}:${attempt}`} title="Submitted Google Docs document preview" src={`https://docs.google.com/document/d/${id}/preview`} loading="lazy" className="w-full min-h-[480px] rounded-xl border border-line"/></section>
}
