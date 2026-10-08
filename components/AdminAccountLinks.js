"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { checkAdminAccess } from "@/lib/admin-access";

export default function AdminAccountLinks() {
  const [userId, setUserId] = useState(null);
  const [approvedAdminId, setApprovedAdminId] = useState(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    setApprovedAdminId(null);
    if (userId) {
      checkAdminAccess(supabase).then(allowed => {
        if (active) setApprovedAdminId(allowed ? userId : null);
      });
    }
    return () => { active = false; };
  }, [userId]);

  if (!userId || approvedAdminId !== userId) return null;
  return <section className="account-admin-tools" aria-label="Administrator tools">
    <h2>Administrator tools</h2>
    <Link className="view" href="/admin/verifications">Administrator verification queue</Link>
    <Link className="view" href="/admin/support">Administrator support inbox</Link>
    <Link className="view" href="/admin/listings">Administrator listing management</Link>
    <Link className="view" href="/admin/facebook">Post your listings to Facebook</Link>
    <Link className="view" href="/admin/usa-requests">Administrator USA shopping requests</Link>
  </section>;
}
