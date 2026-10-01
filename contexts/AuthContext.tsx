/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { parseAuthError } from "@/lib/errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

interface AuthValue {
  user: User | undefined;
  status: AuthStatus;
  isBusy: boolean;
  error: string | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuthSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthSession must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | undefined>();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user);
      setStatus(data.session?.user ? "signed-in" : "signed-out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user);
      setStatus(session?.user ? "signed-in" : "signed-out");
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signUp({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(parseAuthError(err).title);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err) {
      setError(parseAuthError(err).title);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
    } catch (err) {
      setError(parseAuthError(err).title);
    } finally {
      setIsBusy(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, isBusy, error, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
