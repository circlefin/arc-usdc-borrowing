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

import { useSyncExternalStore } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface LogEntry {
  id: number;
  timestamp: number;
  label: string;
  data: unknown;
}

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Appends a Borrow Kit call's raw response (or error) to the activity log panel. */
export function logEvent(label: string, data?: unknown) {
  entries = [...entries, { id: nextId++, timestamp: Date.now(), label, data }].slice(-50);
  emit();

  // Fire-and-forget persistence; RLS scopes this to the signed-in user.
  void getSupabaseBrowserClient()
    .from("activity_log")
    .insert({ label, data })
    .then(({ error }) => {
      if (error) console.error("[activityLog] persist failed", error);
    });
}

/** Replaces the in-memory log with rows fetched from Supabase (newest-first input, stored oldest-first). */
export function hydrateFromRemote(
  rows: { id: number; label: string; data: unknown; created_at: string }[],
) {
  entries = [...rows]
    .reverse()
    .map((r) => ({ id: r.id, timestamp: new Date(r.created_at).getTime(), label: r.label, data: r.data }));
  nextId = rows.reduce((max, r) => Math.max(max, r.id + 1), nextId);
  emit();
}

export function clearLog() {
  entries = [];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return entries;
}

export function useActivityLog() {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}
