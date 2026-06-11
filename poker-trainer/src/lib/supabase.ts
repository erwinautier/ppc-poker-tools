import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kbkxzvsgusakjgmnbbmx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtia3h6dnNndXNha2pnbW5iYm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzI2ODgsImV4cCI6MjA5Njc0ODY4OH0.Wwp7pgRNQVi1bQ94Fogk_GwYbfNratRpus4pUjzkzAo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'ppc-auth' },
});

export type Profile = {
  id: string;
  username: string;
  created_at: string;
};
