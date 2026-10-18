"use client";
import {useCallback,useEffect,useState,useRef} from "react";
import Link from "next/link";
import USAShoppingHero from "@/components/USAShoppingHero";
import Header from "@/components/Header";
import {supabase} from "@/lib/supabase";
import {submitUSARequest,validateUSARequest} from "@/lib/usa-shopping";
import {useApp} from "@/components/AppProvider";
import USAItemCatalog from "@/components/USAItemCatalog";
import {usaQuoteSelection, usaItemId} from "@/lib/usa-items.mjs";

const initial={contact_name:'',contact_email:'',contact_phone:'',destination:'',item_name:'',item_url:'',quantity:'1',item_details:''};
export default function USAShopping({initialItems=null}){
 const app=useApp();
 return <USAShoppingSession key={app?.user?.id || 'guest'} user={app?.user} ready={app?.authReady} initialItems={initialItems}/>;
}
function USAShoppingSession({user,ready,initialItems}){
 const [form,setForm]=useState(()=>({...initial,contact_email:user?.email || ''})),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reference,setReference]=useState(null);
 const lock=useRef(false);
 const life=useRef(null);
 useEffect(()=>{const controller=new AbortController();life.current=controller;return()=>controller.abort();},[]);
 const [selectedItem,setSelectedItem]=useState(null);
 const chooseItem=useCallback(item=>{
  const values=usaQuoteSelection(item);if(!values || lock.current)return;
  setForm(current=>({...current,...values}));setSelectedItem(item.id);setReference(null);setMessage('');
  const url=new URL(window.location.href);url.searchParams.set('item',item.id);url.hash='usa-quote';window.history.replaceState(window.history.state,'',url);
  document.getElementById('usa-quote')?.scrollIntoView({behavior:'smooth',block:'start'});
 },[]);
 function change(e){setForm({...form,[e.target.name]:e.target.value});}
 async function submit(e){
  e.preventDefault();if(lock.current || !ready || !user || life.current?.signal.aborted)return;
  const error=validateUSARequest(form);if(error){setMessage(error);return;}
  lock.current=true;setBusy(true);setMessage('');
  try{
   const saved=await submitUSARequest(supabase,form,{signal:life.current.signal});
   if(life.current.signal.aborted)return;
   setReference(saved);setMessage('Your request has been saved. Our team will contact you using the details you provided to discuss availability and a quote.');
  }catch(error){if(!life.current.signal.aborted)setMessage(error.message || 'Could not confirm your request. Check with the team before submitting again.');}
  finally{lock.current=false;if(!life.current.signal.aborted)setBusy(false);}
 }
 return <><Header/><main className="usa-shopping-page">
 <USAShoppingHero />
 <USAItemCatalog onChoose={chooseItem} initialItems={initialItems}/>
 <section className="container usa-how-section">
 <p className="eyebrow">HOW IT WORKS</p><h2>Three steps to your next US find.</h2>
 <div className="usa-process-cards">
 <article><span>01</span><h3>Show us your find</h3><p>Paste the store link and tell us your preferred size, color, model, and quantity.</p></article>
 <article><span>02</span><h3>Let’s work out the details</h3><p>We discuss availability, item cost, service fee, shipping, and applicable import charges.</p></article>
 <article><span>03</span><h3>You decide what’s next</h3><p>Review the quote and agree on the delivery arrangements before any purchase is made.</p></article>
 </div></section>
 <section className="container usa-quote-layout" id="usa-quote">
 <aside className="usa-quote-aside"><p className="eyebrow">LET’S START YOUR WISHLIST</p><h2>What would you love to bring home?</h2><p>Send us the details and our team can help plan the purchase and delivery.</p>
 <ul><li>A full item link from a US store</li><li>Your exact size, color, or model</li><li>Quantity and delivery city/province</li></ul>
 <div className="usa-before-order"><strong>You’re requesting a quote.</strong><p>No payment is collected here. Availability and delivery times are confirmed individually. ID approval is required before proceeding with a purchase.</p></div>
 </aside><div className="usa-quote-panel">
 {!ready?<p>Checking sign-in...</p>:!user?<><p>Sign in to send a request securely.</p><Link className="view" href={`/login?next=${encodeURIComponent(`/usa-shopping${usaItemId(selectedItem)?`?item=${selectedItem}`:''}#usa-quote`)}`}>Sign in or create an account</Link></>:reference?<section><h2>Request received</h2><p>Reference: <strong>{reference}</strong></p><Link className="view" href="/account">My account</Link></section>:<form className="listing-form" onSubmit={submit}>
 <h2>Your next find starts here</h2>
 <p>Tell us about the item and the best way to reach you.</p>
 <fieldset disabled={busy} className="usa-quote-fields" aria-label="Item and contact details">
 <label>Contact name<input name="contact_name" required maxLength={150} value={form.contact_name} onChange={change} autoComplete="name"/></label>
 <label>Contact email<input name="contact_email" type="email" required maxLength={254} value={form.contact_email} onChange={change} autoComplete="email"/></label>
 <label>Phone number<input name="contact_phone" type="tel" required maxLength={40} value={form.contact_phone} onChange={change} autoComplete="tel"/></label>
 <label>Delivery city / province<input name="destination" required maxLength={200} value={form.destination} onChange={change} placeholder="Example: Dasmariñas, Cavite"/></label>
 <label>Item name<input name="item_name" required maxLength={200} value={form.item_name} onChange={change}/></label>
 <label>Item link<input name="item_url" type="url" required maxLength={2000} value={form.item_url} onChange={change} placeholder="https://www.store.com/item"/></label>
 <label>Quantity<input name="quantity" type="number" required min="1" max="100" step="1" value={form.quantity} onChange={change}/></label>
 <label>Item details<textarea name="item_details" required maxLength={3000} rows={5} value={form.item_details} onChange={change} placeholder="Size, color, model, variant, and other requirements"/></label>
 <p>Please check our <Link href="/prohibited-items">prohibited-items policy</Link> before requesting an item.</p>
 <label><input type="checkbox" required/> I agree that the team may contact me about this request.</label>
 <button className="sell" disabled={busy}>{busy?'Sending request...':'Send my wishlist'}</button>
 </fieldset>
 </form>}
 {message && <p role="status" aria-live="polite">{message}</p>}
 </div></section>
 <section className="container usa-faq"><h2>USA to Philippines shopping and shipping questions</h2>
 <details><summary>Does submitting a request place an order?</summary><p>No. We discuss the quote with you first. A request does not authorize a purchase.</p></details>
 <details><summary>How much does shipping from USA to Philippines cost?</summary><p>The item cost, service fee, shipping and applicable import charges are quoted for your requested item and delivery arrangements. Review the full quote before agreeing to a purchase.</p></details>
 <details><summary>How long does delivery take?</summary><p>The team confirms expected timing when preparing your quote. Item availability, the US store and delivery arrangements affect timing.</p></details>
 <details><summary>Can I request trading cards and TCG items?</summary><p>Share the exact US store link and any edition, size or model details. Our team checks availability and whether the item can be purchased and shipped. You can also <Link href="/collectibles">browse trading cards and collectibles already listed on PinoyBuyNSell</Link>.</p></details>
 <details><summary>Can I request any item?</summary><p>Share your link and our team will check availability and whether the item can be purchased and shipped. Some items may be unavailable or restricted.</p></details></section>
 </main></>;
}
