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

import type { Page } from "@playwright/test";

/**
 * Everything below intercepts requests at the browser network layer
 * (page.route), so nothing ever reaches the real Supabase/Circle backends —
 * even though the dev server is started with real project credentials from
 * .env.local for other purposes.
 */

let userCounter = 0;

function fakeSupabaseUser(email: string) {
  userCounter += 1;
  const now = new Date().toISOString();
  return {
    id: `00000000-0000-4000-8000-00000000000${userCounter}`,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
  };
}

/** GoTrue's hasSession() check requires exactly these three truthy fields. */
function fakeSupabaseSession(email: string) {
  return {
    access_token: "fake-access-token",
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "fake-refresh-token",
    user: fakeSupabaseUser(email),
  };
}

/**
 * Mocks Supabase auth at the browser network layer. `signUpConfirmed`
 * controls whether POST /auth/v1/signup returns an immediate session
 * (auto-confirm) or just a user with no session (the "check your email"
 * path AuthForm shows).
 */
export async function mockSupabaseAuth(page: Page, { signUpConfirmed = false } = {}) {
  await page.route("**/auth/v1/signup", async (route) => {
    const body = route.request().postDataJSON() as { email: string };
    const payload = signUpConfirmed
      ? fakeSupabaseSession(body.email)
      : fakeSupabaseUser(body.email);
    await route.fulfill({ status: 200, json: payload });
  });

  await page.route("**/auth/v1/token*", async (route) => {
    const body = route.request().postDataJSON() as { email: string };
    await route.fulfill({ status: 200, json: fakeSupabaseSession(body.email) });
  });

  await page.route("**/auth/v1/logout*", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

/** Mocks the app's own /api/* routes so no request reaches Circle. */
export async function mockAppApis(
  page: Page,
  opts: {
    hasWallet: boolean;
    /** Successive responses returned by /api/wallets/list, last one repeats. */
    walletListSequence?: Array<{ id: string; address: string; blockchain: string }[]>;
  },
) {
  const walletListSequence = opts.walletListSequence ?? [[]];
  let walletListCallCount = 0;

  await page.route("**/api/wallet-accounts/me", async (route) => {
    await route.fulfill({ status: 200, json: { hasWallet: opts.hasWallet } });
  });

  await page.route("**/api/pin/setup", async (route) => {
    await route.fulfill({
      status: 200,
      // No challengeId: skips the real W3S PIN iframe entirely, which is
      // fine here — these tests exercise the app's own session/wallet
      // wiring, not Circle's third-party challenge UI.
      json: { sessionId: "sess-e2e", userToken: "tok-e2e", encryptionKey: "key-e2e" },
    });
  });

  await page.route("**/api/pin/token", async (route) => {
    await route.fulfill({
      status: 200,
      json: { sessionId: "sess-e2e", userToken: "tok-e2e", encryptionKey: "key-e2e" },
    });
  });

  await page.route("**/api/wallets/list", async (route) => {
    const wallets =
      walletListSequence[Math.min(walletListCallCount, walletListSequence.length - 1)];
    walletListCallCount += 1;
    await route.fulfill({ status: 200, json: { wallets } });
  });

  await page.route("**/api/wallets/balances", async (route) => {
    await route.fulfill({ status: 200, json: { tokenBalances: [] } });
  });

  await page.route("**/api/wallet-accounts/sync", async (route) => {
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await page.route("**/api/borrow/market", async (route) => {
    await route.fulfill({ status: 200, json: {} });
  });

  await page.route("**/api/borrow/loans", async (route) => {
    await route.fulfill({
      status: 200,
      json: { walletAddress: "0xabc", loans: [] },
    });
  });

  // Real server route (in-memory session store, not mocked above) — a
  // fake sessionId that was never registered via a real /api/pin/setup
  // call 404s here. Harmless: the app treats a failed SSE connection as
  // "no PIN challenge push available yet", not a fatal error.
}

export async function signIn(page: Page, email: string, password = "password123") {
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("min 6 characters").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
