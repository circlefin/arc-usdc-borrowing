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
import { describe, expect, it, vi } from "vitest";

import { ALICE, BOB, adminFrom, liveSession, post, signIn, ucwClient } from "../helpers/route-mocks";

const WALLET_ID = "d3f0a1b2-1111-4222-8333-444455556666";
const ADDRESS = "0x2222222222222222222222222222222222222222";

async function call(route: string, body: unknown, raw?: string) {
  const mod = await import(/* @vite-ignore */ `${process.cwd()}/app/api/${route}/route.ts`);
  return mod.POST(post(body, raw));
}

describe("/api/wallets/list", () => {
  it("lists wallets for a token issued to the signed-in user's own session", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.listWallets.mockResolvedValue({ data: { wallets: [{ id: WALLET_ID }] } });
    const res = await call("wallets/list", { userToken: "alice-token" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wallets: [{ id: WALLET_ID }] });
    expect(ucwClient.listWallets).toHaveBeenCalledWith({ userToken: "alice-token" });
  });

  it("refuses a token that belongs to someone else's session (it used to forward any token)", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(BOB);
    const res = await call("wallets/list", { userToken: "alice-token" });
    expect(res.status).toBe(404);
    expect(ucwClient.listWallets).not.toHaveBeenCalled();
  });

  it("refuses a token the server never issued", async () => {
    signIn(ALICE);
    for (const userToken of ["made-up", "", undefined, 5, null]) {
      expect((await call("wallets/list", { userToken })).status).toBe(404);
    }
    expect(ucwClient.listWallets).not.toHaveBeenCalled();
  });

  it("refuses an expired session's token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await liveSession(ALICE, "alice-token");
      signIn(ALICE);
      vi.advanceTimersByTime(61 * 60_000);
      expect((await call("wallets/list", { userToken: "alice-token" })).status).toBe(404);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a Circle failure as a 500 without logging the error object", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.listWallets.mockRejectedValue(Object.assign(new Error("boom"), { config: { headers: { Authorization: "Bearer TEST_API_KEY:x" } } }));
    expect((await call("wallets/list", { userToken: "alice-token" })).status).toBe(500);
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toContain("TEST_API_KEY");
  });
});

describe("/api/wallets/balances", () => {
  it("reads balances through the caller's own token", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.getWalletTokenBalance.mockResolvedValue({ data: { tokenBalances: [] } });
    const res = await call("wallets/balances", { userToken: "alice-token", walletId: WALLET_ID });
    expect(res.status).toBe(200);
    expect(ucwClient.getWalletTokenBalance).toHaveBeenCalledWith({ userToken: "alice-token", walletId: WALLET_ID });
  });

  it("refuses someone else's token", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(BOB);
    expect((await call("wallets/balances", { userToken: "alice-token", walletId: WALLET_ID })).status).toBe(404);
    expect(ucwClient.getWalletTokenBalance).not.toHaveBeenCalled();
  });

  it("rejects a wallet id that is not a uuid", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    for (const walletId of ["../x", "abc", "", 5, undefined, WALLET_ID + "0"]) {
      expect((await call("wallets/balances", { userToken: "alice-token", walletId })).status).toBe(400);
    }
    expect(ucwClient.getWalletTokenBalance).not.toHaveBeenCalled();
  });

  it("limits reads to 60 a minute", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.getWalletTokenBalance.mockResolvedValue({ data: {} });
    for (let i = 0; i < 60; i++) expect((await call("wallets/balances", { userToken: "alice-token", walletId: WALLET_ID })).status).toBe(200);
    expect((await call("wallets/balances", { userToken: "alice-token", walletId: WALLET_ID })).status).toBe(429);
  });
});

describe("/api/wallet-accounts/sync", () => {
  function upsertSpy(error: unknown = null) {
    const upsert = vi.fn().mockResolvedValue({ error });
    adminFrom.mockReturnValue({ upsert });
    return upsert;
  }

  it("saves the wallet Circle reports, not the address the browser sent", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.listWallets.mockResolvedValue({ data: { wallets: [{ id: WALLET_ID, address: ADDRESS, blockchain: "ARC-TESTNET" }] } });
    const upsert = upsertSpy();

    const res = await call("wallet-accounts/sync", {
      walletId: WALLET_ID,
      address: "0x9999999999999999999999999999999999999999",
      blockchain: "ETH",
    });

    expect(res.status).toBe(200);
    expect(adminFrom).toHaveBeenCalledWith("wallet_accounts");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ALICE, circle_wallet_id: WALLET_ID, wallet_address: ADDRESS, blockchain: "ARC-TESTNET" }),
      { onConflict: "user_id" },
    );
    expect(ucwClient.listWallets).toHaveBeenCalledWith({ userToken: "alice-token" });
  });

  it("refuses a wallet id that is not among the user's own wallets", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.listWallets.mockResolvedValue({ data: { wallets: [{ id: WALLET_ID, address: ADDRESS, blockchain: "ARC-TESTNET" }] } });
    const upsert = upsertSpy();
    const res = await call("wallet-accounts/sync", { walletId: "99999999-9999-4999-8999-999999999999" });
    expect(res.status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("needs a live session for the user: Bob cannot sync using Alice's", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(BOB);
    const upsert = upsertSpy();
    const res = await call("wallet-accounts/sync", { walletId: WALLET_ID });
    expect(res.status).toBe(404);
    expect(ucwClient.listWallets).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a bad wallet id before calling Circle", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    expect((await call("wallet-accounts/sync", { walletId: "nope" })).status).toBe(400);
    expect((await call("wallet-accounts/sync", {})).status).toBe(400);
    expect(ucwClient.listWallets).not.toHaveBeenCalled();
  });

  it("hides a database error", async () => {
    await liveSession(ALICE, "alice-token");
    signIn(ALICE);
    ucwClient.listWallets.mockResolvedValue({ data: { wallets: [{ id: WALLET_ID, address: ADDRESS, blockchain: "ARC-TESTNET" }] } });
    upsertSpy({ message: 'permission denied for table "wallet_accounts" (host 10.0.0.5)' });
    const res = await call("wallet-accounts/sync", { walletId: WALLET_ID });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Could not save your wallet." });
  });
});

describe("/api/wallet-accounts/me", () => {
  it("hides a database error", async () => {
    const { supabaseUser } = await import("../helpers/route-mocks");
    signIn(ALICE);
    (supabaseUser as unknown as { from: unknown }).from = () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "relation locked by pid 4242" } }) }) }),
    });
    const mod = await import("@/app/api/wallet-accounts/me/route");
    const res = await mod.GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Could not load your wallet." });
  });
});
