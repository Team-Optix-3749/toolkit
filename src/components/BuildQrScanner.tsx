import {useEffect,useRef,useState} from 'react'
type Detector={detect:(source:HTMLVideoElement)=>Promise<{rawValue:string}[]>}
declare global { interface Window { BarcodeDetector?: new(options:{formats:string[]})=>Detector } }
export function BuildQrScanner({onToken}:{onToken:(token:string,sessionId:string)=>void}){
 const video=useRef<HTMLVideoElement>(null),[error,setError]=useState('')
 useEffect(()=>{
  let active=true,stream:MediaStream|null=null,timer:number|undefined
  const implementation=window.BarcodeDetector
  if(!implementation){setError('Camera QR decoding is unavailable in this browser. Use your device camera to open the QR link, or enter its token manually.');return}
  const detector=new implementation({formats:['qr_code']})
  void navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(async camera=>{
   if(!active){camera.getTracks().forEach(track=>track.stop());return}stream=camera;video.current!.srcObject=camera;await video.current!.play()
   const scan=async()=>{if(!active||!video.current)return;try{for(const result of await detector.detect(video.current)){const url=new URL(result.rawValue);if(url.origin!==window.location.origin||!url.pathname.endsWith('/build/check-in'))throw new Error('QR is not a Toolkit build link');const token=url.searchParams.get('token'),session=url.searchParams.get('session_id');if(!token||!session)throw new Error('QR is missing session or token');onToken(token,session);return}}catch(cause){if(cause instanceof Error)setError(cause.message)}timer=window.setTimeout(()=>void scan(),250)}
   await scan()
  }).catch(cause=>setError(cause instanceof Error?cause.message:'Camera access denied; use manual token entry.'))
  return()=>{active=false;clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop())}
 },[onToken])
 return <div><video ref={video} playsInline muted className="w-full max-w-sm" aria-label="Build QR camera preview"/>{error&&<p role="alert">{error}</p>}</div>
}
