"use client";
import {useEffect,useState} from "react";
import Header from "@/components/Header";
import {supabase} from "@/lib/supabase";
export default function AdminVerifications(){
 const [allowed,setAllowed]=useState(false),[items,setItems]=useState([]),[message,setMessage]=useState("Checking administrator access..."),[busy,setBusy]=useState(false),[document,setDocument]=useState(null),[notes,setNotes]=useState({});
 async function load(){
  try{
   const check=await supabase.rpc('is_marketplace_admin');if(check.error || !check.data){setMessage('Administrator access required.');return;}
   setAllowed(true);const result=await supabase.from('identity_verifications').select('*').eq('status','pending').order('submitted_at');
   if(result.error)throw result.error;setItems(result.data || []);setMessage('');
  }catch{setMessage('Could not load pending verifications.');}
 }
 useEffect(()=>{load();},[]);
 async function view(item){
  setDocument(null);const result=await supabase.storage.from('identity-documents').createSignedUrl(item.document_path,60);
  if(result.error){setMessage('Could not open ID document.');return;}
  setDocument({userId:item.user_id,url:result.data.signedUrl});
 }
 async function review(item,decision){
  if(busy)return;setBusy(true);setMessage('');setDocument(null);
  try{const result=await supabase.rpc('review_identity',{p_user_id:item.user_id,p_decision:decision,p_note:notes[item.user_id] || ''});if(result.error)throw result.error;await load();}
  catch(error){setMessage(error.message || 'Review failed.');}finally{setBusy(false);}
 }
 return <><Header/><main className="page"><div className="container narrow"><h1>ID approval queue</h1><p>Review whether the ID is valid and the name matches before approving. ID links expire after one minute. Do not share or download documents unnecessarily.</p>
 {message && <p role="status">{message}</p>}{allowed && items.length===0 && <p>No pending submissions.</p>}
 {allowed && items.map(item=><article key={item.user_id} className="listing-form" style={{padding:20,border:'1px solid #ddd',marginBottom:20}}>
 <h2>{item.full_name}</h2><p>{item.id_type} · {new Date(item.submitted_at).toLocaleString()}</p><p>User ID: {item.user_id}</p>
 <button disabled={busy} onClick={()=>view(item)}>View private ID</button>
 {document?.userId===item.user_id && <img src={document.url} alt="Private ID submitted for review" style={{maxWidth:'100%'}}/>}
 <label>Review note<input maxLength={500} value={notes[item.user_id] || ''} onChange={e=>setNotes({...notes,[item.user_id]:e.target.value})}/></label>
 <button disabled={busy} onClick={()=>review(item,'approved')}>Approve account</button><button disabled={busy} onClick={()=>review(item,'rejected')}>Reject — request a new ID</button>
 </article>)}</div></main></>;
}
