import {createClient} from '@supabase/supabase-js'
const api=process.env.VITE_SUPABASE_URL??'http://127.0.0.1:54321'
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(api).hostname))throw new Error('Storage fixtures require localhost')
const key=process.env.VITE_SUPABASE_ANON_KEY
if(!key)throw new Error('Load the local anon key from ignored .env.local')
const client=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}})
const signed=await client.auth.signInWithPassword({email:'member-a@example.test',password:'Optix-local-only-3749!'})
if(signed.error)throw signed.error
const id=signed.data.user.id
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6r1sAAAAASUVORK5CYII=','base64')
async function upload(bucket,path){const exists=await client.storage.from(bucket).download(path);if(!exists.error)return;const result=await client.storage.from(bucket).upload(path,image,{contentType:'image/png'});if(result.error)throw result.error}
const proof=`${id}/local-fixture-proof.png`,receipt=`${id}/local-fixture-receipt.png`,task='70000000-0000-4000-8000-000000000001',picture=`${id}/${task}/local-fixture-task.png`
for(const [bucket,path]of [['outreach-proofs',proof],['receipts',receipt],['task-evidence',picture]])await upload(bucket,path)
const requests=[
 ['individual_outreach_action',{action:'submit',season_id:'20000000-0000-4000-8000-000000000001',full_name:'Fake Member A',department:'Software',event_name:'Local attachment fixture',what_you_did:'Local fake workshop',impact:'Local fixture verification',event_date:'2026-10-29',people_impacted:1,claimed_minutes:90,proof_urls:[proof]}],
 ['purchase_action',{action:'submit',kind:'reimbursement',description:'Local receipt fixture',amount:12.5,receipt_url:receipt}],
 ['task_action',{action:'evidence',id:task,kind:'picture',content:'Local task picture fixture',file_url:picture}],
]
for(const [rpc,payload]of requests){const result=await client.rpc(rpc,{payload});if(result.error)throw result.error}
await client.auth.signOut({scope:'local'})
console.log('Uploaded real private image fixtures and registered scoped proof, receipt and task evidence through authenticated actions.')
