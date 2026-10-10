"use client";
import {useEffect,useState} from "react";
import Header from "@/components/Header";
import {useApp} from "@/components/AppProvider";
import {supabase} from "@/lib/supabase";
export default function USARequests(){
 const app=useApp();
 const [items,setItems]=useState([]),[allowed,setAllowed]=useState(false),[message,setMessage]=useState('Checking administrator access...'),[busy,setBusy]=useState(false);
 async function load(){try{const check=await supabase.rpc('is_marketplace_admin');if(check.error || !check.data){setMessage('Administrator access required.');return;}setAllowed(true);const result=await supabase.from('usa_shopping_requests').select('*').order('created_at',{ascending:false}).limit(100);if(result.error)throw result.error;setItems(result.data || []);setMessage('');}catch{setMessage('Could not load requests. Check that the USA shopping migration is installed.');}}
 useEffect(()=>{load()},[]);
 async function status(item,value){setBusy(true);try{const result=await supabase.from('usa_shopping_requests').update({status:value}).eq('id',item.id).select('id').single();if(result.error)throw result.error;void app?.refreshAdminAttention();await load();}catch{setMessage('Could not update request status.');}finally{setBusy(false)}}
 function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
 return <><Header/><main className="page"><div className="container narrow"><h1>USA shopping requests</h1><p>Review inquiries and contact customers to arrange a quote. Only proceed with a purchase after account verification and explicit customer confirmation.</p>{message && <p role="status">{message}</p>}<button className="view" onClick={load} disabled={busy}>Refresh requests</button>{allowed&&items.length===0&&<p>No requests yet.</p>}{allowed&&items.map(item=><article key={item.id} className="listing-form" style={{padding:20,border:'1px solid #ddd',marginTop:20}}>
 <h2>{item.item_name}</h2><p>Reference: {item.id}</p><p>{new Date(item.created_at).toLocaleString()} · {item.status}</p><p>Contact: {item.contact_name}<br/>{item.contact_email}<br/>{item.contact_phone}</p><p>Destination: {item.destination} · Quantity: {item.quantity}</p><p style={{whiteSpace:'pre-wrap'}}>{item.item_details}</p>{safeLink(item.item_url)&&<a className="view" href={safeLink(item.item_url)} target="_blank" rel="noopener noreferrer">Open requested item link</a>}
 <label>Request status<select value={item.status} disabled={busy} onChange={e=>status(item,e.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></label></article>)}</div></main></>;
}
