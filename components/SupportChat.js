"use client";
import {useEffect,useRef,useState} from "react";
import SupportGuide from "@/components/SupportGuide";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {withDeadline} from "@/lib/verification-actions";
export default function SupportChat(){
 const [open,setOpen]=useState(false),[user,setUser]=useState(null),[ready,setReady]=useState(false),[ticket,setTicket]=useState(null),[messages,setMessages]=useState([]),[name,setName]=useState(''),[email,setEmail]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [mode,setMode]=useState("guide");
 const launcher=useRef(null),closeButton=useRef(null),lock=useRef(false),newConversation=useRef(false);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((_event,session)=>{newConversation.current=false;setUser(session?.user||null);setEmail(session?.user?.email||'');setTicket(null);setMessages([]);setReady(true)});return()=>data.subscription.unsubscribe()},[]);
 function close(){setOpen(false);launcher.current?.focus()}
 useEffect(()=>{if(!open)return;closeButton.current?.focus();function escape(e){if(e.key==='Escape')close()}window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[open]);
 useEffect(()=>{
  if(!open||!user||mode!=="human")return;let active=true,running=false;
  async function refresh(){if(running)return;running=true;setLoading(true);
   try{const result=await withDeadline(supabase.from('support_tickets').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle());if(result.error)throw result.error;
    if(!active)return;if(newConversation.current && result.data?.status==='closed'){setTicket(null);setMessages([]);return;}setTicket(result.data);if(result.data){const thread=await withDeadline(supabase.from('support_messages').select('id,sender_role,body,created_at').eq('ticket_id',result.data.id).order('id',{ascending:false}).limit(100));if(thread.error)throw thread.error;if(active)setMessages((thread.data||[]).reverse())}
   }catch{if(active)setError('Support is unavailable right now. Please try again later.')}finally{running=false;if(active)setLoading(false)}
  }
  refresh();const timer=setInterval(refresh,10000);return()=>{active=false;clearInterval(timer)};
 },[open,user,mode]);
 async function send(e){e.preventDefault();if(lock.current)return;if(!body.trim()){setError('Enter your message.');return}lock.current=true;setBusy(true);setError('');
  try{if(ticket){const result=await withDeadline(supabase.rpc('send_support_message',{p_ticket_id:ticket.id,p_body:body.trim()}));if(result.error)throw result.error;const thread=await withDeadline(supabase.from('support_messages').select('id,sender_role,body,created_at').eq('ticket_id',ticket.id).order('id',{ascending:false}).limit(100));if(thread.error)throw thread.error;setMessages((thread.data||[]).reverse())}
   else{const result=await withDeadline(supabase.rpc('start_support_chat',{p_name:name.trim(),p_email:email.trim(),p_body:body.trim()}));if(result.error)throw result.error;newConversation.current=false;setTicket({id:result.data,status:'open'});setMessages([{id:'initial',sender_role:'customer',body:body.trim(),created_at:new Date().toISOString()}])}setBody('');
  }catch(err){setError(err.code==='PGRST202'?'Support is not available yet. Please try again later.':err.message||'Could not confirm your message. Refresh before retrying.')}finally{lock.current=false;setBusy(false)}
 }
 return <div className="support-widget">{open&&<section className="support-panel" role="dialog" aria-modal="false" aria-labelledby="support-title">
 <div className="support-heading"><div><h2 id="support-title">PinoyBuyNSell support</h2><p>{mode==="guide"?"Instant help getting started":"Leave a message. We’ll reply here."}</p></div><button ref={closeButton} type="button" onClick={close} aria-label="Close support chat">×</button></div>
 <div className="support-content">
 <div className="support-mode-tabs" role="group" aria-label="Support options"><button type="button" aria-pressed={mode==="guide"} onClick={()=>setMode("guide")}>Website guide</button><button type="button" aria-pressed={mode==="human"} onClick={()=>setMode("human")}>Support team</button></div>
 {mode==="guide"?<SupportGuide onHuman={question=>{setBody(question);setError("");setMode("human")}}/>:<><p className="support-notice">Replies may take time. Please don’t send passwords, payment card details, or ID photos here.</p>
 {!ready?<p>Checking sign-in...</p>:!user?<><p>Sign in to keep your conversation private.</p><Link className="view" href="/login">Sign in to contact support</Link></>:<>
 <div className="support-thread" role="log" aria-label="Support messages" aria-live="polite">{messages.length===0&&!loading&&<p>How can we help with your account, listings, bids, or USA shopping request?</p>}{messages.map(m=><div key={m.id} className={`support-message support-${m.sender_role}`}><strong>{m.sender_role==='support'?'Support':'You'}</strong><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString()}</small></div>)}</div>
 {ticket?.status==='closed'?<p>This conversation is closed. <button type="button" className="view" onClick={()=>{newConversation.current=true;setTicket(null);setMessages([])}}>Start a new conversation</button></p>:<form className="listing-form" onSubmit={send}>
 {!ticket&&<><label>Your name<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label><label>Contact email<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label></>}
 <label>Message<textarea required maxLength={2000} rows={3} value={body} onChange={e=>setBody(e.target.value)}/></label><button className="sell" disabled={busy||loading}>{busy?'Sending...':'Send message'}</button></form>}</>}
 {error&&<p role="status">{error}</p>}</>}</div></section>}
 <button ref={launcher} type="button" className="support-launcher" aria-expanded={open} aria-controls="support-title" onClick={()=>open?close():setOpen(true)}><span aria-hidden="true">💬</span> {open?'Close support':'Need help?'}</button></div>;
}
