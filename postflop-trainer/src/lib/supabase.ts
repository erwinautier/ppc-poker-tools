import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kbkxzvsgusakjgmnbbmx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3h6dnNndXNha2pnbW5iYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzI2ODgsImV4cCI6MjA5Njc0ODY4OH0.Wwp7pgRNQVi1bQ94Fogk_GwYbfNratRpus4pUjzkzAo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'ppc-auth' },
});

const LS_KEY = 'postflop_groq_key';

export async function loadGroqKey(): Promise<{ key: string; source: 'supabase' | 'local' } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { data } = await supabase
      .from('user_groq_keys')
      .select('groq_key')
      .eq('user_id', session.user.id)
      .single();
    if (data?.groq_key) return { key: data.groq_key, source: 'supabase' };
  }
  const local = localStorage.getItem(LS_KEY);
  if (local) return { key: local, source: 'local' };
  return null;
}

export async function saveGroqKey(key: string, toCloud: boolean): Promise<void> {
  if (toCloud) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('user_groq_keys').upsert({
        user_id: session.user.id,
        groq_key: key,
        updated_at: new Date().toISOString(),
      });
    }
  } else {
    localStorage.setItem(LS_KEY, key);
  }
}

export async function deleteGroqKeyFromCloud(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from('user_groq_keys').delete().eq('user_id', session.user.id);
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session?.user;
}
