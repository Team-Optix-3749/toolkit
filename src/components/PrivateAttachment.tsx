import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'

// Legacy references are accepted only from this project's exact Storage bucket.
export function storagePath(bucket: string, reference: string): string {
  if (!/^https?:\/\//i.test(reference)) return reference.replace(/^\/+/, '')
  const url = new URL(reference)
  const configured = new URL(import.meta.env.VITE_SUPABASE_URL)
  const prefixes = [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/authenticated/${bucket}/`]
  const prefix = prefixes.find(value => url.pathname.startsWith(value))
  if (url.origin !== configured.origin || !prefix) throw new Error('Attachment is not in this project bucket.')
  return decodeURIComponent(url.pathname.slice(prefix.length))
}
export function PrivateAttachment({ bucket, reference, label }: {bucket: string; reference: string; label: string}) {
  const { identityEpoch } = useAuth()
  const [source, setSource] = useState('')
  const [mime, setMime] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setSource(''); setError('')
    void (async () => {
      try {
        const {data,error:failure} = await supabase.storage.from(bucket).download(storagePath(bucket,reference))
        if (failure || !data) throw failure ?? new Error('Attachment unavailable')
        if (!active) return
        objectUrl = URL.createObjectURL(data)
        setMime(data.type); setSource(objectUrl)
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Attachment access denied') }
    })()
    return () => { active=false; if(objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [bucket,reference,identityEpoch,attempt])
  if (error) return <div role="alert"><p>{label}: {error}</p><button onClick={() => setAttempt(value=>value+1)}>Retry attachment</button></div>
  if (!source) return <p role="status">Loading {label.toLowerCase()}…</p>
  return <div className="space-y-2">
    {mime.startsWith('image/') ? <img src={source} alt={label} className="max-w-full border border-line" /> :
      mime.startsWith('video/') ? <video src={source} controls aria-label={label} className="max-w-full" /> :
      mime === 'application/pdf' ? <iframe src={source} title={label} className="w-full h-[420px] border border-line" sandbox="" /> : null}
    <a href={source} download={reference.split('/').pop()?.split('?')[0]} className="text-accent hover:underline">Download {label.toLowerCase()}</a>
  </div>
}
