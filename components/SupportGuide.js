"use client";
import {useState} from "react";
import Link from "next/link";
import {answerGuide,guideTopics} from "@/lib/support-guide";
export default function SupportGuide({onHuman}){
 const [question,setQuestion]=useState(''),[history,setHistory]=useState([]);
 function topic(topic,label){setHistory(current=>[...current.slice(-9),{question:label,answer:topic}]);}
 function ask(e){e.preventDefault();if(!question.trim())return;topic(answerGuide(question),question.trim());setQuestion('');}
 return <div className="support-guide"><div className="support-message support-support"><strong>Automated website guide</strong><p>Hi! I can help you get started with PinoyBuyNSell. Choose a topic or ask a question. For account-specific help, switch to our support team.</p></div>
 <div className="guide-topics">{guideTopics.map(t=><button key={t.id} type="button" onClick={()=>topic(t,t.label)}>{t.label}</button>)}</div>
 <div role="log" aria-live="polite" aria-label="Guide conversation">{history.map((entry,index)=><div key={index}><div className="support-message"><strong>You</strong><p>{entry.question}</p></div><div className="support-message support-support"><strong>Website guide</strong><p>{entry.answer.text}</p>{entry.answer.links.map(([label,url])=><Link className="view" key={url} href={url}>{label}</Link>)}</div></div>)}</div>
 <form className="listing-form" onSubmit={ask}><label>Ask the website guide<input maxLength={300} required value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Example: How do I place a bid?"/></label><button className="sell" type="submit">Ask guide</button></form>
 <p className="support-notice">Guide questions stay in this browser session and are not sent to an AI service. Don’t enter private information.</p>
 <button className="view" type="button" onClick={()=>onHuman(history.at(-1)?.question || '')}>Message the support team</button>
 </div>;
}
