"use client";
import {useEffect,useState,useRef} from "react";
import Link from "next/link";
import Header from "@/components/Header";
import {supabase} from "@/lib/supabase";
import {validateUSARequest} from "@/lib/usa-shopping";

const initial={contact_name:'',contact_email:'',contact_phone:'',destination:'',item_name:'',item_url:'',quantity:'1',item_details:''};
export default function USAShopping(){
 const [form,setForm]=useState(initial),[user,setUser]=useState(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reference,setReference]=useState(null);
 const lock=useRef(false);
 useEffect(()=>{let active=true;supabase.auth.getUser().then(({data})=>{if(!active)return;setUser(data.user);if(data.user)setForm(current=>({...current,contact_email:data.user.email || ''}));setReady(true);}).catch(()=>{if(active){setReady(true);setMessage('Could not check sign-in. Refresh and try again.');}});return()=>{active=false};},[]);
 function change(e){setForm({...form,[e.target.name]:e.target.value});}
 async function submit(e){
  e.preventDefault();if(lock.current)return;
  const error=validateUSARequest(form);if(error){setMessage(error);return;}
  lock.current=true;setBusy(true);setMessage('');
  try{
   const result=await supabase.rpc('submit_usa_shopping_request',{p_contact_name:form.contact_name.trim(),p_contact_email:form.contact_email.trim(),p_contact_phone:form.contact_phone.trim(),p_destination:form.destination.trim(),p_item_name:form.item_name.trim(),p_item_url:form.item_url.trim(),p_quantity:Number(form.quantity),p_item_details:form.item_details.trim()});
   if(result.error)throw result.error;setReference(result.data);setMessage('Your request has been saved. Our team will contact you using the details you provided to discuss availability and a quote.');
  }catch(error){setMessage(error.code==='PGRST202'?'The request service is not available yet. Please try again later.':error.message || 'Could not confirm your request. Check with the team before submitting again.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <><Header/><main className="page"><div className="container narrow">
 <p className="eyebrow">USA SHOPPING ASSISTANCE</p><h1>Found it in the USA? Let us bring it to you.</h1>
 <p className="lead">Tell us what you want from a US store. We can help purchase it and arrange delivery to the Philippines.</p>
 <div className="usa-steps"><p><strong>1. Share the item</strong><br/>Send its link, quantity, and specifications.</p><p><strong>2. Get a quote</strong><br/>We confirm availability, purchase cost, service fee, shipping, and applicable import charges.</p><p><strong>3. Confirm your order</strong><br/>Agree on the quote and delivery arrangements before a purchase is made.</p></div>
 <p>This is a quote request, not a purchase or payment. Availability, shipping costs, and delivery times are confirmed individually. Marketplace ID approval is required before proceeding with a purchase.</p>
 {!ready?<p>Checking sign-in...</p>:!user?<><p>Sign in to send a request securely.</p><Link className="view" href="/login">Sign in or create an account</Link></>:reference?<section><h2>Request received</h2><p>Reference: <strong>{reference}</strong></p><Link className="view" href="/account">My account</Link></section>:<form className="listing-form" onSubmit={submit}>
 <h2>Request a USA shopping quote</h2>
 <label>Contact name<input name="contact_name" required maxLength={150} value={form.contact_name} onChange={change} autoComplete="name"/></label>
 <label>Contact email<input name="contact_email" type="email" required maxLength={254} value={form.contact_email} onChange={change} autoComplete="email"/></label>
 <label>Phone number<input name="contact_phone" type="tel" required maxLength={40} value={form.contact_phone} onChange={change} autoComplete="tel"/></label>
 <label>Delivery city / province<input name="destination" required maxLength={200} value={form.destination} onChange={change} placeholder="Example: Dasmariñas, Cavite"/></label>
 <label>Item name<input name="item_name" required maxLength={200} value={form.item_name} onChange={change}/></label>
 <label>Item link<input name="item_url" type="url" required maxLength={2000} value={form.item_url} onChange={change} placeholder="https://www.store.com/item"/></label>
 <label>Quantity<input name="quantity" type="number" required min="1" max="100" step="1" value={form.quantity} onChange={change}/></label>
 <label>Item details<textarea name="item_details" required maxLength={3000} rows={5} value={form.item_details} onChange={change} placeholder="Size, color, model, variant, and other requirements"/></label>
 <label><input type="checkbox" required/> I agree that the team may contact me about this request.</label>
 <button className="sell" disabled={busy}>{busy?'Sending request...':'Request a quote'}</button>
 </form>}
 {message && <p role="status" aria-live="polite">{message}</p>}
 </div></main></>;
}
