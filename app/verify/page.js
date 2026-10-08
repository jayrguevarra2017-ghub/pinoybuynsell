"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { photoTypes, validatePhoto } from "@/lib/listing-photo";

export default function VerificationPage() {
  const [user,setUser]=useState(null), [record,setRecord]=useState(null), [ready,setReady]=useState(false);
  const [name,setName]=useState(""),[type,setType]=useState(""),[file,setFile]=useState(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function load() {
    try {
      const {data:{user},error}=await supabase.auth.getUser();
      if(error || !user){setUser(null);return;}
      setUser(user);
      const result=await supabase.from("identity_verifications").select("status,review_note").eq("user_id",user.id).maybeSingle();
      if(result.error)throw result.error;
      setRecord(result.data);
    }catch{setMessage("Verification is unavailable. Please try again later.");}
    finally{setReady(true);}
  }
  useEffect(()=>{load();},[]);
  async function submit(e){
    e.preventDefault();if(busy)return;
    const error=validatePhoto(file);
    if(!file || error){setMessage(error || "Attach a clear photo of your government ID.");return;}
    setBusy(true);setMessage("");
    try{
      const path=`${user.id}/${crypto.randomUUID()}.${photoTypes[file.type]}`;
      const upload=await supabase.storage.from("identity-documents").upload(path,file,{contentType:file.type,upsert:false});
      if(upload.error)throw upload.error;
      const result=await supabase.rpc("submit_identity",{p_name:name,p_type:type,p_path:path});
      if(result.error)throw result.error;
      setFile(null);setRecord({status:"pending"});setMessage("ID submitted. Your account is pending administrator approval.");
    }catch(error){setMessage(error.message || "Could not submit verification. Refresh to check your status before retrying.");}
    finally{setBusy(false);}
  }
  return <><Header/><main className="page"><div className="container narrow">
    <h1>Account verification</h1>
    <p>Upload a clear government-issued ID matching your name. An administrator must approve your account before you can sell or bid. Verification does not guarantee another user's trustworthiness.</p>
    {!ready?<p>Loading verification...</p>:!user?<Link href="/login">Sign in to verify your account</Link>:<>
      <p>Status: <strong>{record?.status || "ID required"}</strong></p>
      {record?.review_note && <p>Review note: {record.review_note}</p>}
      {(!record || record.status==='rejected') && <form className="listing-form" onSubmit={submit}>
        <label>Full name as shown on ID<input required minLength={2} maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>ID type<select required value={type} onChange={e=>setType(e.target.value)}><option value="">Choose ID type</option>{['PhilSys ID','Passport','Driver license','Other government ID'].map(t=><option key={t}>{t}</option>)}</select></label>
        <label>ID photo<input type="file" required accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0] || null)}/></label>
        <p>JPEG, PNG or WebP, up to 5 MB. This document is private and accessible to verification administrators, not displayed on listings. Do not upload anyone else's ID.</p>
        <label><input type="checkbox" required/> I agree to submit this document for administrator review of my marketplace account.</label>
        <button className="sell" disabled={busy}>{busy?'Submitting...':'Submit ID for approval'}</button>
      </form>}
    </>}
    {message && <p role="status">{message}</p>}<Link className="view" href="/account">My account</Link>
  </div></main></>;
}
