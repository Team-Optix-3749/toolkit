import {useEffect,useId,useRef,type ReactNode} from 'react'
import {btn,btnGhost} from '~/lib/ui'
export function ConfirmDialog({open,title,description,busy=false,onCancel,onConfirm,children}:{open:boolean;title:string;description:string;busy?:boolean;onCancel:()=>void;onConfirm:()=>void;children?:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),id=useId()
 useEffect(()=>{if(!open)return;const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.current?.showModal();cancel.current?.focus();return()=>{dialog.current?.close();previous?.focus()}},[open])
 return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event=>{event.preventDefault();if(!busy)onCancel()}} className="bg-panel text-ink rounded-xl border border-line p-6 max-w-md backdrop:bg-black/60"><h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2><p id={`${id}-description`} className="my-4">{description}</p>{children}<div className="flex gap-3 mt-4"><button ref={cancel} disabled={busy} className={btnGhost} onClick={onCancel}>Cancel</button><button disabled={busy} className={btn} onClick={onConfirm}>Confirm</button></div></dialog>
}
