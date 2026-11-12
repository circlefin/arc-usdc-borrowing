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

import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ from: () => ({ insert }) }),
}));

type ActivityLogModule = typeof import("@/lib/activityLog");

async function loadModule(): Promise<ActivityLogModule> {
  vi.resetModules();
  return import("@/lib/activityLog");
}

beforeEach(() => {
  insert.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("activity log persistence", () => {
  it("marks an entry as saved when the insert succeeds", async () => {
    insert.mockResolvedValue({ data: null, error: null });
    const log = await loadModule();
    const { result } = renderHook(() => log.useActivityLog());

    act(() => log.logEvent("Borrow", { amount: 1 }));

    await waitFor(() => expect(result.current[0]?.persistence).toBe("saved"));
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("marks an entry as failed when the insert returns an error", async () => {
    insert.mockResolvedValue({ data: null, error: new Error("permission denied") });
    const log = await loadModule();
    const { result } = renderHook(() => log.useActivityLog());

    act(() => log.logEvent("Borrow", { amount: 1 }));

    await waitFor(() => expect(result.current[0]?.persistence).toBe("failed"));
    expect(result.current[0]?.persistenceError).toContain("permission denied");
    expect(console.error).toHaveBeenCalled();
  });

  // A rejected insert is a network-level failure: the old fire-and-forget
  // chain had no catch, so the write failed silently and the entry was lost
  // on the next page load with nothing but an unhandled rejection.
  it("marks an entry as failed when the insert rejects", async () => {
    insert.mockRejectedValue(new Error("network down"));
    const log = await loadModule();
    const { result } = renderHook(() => log.useActivityLog());

    act(() => log.logEvent("Borrow", { amount: 1 }));

    await waitFor(() => expect(result.current[0]?.persistence).toBe("failed"));
    expect(result.current[0]?.persistenceError).toContain("network down");
  });

  it("keeps a failed entry in the log so it can be retried", async () => {
    insert.mockRejectedValue(new Error("network down"));
    const log = await loadModule();
    const { result } = renderHook(() => log.useActivityLog());

    act(() => log.logEvent("Borrow", { amount: 1 }));
    await waitFor(() => expect(result.current[0]?.persistence).toBe("failed"));

    insert.mockResolvedValue({ data: null, error: null });
    act(() => log.retryPersistence(result.current[0].id));

    await waitFor(() => expect(result.current[0]?.persistence).toBe("saved"));
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("retries every failed entry at once", async () => {
    insert.mockRejectedValue(new Error("network down"));
    const log = await loadModule();
    const { result } = renderHook(() => log.useActivityLog());

    act(() => {
      log.logEvent("Borrow", { amount: 1 });
      log.logEvent("Repay", { amount: 2 });
    });
    await waitFor(() => expect(result.current.every((e) => e.persistence === "failed")).toBe(true));

    insert.mockResolvedValue({ data: null, error: null });
    act(() => log.retryFailedEntries());

    await waitFor(() => expect(result.current.every((e) => e.persistence === "saved")).toBe(true));
    expect(insert).toHaveBeenCalledTimes(4);
  });

  it("marks rows hydrated from the remote log as saved", async () => {
    const log = await loadModule();
    const { result } = renderHook(() => log.useActivityLog());

    act(() =>
      log.hydrateFromRemote([
        { id: 2, label: "Repay", data: { amount: 2 }, created_at: "2026-01-01T00:00:01Z" },
        { id: 1, label: "Borrow", data: { amount: 1 }, created_at: "2026-01-01T00:00:00Z" },
      ]),
    );

    expect(result.current.map((entry) => entry.persistence)).toEqual(["saved", "saved"]);
    expect(result.current.map((entry) => entry.label)).toEqual(["Borrow", "Repay"]);
    expect(insert).not.toHaveBeenCalled();
  });
});
