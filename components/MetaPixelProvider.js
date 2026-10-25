"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { createMetaPixel, metaConsentKey, metaPageKind, metaPurchaseData, readMetaConsent } from "@/lib/meta-pixel.mjs";

const Context = createContext(null);
export default function MetaPixelProvider({ pixelId, activatedAt, children }) {
  const app = useApp(), pathname = usePathname();
  const [choice, setChoice] = useState(null), [loaded, setLoaded] = useState(false), [open, setOpen] = useState(false), [sdkRevision, setSDKRevision] = useState(0);
  const driver = useRef(null), settings = useRef(null), alive = useRef(false);
  const eligible = Boolean(pixelId && loaded && app?.authReady && app.adminReady && !app.isAdmin);
  settings.current = { enabled: eligible && choice?.choice === "allow" && !(typeof navigator !== "undefined" && navigator.globalPrivacyControl === true) };
  useEffect(() => {
    alive.current = true;
    let saved;
    try { saved = readMetaConsent(window.localStorage); } catch {}
    setChoice(saved || null); setLoaded(true);
    const changed = event => {
      if (event.key === metaConsentKey) { try { setChoice(readMetaConsent(window.localStorage)); } catch { setChoice(null); } }
    };
    window.addEventListener("storage", changed);
    return () => { alive.current = false; window.removeEventListener("storage", changed); driver.current?.revoke(); };
  }, []);
  useEffect(() => {
    if (!pixelId) return;
    if (!driver.current) driver.current = createMetaPixel({ pixelId, browser: window, document,
      enabled: () => settings.current?.enabled === true, onReady: () => { if (alive.current) setSDKRevision(value => value + 1); } });
    driver.current.sync();
  }, [pixelId, pathname, eligible, choice, sdkRevision]);
  function choose(value) {
    const saved = { choice: value, since: Date.now() };
    if (value === "deny") { settings.current.enabled = false; driver.current?.revoke(); }
    try { window.localStorage.setItem(metaConsentKey, JSON.stringify(saved)); } catch {}
    setChoice(saved); setOpen(false);
  }
  const item = useCallback((product, usa) => { if (settings.current?.enabled) driver.current?.item(product, usa); }, [eligible, choice, pathname, sdkRevision]);
  const purchase = useCallback(order => {
    if (!settings.current?.enabled) return;
    const event = metaPurchaseData(order, { userId: app?.user?.id, consentSince: choice?.since, activatedAt });
    if (event) driver.current?.purchase(event);
  }, [eligible, choice, pathname, sdkRevision, app?.user?.id, activatedAt]);
  const value = useMemo(() => ({ item, purchase }), [item, purchase]);
  const publicPage = typeof window !== "undefined" && metaPageKind(window.location.href) === "public";
  const show = eligible && (open || (publicPage && !choice));
  return <Context.Provider value={value}>{children}
    {pixelId && <div className="ad-privacy-footer"><Link href="/privacy">Privacy &amp; cookies</Link>{eligible && <button type="button" onClick={() => setOpen(true)}>Advertising preferences</button>}</div>}
    {show && <aside className="ad-consent" aria-labelledby="ad-consent-title">
      <div><strong id="ad-consent-title">Your advertising preferences</strong><p>Allow Meta advertising cookies to measure visits and confirmed purchases and help improve our Facebook ads. <Link href="/privacy">Learn more</Link></p></div>
      <div className="ad-consent-actions"><button type="button" onClick={() => choose("deny")}>Only necessary</button><button type="button" className="ad-consent-allow" disabled={typeof navigator !== "undefined" && navigator.globalPrivacyControl === true} onClick={() => choose("allow")}>Allow advertising</button></div>
      {typeof navigator !== "undefined" && navigator.globalPrivacyControl === true && <p>Your browser’s Global Privacy Control keeps advertising tracking off.</p>}
    </aside>}
  </Context.Provider>;
}

export function MetaItemEvent({ product, usa = false }) {
  const tracker = useContext(Context), track = tracker?.item;
  useEffect(() => { track?.(product, usa); }, [track, product, usa]);
  return null;
}

export function MetaPurchaseEvent({ order }) {
  const tracker = useContext(Context), track = tracker?.purchase;
  useEffect(() => { track?.(order); }, [track, order]);
  return null;
}
