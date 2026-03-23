import { createContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { backendUnavailableReason, isBackendEnabled, supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBackendEnabled) {
      setLoading(false);
      return undefined;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata?: Record<string, string>,
  ) => {
    if (!isBackendEnabled) {
      return { error: `${backendUnavailableReason} Authentication is unavailable in this preview.` };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isBackendEnabled) {
      return { error: `${backendUnavailableReason} Authentication is unavailable in this preview.` };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isBackendEnabled) {
      setSession(null);
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isBackendEnabled) {
      return { error: `${backendUnavailableReason} Password reset is unavailable in this preview.` };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
    });
    if (!error) return { error: null };
    // Map cryptic Supabase errors to user-friendly messages
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return { error: 'Too many attempts. Please wait a few minutes and try again.' };
    if (msg.includes('not found') || msg.includes('no user'))
      return { error: 'If this email is registered, you\'ll receive a reset link shortly.' };
    if (msg.includes('sending') || msg.includes('smtp') || msg.includes('email'))
      return { error: 'We couldn\'t send the email right now. Please try again later or contact support@remide.xyz.' };
    return { error: 'Something went wrong. Please try again or contact support@remide.xyz.' };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!isBackendEnabled) {
      return { error: `${backendUnavailableReason} Password updates are unavailable in this preview.` };
    }

    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
