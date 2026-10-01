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

// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_SESSIONS_PER_USER,
  SESSION_TTL_MS,
  createSession,
  findSessionByToken,
  getSession,
  latestSessionForUser,
  requireLiveSession,
  sessions,
} from "@/lib/session";

beforeEach(() => sessions.clear());

const T0 = 1_000_000;

describe("sessions", () => {
  it("are bound to their user", () => {
    const id = createSession("alice", "tok", "key", T0);
    expect(getSession(id, "alice", T0)).toMatchObject({ userId: "alice", userToken: "tok" });
    expect(getSession(id, "bob", T0)).toBeUndefined();
  });

  it("expire with the Circle token, and are removed when looked up", () => {
    const id = createSession("alice", "tok", "key", T0);
    expect(getSession(id, "alice", T0 + SESSION_TTL_MS - 1)).toBeDefined();
    expect(getSession(id, "alice", T0 + SESSION_TTL_MS)).toBeUndefined();
    expect(sessions.has(id)).toBe(false);
  });

  it("are swept when a new one is created, so idle ones do not pile up", () => {
    for (let i = 0; i < 3; i++) createSession(`user-${i}`, "tok", "key", T0);
    createSession("fresh", "tok", "key", T0 + SESSION_TTL_MS + 1);
    expect(sessions.size).toBe(1);
  });

  it("are capped per user, keeping the newest and leaving other users alone", () => {
    const bob = createSession("bob", "bob-tok", "key", T0);
    const ids = Array.from({ length: MAX_SESSIONS_PER_USER + 3 }, (_, i) => createSession("alice", `tok-${i}`, "key", T0 + i));
    const alice = [...sessions.entries()].filter(([, s]) => s.userId === "alice");
    expect(alice).toHaveLength(MAX_SESSIONS_PER_USER);
    expect(ids.slice(0, 3).every((id) => !sessions.has(id))).toBe(true);
    expect(ids.slice(3).every((id) => sessions.has(id))).toBe(true);
    expect(sessions.has(bob)).toBe(true);
  });

  it("do not accept ids of the wrong type", () => {
    for (const bad of [undefined, null, "", 5, {}, []]) expect(getSession(bad, "alice")).toBeUndefined();
  });

  it("are found by token only for their own user", () => {
    createSession("alice", "alice-tok", "key", T0);
    expect(findSessionByToken("alice", "alice-tok", T0)).toBeDefined();
    expect(findSessionByToken("bob", "alice-tok", T0)).toBeUndefined();
    expect(findSessionByToken("alice", "other", T0)).toBeUndefined();
    expect(findSessionByToken("alice", undefined, T0)).toBeUndefined();
    expect(findSessionByToken("alice", "alice-tok", T0 + SESSION_TTL_MS)).toBeUndefined();
  });

  it("latestSessionForUser picks the newest live one", () => {
    createSession("alice", "old", "key", T0);
    createSession("alice", "new", "key", T0 + 5);
    createSession("bob", "bobs", "key", T0 + 9);
    expect(latestSessionForUser("alice", T0 + 10)?.userToken).toBe("new");
    expect(latestSessionForUser("alice", T0 + SESSION_TTL_MS + 6)).toBeUndefined();
    expect(latestSessionForUser("carol", T0)).toBeUndefined();
  });
});

describe("requireLiveSession", () => {
  it("asks for a session id", () => {
    expect(requireLiveSession(undefined, "alice")).toMatchObject({ status: 400 });
  });

  it("treats another user's session exactly like a missing one", () => {
    const id = createSession("alice", "tok", "key", T0);
    sessions.get(id)!.pushChallenge = () => {};
    const other = requireLiveSession(id, "bob", T0);
    const missing = requireLiveSession("nope", "bob", T0);
    expect(other).toEqual(missing);
    expect(other).toMatchObject({ status: 404 });
  });

  it("waits for the event stream, then hands over the session", () => {
    const id = createSession("alice", "tok", "key", T0);
    expect(requireLiveSession(id, "alice", T0)).toMatchObject({ status: 400 });
    sessions.get(id)!.pushChallenge = () => {};
    expect(requireLiveSession(id, "alice", T0)).toHaveProperty("session");
  });
});
