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

/**
 * In-memory UCW session store, shared across all API route modules.
 *
 * Stashed on `globalThis` so it survives Next.js dev-mode Fast Refresh
 * (route modules get re-evaluated on edit; a plain module-level Map would
 * reset). This is a sample-app limitation: sessions are lost on server
 * restart, same as the reference demo.
 *
 * A session holds a Circle user token, which can approve wallet actions, so it is
 * bound to the Supabase user that created it (every lookup takes the caller's
 * user id), expires with the token, and is capped per user. Before, a session
 * id alone was enough to use it, sessions were never removed, and each call to
 * /api/pin/* added one.
 */

export type Session = {
  userId: string;
  userToken: string;
  encryptionKey: string;
  createdAt: number;
  pushChallenge?: (challengeId: string) => void;
};

/** Circle user tokens last an hour. */
export const SESSION_TTL_MS = 60 * 60 * 1000;
export const MAX_SESSIONS_PER_USER = 5;

const globalForSessions = globalThis as unknown as {
  ucwSessions?: Map<string, Session>;
};

export const sessions: Map<string, Session> =
  globalForSessions.ucwSessions ?? new Map<string, Session>();

globalForSessions.ucwSessions = sessions;

function isExpired(session: Session, now: number) {
  return now - session.createdAt >= SESSION_TTL_MS;
}

function sweepExpired(now: number) {
  for (const [id, session] of sessions) {
    if (isExpired(session, now)) sessions.delete(id);
  }
}

export function createSession(
  userId: string,
  userToken: string,
  encryptionKey: string,
  now = Date.now(),
): string {
  sweepExpired(now);

  // Keep the newest sessions of this user; the Map iterates in insertion order.
  const own = [...sessions.entries()].filter(([, s]) => s.userId === userId);
  for (const [id] of own.slice(0, Math.max(0, own.length - (MAX_SESSIONS_PER_USER - 1)))) {
    sessions.delete(id);
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { userId, userToken, encryptionKey, createdAt: now });
  return sessionId;
}

/**
 * The caller's own live session, or undefined. A session that belongs to someone else is
 * reported exactly like one that does not exist.
 */
export function getSession(sessionId: unknown, userId: string, now = Date.now()): Session | undefined {
  if (typeof sessionId !== "string" || !sessionId) return undefined;
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (isExpired(session, now)) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session.userId === userId ? session : undefined;
}

/** The caller's live session that holds this user token, if any. */
export function findSessionByToken(userId: string, userToken: unknown, now = Date.now()): Session | undefined {
  if (typeof userToken !== "string" || !userToken) return undefined;
  for (const [id, session] of sessions) {
    if (session.userId !== userId || session.userToken !== userToken) continue;
    return getSession(id, userId, now);
  }
  return undefined;
}

/** The caller's most recent live session, if any. */
export function latestSessionForUser(userId: string, now = Date.now()): Session | undefined {
  let latest: Session | undefined;
  for (const [id, session] of sessions) {
    if (session.userId !== userId || !getSession(id, userId, now)) continue;
    if (!latest || session.createdAt >= latest.createdAt) latest = session;
  }
  return latest;
}

export function requireLiveSession(
  sessionId: unknown,
  userId: string,
  now = Date.now(),
):
  | { session: Session }
  | { error: string; status: 400 | 404 } {
  if (typeof sessionId !== "string" || !sessionId) {
    return { error: "Your session isn't ready yet. Reload the page and try again.", status: 400 };
  }
  const session = getSession(sessionId, userId, now);
  if (!session) {
    return { error: "Your session expired. Sign in again.", status: 404 };
  }
  if (!session.pushChallenge) {
    return {
      error: "Your wallet connection isn't ready yet. Give it a second and retry.",
      status: 400,
    };
  }
  return { session };
}
