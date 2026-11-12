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

/** Whether the entry reached the user's durable activity log in Supabase. */
export type PersistenceState = "pending" | "saved" | "failed";

export interface LogEntry {
  id: number;
  timestamp: number;
  label: string;
  data: unknown;
  persistence: PersistenceState;
  persistenceError?: string;
}

let entries: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function updateEntry(id: number, patch: Partial<LogEntry>) {
  entries = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  emit();
}

/** Appends a Borrow Kit call's raw response (or error) to the activity log panel. */
export function logEvent(label: string, data?: unknown) {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    label,
    data,
    persistence: "pending",
  };
  entries = [...entries, entry].slice(-50);
  emit();

  // Fire-and-forget persistence; RLS scopes this to the signed-in user. The
  // outcome is tracked per entry so a failed write shows up in the panel and
  // can be retried, instead of only reaching the browser console.
  void persistEntry(entry);
}

async function persistEntry(entry: LogEntry) {
  try {
    const { error } = await getSupabaseBrowserClient()
      .from("activity_log")
      .insert({ label: entry.label, data: entry.data });
    if (error) throw error;
    updateEntry(entry.id, { persistence: "saved", persistenceError: undefined });
  } catch (err) {
    console.error("[activityLog] persist failed", err);
    updateEntry(entry.id, {
      persistence: "failed",
      persistenceError: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Retries persisting a single entry whose write failed. */
export function retryPersistence(id: number) {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry || entry.persistence !== "failed") return;
  updateEntry(entry.id, { persistence: "pending", persistenceError: undefined });
  void persistEntry(entry);
}

/** Retries persisting every entry whose write failed. */
export function retryFailedEntries() {
  for (const entry of entries) {
    if (entry.persistence !== "failed") continue;
    updateEntry(entry.id, { persistence: "pending", persistenceError: undefined });
    void persistEntry(entry);
  }
}

/** Replaces the in-memory log with rows fetched from Supabase (newest-first input, stored oldest-first). */
export function hydrateFromRemote(
  rows: { id: number; label: string; data: unknown; created_at: string }[],
) {
  entries = [...rows]
    .reverse()
    .map((r) => ({
      id: r.id,
      timestamp: new Date(r.created_at).getTime(),
      label: r.label,
      data: r.data,
      persistence: "saved",
    }));
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
