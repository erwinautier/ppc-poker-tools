/**
 * Syncs poker-trainer stats AND ranges to/from Supabase.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';

const LS_STATS_KEY  = 'ptrainer-re-stats-v1';
const LS_RANGES_KEY = 'range-editor-v1';   // shared with range-editor app
const DEBOUNCE_MS = 1500;

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useCloudSync(userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial load from Supabase ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      // No user logged in: clear ranges from localStorage to avoid showing
      // data left by a previous user on this browser.
      localStorage.removeItem(LS_RANGES_KEY);
      return;
    }
    (async () => {
      // Load stats
      const { data: statsData, error: statsErr } = await supabase
        .from('trainer_stats')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (!statsErr && statsData?.data) {
        localStorage.setItem(LS_STATS_KEY, JSON.stringify(statsData.data));
        window.dispatchEvent(new StorageEvent('storage', { key: LS_STATS_KEY }));
      }

      // Load ranges for this user (same table as range-editor)
      const { data: rangeData, error: rangeErr } = await supabase
        .from('range_collections')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (!rangeErr && rangeData?.data) {
        localStorage.setItem(LS_RANGES_KEY, JSON.stringify(rangeData.data));
        window.dispatchEvent(new StorageEvent('storage', { key: LS_RANGES_KEY }));
      } else if (!rangeErr && !rangeData) {
        // User has no ranges in cloud — clear any leftover from another user
        localStorage.removeItem(LS_RANGES_KEY);
      }

      setLoaded(true);
    })();
  }, [userId]);

  // ── Save to Supabase (called after every attempt) ─────────────────────────
  const scheduleSync = useCallback(() => {
    if (!userId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus('saving');
    debounceRef.current = setTimeout(async () => {
      const raw = localStorage.getItem(LS_STATS_KEY);
      if (!raw) { setStatus('idle'); return; }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { setStatus('error'); return; }

      const { error } = await supabase
        .from('trainer_stats')
        .upsert({ user_id: userId, data: parsed, updated_at: new Date().toISOString() },
                 { onConflict: 'user_id' });

      setStatus(error ? 'error' : 'saved');
      if (!error) setTimeout(() => setStatus('idle'), 2000);
    }, DEBOUNCE_MS);
  }, [userId]);

  return { scheduleSync, status, loaded };
}
