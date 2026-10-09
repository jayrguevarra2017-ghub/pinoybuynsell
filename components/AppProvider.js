"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import MobileAppNav from "@/components/MobileAppNav";
import { appPlatform, installedDisplay } from "@/lib/app-install.mjs";

const AppContext = createContext(null);
export function useApp() { return useContext(AppContext); }

export default function AppProvider({ children }) {
  const [installed, setInstalled] = useState(false), [online, setOnline] = useState(true);
  const [platform, setPlatform] = useState("desktop"), [prompt, setPrompt] = useState(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const dialog = useRef(null), installLock = useRef(false);
  useEffect(() => {
    setInstalled(installedDisplay(window, navigator)); setPlatform(appPlatform(navigator)); setOnline(navigator.onLine);
    const installable = event => { event.preventDefault(); setPrompt(event); setMessage(""); };
    const completed = () => { setInstalled(true); setPrompt(null); setOpen(false); };
    const connection = () => setOnline(navigator.onLine);
    const mode = window.matchMedia("(display-mode: standalone)");
    const displayChanged = () => setInstalled(installedDisplay(window, navigator));
    window.addEventListener("beforeinstallprompt", installable);
    window.addEventListener("appinstalled", completed);
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    mode.addEventListener("change", displayChanged);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Browser installation guidance remains available if offline support could not start.
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", installable); window.removeEventListener("appinstalled", completed);
      window.removeEventListener("online", connection); window.removeEventListener("offline", connection);
      mode.removeEventListener("change", displayChanged);
    };
  }, []);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);

  async function install() {
    if (!prompt || installLock.current) return;
    installLock.current = true; setBusy(true); setMessage("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "Installation requested. Look for PinoyBuyNSell on your home screen." : "Installation cancelled. You can also install from your browser menu.");
    } catch { setMessage("Use your browser’s install option to add PinoyBuyNSell."); }
    finally { setPrompt(null); setBusy(false); installLock.current = false; }
  }

  return <AppContext.Provider value={{ installed, online, openInstall: () => setOpen(true) }}>
    {children}
    <MobileAppNav online={online} />
    <dialog ref={dialog} className="app-install-dialog" aria-labelledby="app-install-title" onCancel={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false);
      }}>
      <button type="button" className="app-dialog-close" aria-label="Close installation instructions" onClick={() => setOpen(false)}>×</button>
      <img className="app-install-logo" src="/branding/pinoybuynsell-facebook-profile.png" width="88" height="88" alt="PinoyBuyNSell" />
      <p className="eyebrow">YOUR MARKETPLACE, ONE TAP AWAY</p>
      <h2 id="app-install-title">Take PinoyBuyNSell with you.</h2>
      <p>Keep listings, auctions and your USA wishlist on your home screen.</p>
      {prompt && <button type="button" className="app-install-primary" onClick={install} disabled={busy}>{busy ? "Opening installation…" : "Install PinoyBuyNSell"}</button>}
      {platform === "ios" ? <ol>
        <li>Open <strong>pinoybuynsell.com</strong> in Safari.</li>
        <li>Tap <strong>Share</strong> (the square with an upward arrow).</li>
        <li>Choose <strong>Add to Home Screen</strong>. Enable <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.</li>
      </ol> : platform === "android" ? <ol>
        <li>Open <strong>pinoybuynsell.com</strong> in Chrome.</li>
        <li>Tap <strong>⋮</strong> → <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
        <li>Confirm, then open PinoyBuyNSell from your home screen.</li>
      </ol> : <p className="app-install-guide">In Chrome or Edge, use the install icon in the address bar or the browser menu. On your phone, open this website and select <strong>Install app</strong> for phone-specific instructions.</p>}
      <p className="app-install-note">Free to install. An internet connection is needed for current listings, bids, account verification, uploads and messages.</p>
      {message && <p role="status">{message}</p>}
    </dialog>
  </AppContext.Provider>;
}
