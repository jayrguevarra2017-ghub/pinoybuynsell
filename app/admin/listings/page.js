"use client";
import {useEffect,useState,useRef} from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ListingPhoto from "@/components/ListingPhoto";
import {supabase} from "@/lib/supabase";
import {withDeadline} from "@/lib/verification-actions";
export default function AdminListings(){
 const [items,setItems]=useState([]),[allowed,setAllowed]=useState(false),[message,setMessage]=useState('Checking administrator access...'),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null),[reason,setReason]=useState('');
 const lock=useRef(false);
 async function load(){try{const check=await withDeadline(supabase.rpc('is_marketplace_admin'));if(check.error||!check.data){setAllowed(false);setMessage('Administrator access required.');return;}setAllowed(true);const result=await withDeadline(supabase.from('products').select('*').order('created_at',{ascending:false}).limit(100));if(result.error)throw result.error;setItems(result.data||[]);setMessage('');}catch(error){setMessage(error.message||'Could not load listings.');}}
 useEffect(()=>{load()},[]);
 async function remove(){
  if(lock.current||!selected)return;lock.current=true;setBusy(true);setMessage('');
  try{const result=await withDeadline(supabase.rpc('admin_delete_listing',{p_listing_id:String(selected.id),p_reason:reason.trim()}));if(result.error)throw result.error;setItems(current=>current.map(item=>item.id===selected.id?{...item,deleted_at:result.data.deleted_at}:item));setSelected(null);setReason('');setMessage('Listing deleted from the marketplace. Auction and bid records were retained.');}
  catch(error){setMessage(error.code==='PGRST202'?'Install the admin listing deletion migration before using this action.':error.message||'Could not confirm deletion. Refresh the queue before retrying.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <><Header/><main className="page"><div className="container narrow"><h1>Manage listings</h1><p>Delete listings from the marketplace while keeping records for auction history and disputes. Showing the latest 100 listings.</p>{message&&<p role="status" aria-live="polite">{message}</p>}<button className="view" disabled={busy} onClick={load}>Refresh listings</button>
 {allowed&&items.length===0&&<p>No listings found.</p>}
 {selected&&<section className="listing-form" aria-label="Confirm listing deletion" style={{padding:20,border:'2px solid #c93632',marginTop:20}}>
 <h2>Delete “{selected.title}”?</h2><p>It will be hidden from buyers and cannot receive bids. Stored photos and auction/bid records will remain. There is no restore button.</p>
 <label>Reason for deletion<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <button className="sell" disabled={busy||!reason.trim()} onClick={remove}>{busy?'Deleting...':'Confirm delete listing'}</button><button className="view" disabled={busy} onClick={()=>{setSelected(null);setReason('')}}>Cancel</button></section>}
 {allowed&&items.map(item=><article key={item.id} className="listing-form" style={{padding:20,border:'1px solid #ddd',marginTop:20}}><ListingPhoto product={item} detail/><h2>{item.title}</h2><p>Listing {item.id} · ₱{Number(item.price).toLocaleString('en-PH')} · {item.deleted_at?'Deleted':item.status}</p><p>Seller: {item.seller_id}</p>{!item.deleted_at&&<><Link className="view" href={`/product/${item.id}`}>View listing</Link><button className="view" disabled={busy} onClick={()=>{setSelected(item);setReason('');setMessage('');window.scrollTo({top:0,behavior:'smooth'})}}>Delete listing</button></>}</article>)}
 </div></main></>;
}
