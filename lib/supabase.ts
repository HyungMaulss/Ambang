"use client";

import { createClient, type User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null = mode demo (tanpa Supabase): soal contoh lokal, riwayat di localStorage. */
export const supabase = url && anon ? createClient(url, anon) : null;

/** undefined = masih memuat, null = belum login. */
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

/** Peran dari tabel profiles: "superadmin" | "admin" | "user"; null bila belum login/memuat. */
export function useRole(user: User | null | undefined) {
  const [role, setRole] = useState<string | null>(null);
  const id = user?.id;
  useEffect(() => {
    if (!supabase || !id) return setRole(null);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single()
      .then(({ data }) => setRole(data?.role ?? "user"));
  }, [id]);
  return role;
}

/** fetch ke route server dengan token sesi Supabase. */
export async function authedFetch(input: string, init: RequestInit = {}) {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const res = await fetch(input, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Gagal (${res.status})`);
  return body;
}
