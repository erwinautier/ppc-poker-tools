/**
 * Syncs the range-editor state to/from Supabase.
 *
 * Strategy:
 *  - On mount (after auth): load from Supabase → write to localStorage
 *  - On every save trigger: upsert to Supabase (debounced 1.5s)
 *  - localStorage stays as the runtime cache (store.ts reads/writes it as before)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';

const LS_KEY = 'range-editor-v1';
const DEBOUNCE_MS = 1500;

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useCloudSync(userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial load from Supabase ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data, error } = await supabase
        .from('range_collections')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data?.data) {
        // Overwrite localStorage with cloud data
        localStorage.setItem(LS_KEY, JSON.stringify(data.data));
        // Dispatch storage event so store.ts reacts
        window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
      }
      setLoaded(true);
    })();
  }, [userId]);

  // ── Save to Supabase (called by the store after every mutation) ───────────
  const scheduleSync = useCallback(() => {
    if (!userId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus('saving');
    debounceRef.current = setTimeout(async () => {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { setStatus('idle'); return; }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { setStatus('error'); return; }

      const { error } = await supabase
        .from('range_collections')
        .upsert({ user_id: userId, data: parsed, updated_at: new Date().toISOString() },
                 { onConflict: 'user_id' });

      setStatus(error ? 'error' : 'saved');
      if (!error) setTimeout(() => setStatus('idle'), 2000);
    }, DEBOUNCE_MS);
  }, [userId]);

  return { scheduleSync, status, loaded };
}
