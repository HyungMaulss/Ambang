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
