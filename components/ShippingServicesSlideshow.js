"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ShippingRouteIllustration from "@/components/ShippingRouteIllustration";

const slides = [
  {
    kicker: "USA → PHILIPPINES",
    title: "Shop the USA.",
    accent: "Bring it home.",
    description: "Found something you love? Send the link for shopping and shipping assistance to the Philippines.",
    note: "Review item costs, fees, shipping and import charges before you decide.",
    quoteFirst: true,
  },
  {
    kicker: "YOUR NEXT US FIND",
    title: "US stores.",
    accent: "Great finds.",
    description: "Explore selected finds from Amazon, eBay, B&H Photo and more.",
    note: "See something you like? Request a quote for delivery to the Philippines.",
    quoteFirst: false,
  },
  {
    kicker: "KNOW THE COSTS FIRST",
    title: "Your wishlist.",
    accent: "Your way.",
    description: "Share the store link, item details and delivery destination. We’ll help you plan the next step.",
    note: "Requesting a quote does not place an order or collect a payment.",
    quoteFirst: true,
  },
];

export default function ShippingServicesSlideshow() {
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false), [inView, setInView] = useState(false), [tabVisible, setTabVisible] = useState(true);
  const region = useRef(null), touchStart = useRef(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!motion.matches);
    const changed = () => { if (motion.matches) setPlaying(false); };
    const visibility = () => setTabVisible(document.visibilityState === "visible");
    visibility();
    motion.addEventListener("change", changed);
    document.addEventListener("visibilitychange", visibility);
    return () => { motion.removeEventListener("change", changed); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.25), { threshold: 0.25 });
    observer.observe(region.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || hovered || !inView || !tabVisible) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % slides.length), 7000);
    return () => clearInterval(timer);
  }, [playing, hovered, inView, tabVisible]);

  function showSlide(next) {
    setPlaying(false);
    setIndex((next + slides.length) % slides.length);
  }

  return <section ref={region} className="usa-showcase usa-showcase-compact shipping-services-slideshow"
    role="region" aria-roledescription="carousel" aria-label="Shipping services"
    onFocusCapture={event => { if (!event.target.closest("[data-shipping-rotation]")) setPlaying(false); }}
    onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onPointerDown={event => {
      touchStart.current = event.pointerType === "touch" && !event.target.closest("a,button") ? { x: event.clientX, y: event.clientY } : null;
    }}
    onPointerCancel={() => { touchStart.current = null; }}
    onPointerUp={event => {
      const start = touchStart.current; touchStart.current = null;
      if (!start || event.pointerType !== "touch") return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) showSlide(index + (dx < 0 ? 1 : -1));
    }}>
    <div className="container shipping-campaign-panel">
    <div className="shipping-campaign-layout">
    <div className="shipping-slides-stage" aria-live={playing ? "off" : "polite"} aria-atomic="true">
      {slides.map((slide, slideIndex) => <div key={slide.title}
        className={`shipping-service-slide${index === slideIndex ? " is-active" : ""}`}
        role="group" aria-roledescription="slide" aria-label={`${slideIndex + 1} of ${slides.length}`}
        aria-hidden={index !== slideIndex} inert={index !== slideIndex}>
        <div className="usa-showcase-copy">
          <p className="usa-kicker"><span aria-hidden="true">🇺🇸</span> {slide.kicker} <span aria-hidden="true">🇵🇭</span></p>
          <h2>{slide.title} <span>{slide.accent}</span></h2>
          <p className="usa-intro">{slide.description}</p>
        </div>
        <div className="usa-home-actions">
          {slide.quoteFirst ? <>
            <Link className="usa-quote-button" href="/usa-shopping#usa-quote">Get a USA quote <span aria-hidden="true">→</span></Link>
            <Link className="usa-find-button" href="/usa-shopping#usa-finds">Explore USA items</Link>
          </> : <>
            <Link className="usa-quote-button" href="/usa-shopping#usa-finds">Explore USA items <span aria-hidden="true">→</span></Link>
            <Link className="usa-find-button" href="/usa-shopping#usa-quote">Get a USA quote</Link>
          </>}
        </div>
        <p className="usa-small">{slide.note}</p>
      </div>)}
    </div>
    <ShippingRouteIllustration />
    </div>
    <div className="shipping-campaign-footer">
    <ul className="shipping-service-perks" aria-label="Shopping assistance highlights">
      <li><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg> US store finds</li>
      <li><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg> Clear quotes</li>
      <li><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.4 5.6a5.4 5.4 0 0 0-7.6 0l-.8.8-.8-.8a5.4 5.4 0 0 0-7.6 7.6L12 21l8.4-7.8a5.4 5.4 0 0 0 0-7.6Z"/></svg> Your choice</li>
    </ul>
    <div className="shipping-slide-controls" role="group" aria-label="Shipping slideshow controls">
      <button type="button" className="shipping-slide-control" data-shipping-rotation
        aria-label={playing ? "Pause shipping slideshow" : "Play shipping slideshow"}
        title={playing ? "Pause slideshow" : "Play slideshow"} onClick={() => setPlaying(current => !current)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 3 15 9-15 9z" />}
        </svg>
      </button>
      <div className="shipping-slide-navigation">
        <button type="button" className="shipping-slide-control" aria-label="Previous shipping slide" onClick={() => showSlide(index - 1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        {slides.map((slide, slideIndex) => <button key={slide.title} type="button" className="shipping-slide-dot"
          aria-label={`Show shipping slide ${slideIndex + 1}: ${slide.title} ${slide.accent}`} aria-current={index === slideIndex ? "true" : undefined}
          onClick={() => showSlide(slideIndex)}><span aria-hidden="true" /></button>)}
        <button type="button" className="shipping-slide-control" aria-label="Next shipping slide" onClick={() => showSlide(index + 1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>
      </div>
    </div>
    </div>
    </div>
  </section>;
}
