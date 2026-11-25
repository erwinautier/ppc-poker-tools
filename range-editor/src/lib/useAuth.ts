import { useEffect, useState, useCallback } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, type Profile } from './supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  /** Compte créé mais pas encore validé par le club, ou refusé (voir Le Club). */
  | { status: 'pending' }
  | { status: 'refused' }
  | { status: 'authenticated'; user: User; session: Session; profile: Profile };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const loadProfile = useCallback(async (user: User, session: Session) => {
    const [{ data }, { data: club }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      // Fonction absente ou injoignable : on laisse entrer, la base refuse elle-même d'enregistrer.
      supabase.rpc('club_account_status'),
    ]);
    if (data && (club === 'pending' || club === 'refused')) {
      setState({ status: club });
    } else if (data) {
      setState({ status: 'authenticated', user, session, profile: data as Profile });
    } else {
      setState({ status: 'unauthenticated' });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user, session);
      else setState({ status: 'unauthenticated' });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user, session);
      else setState({ status: 'unauthenticated' });
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    return error;
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthError | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/editor/`,
    });
    return error;
  }, []);

  return { state, signUp, signIn, signOut, resetPassword };
}
