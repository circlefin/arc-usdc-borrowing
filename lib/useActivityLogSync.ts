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

import { useEffect } from "react";
import { useAuthSession } from "@/contexts/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hydrateFromRemote } from "@/lib/activityLog";

/** Hydrates the in-memory activity log from Supabase once a user is signed in. */
export function useActivityLogSync() {
  const { user, status } = useAuthSession();

  useEffect(() => {
    if (status !== "signed-in" || !user) return;
    let cancelled = false;

    getSupabaseBrowserClient()
      .from("activity_log")
      .select("id, label, data, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) hydrateFromRemote(data);
      });

    return () => {
      cancelled = true;
    };
  }, [status, user]);
}
