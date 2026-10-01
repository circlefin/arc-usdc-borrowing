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

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs against the LOCAL Supabase stack: `npm run db:start`, then `npm run test:integration`.
// It creates its own users and deletes only those, so a database with real data in it is safe.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, options);
const anon = createClient(url, publishableKey, options);

interface TestUser {
  id: string;
  client: SupabaseClient;
}

const createdUsers: string[] = [];
const password = "integration-test-password";

async function makeUser(): Promise<TestUser> {
  const email = `it-${randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  createdUsers.push(data.user.id);

  const client = createClient(url, publishableKey, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, client };
}

const ADDRESS = "0x" + "1".repeat(40);

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await makeUser();
  bob = await makeUser();
  // What /api/wallet-accounts/sync does: the server saves it with the secret key.
  for (const [user, wallet] of [[alice, "wallet-alice"], [bob, "wallet-bob"]] as const) {
    const { error } = await admin
      .from("wallet_accounts")
      .insert({ user_id: user.id, circle_wallet_id: wallet, wallet_address: ADDRESS, blockchain: "ARC-TESTNET" });
    if (error) throw new Error(`wallet_accounts: ${error.message}`);
  }
});

afterAll(async () => {
  // Deleting the auth user cascades to wallet_accounts and activity_log.
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
});

describe("wallet_accounts", () => {
  it("lets a user read only their own wallet", async () => {
    const { data } = await alice.client.from("wallet_accounts").select("user_id, circle_wallet_id");
    expect(data).toEqual([{ user_id: alice.id, circle_wallet_id: "wallet-alice" }]);
  });

  it("shows nothing to anonymous callers", async () => {
    const { data, error } = await anon.from("wallet_accounts").select("*");
    expect(data ?? []).toEqual([]);
    if (error) expect(error.message).toMatch(/permission denied/i);
  });

  it("does not let a user point their own row at another wallet (writes are the server's)", async () => {
    const update = await alice.client.from("wallet_accounts").update({ wallet_address: "0x" + "9".repeat(40), circle_wallet_id: "attacker" }).eq("user_id", alice.id);
    const upsert = await alice.client
      .from("wallet_accounts")
      .upsert({ user_id: alice.id, circle_wallet_id: "attacker", wallet_address: "0x" + "9".repeat(40), blockchain: "ETH" }, { onConflict: "user_id" });

    // Denied outright, not just silently ignored.
    expect(update.error?.message).toMatch(/permission denied|row-level security/i);
    expect(upsert.error?.message).toMatch(/permission denied|row-level security/i);

    const { data } = await admin.from("wallet_accounts").select("circle_wallet_id, wallet_address").eq("user_id", alice.id).single();
    expect(data).toEqual({ circle_wallet_id: "wallet-alice", wallet_address: ADDRESS });
  });

  it("does not let a user create or delete rows", async () => {
    const carol = await makeUser();
    const insert = await carol.client.from("wallet_accounts").insert({ user_id: carol.id, circle_wallet_id: "mine", wallet_address: ADDRESS, blockchain: "ARC-TESTNET" });
    expect(insert.error?.message).toMatch(/permission denied|row-level security/i);

    const del = await alice.client.from("wallet_accounts").delete().eq("user_id", alice.id);
    expect(del.error?.message ?? "permission denied").toMatch(/permission denied|row-level security/i);
    const { data } = await admin.from("wallet_accounts").select("user_id").eq("user_id", alice.id);
    expect(data).toHaveLength(1);
  });

  it("still lets the server save a wallet, and update it", async () => {
    const dave = await makeUser();
    const first = await admin.from("wallet_accounts").upsert({ user_id: dave.id, circle_wallet_id: "w1", wallet_address: ADDRESS, blockchain: "ARC-TESTNET" }, { onConflict: "user_id" });
    expect(first.error).toBeNull();
    const second = await admin.from("wallet_accounts").upsert({ user_id: dave.id, circle_wallet_id: "w2", wallet_address: ADDRESS, blockchain: "ARC-TESTNET" }, { onConflict: "user_id" });
    expect(second.error).toBeNull();
    const { data } = await dave.client.from("wallet_accounts").select("circle_wallet_id");
    expect(data).toEqual([{ circle_wallet_id: "w2" }]);
  });
});

describe("activity_log", () => {
  it("lets a user append to and read their own log", async () => {
    const insert = await alice.client.from("activity_log").insert({ label: "borrow", data: { ok: true } });
    expect(insert.error).toBeNull();
    const { data } = await alice.client.from("activity_log").select("label, data");
    expect(data).toContainEqual({ label: "borrow", data: { ok: true } });
  });

  it("scopes every row to the caller: user_id defaults to them, and cannot be someone else's", async () => {
    const { data } = await alice.client.from("activity_log").insert({ label: "mine", data: null }).select("user_id").single();
    expect(data?.user_id).toBe(alice.id);

    const forged = await alice.client.from("activity_log").insert({ user_id: bob.id, label: "forged", data: null });
    expect(forged.error).not.toBeNull();

    const bobsView = await bob.client.from("activity_log").select("label");
    expect(bobsView.data?.map((r) => r.label) ?? []).not.toContain("mine");
  });

  it("is append-only: a user cannot edit or delete entries", async () => {
    const { data: row } = await alice.client.from("activity_log").insert({ label: "keep-me", data: { n: 1 } }).select("id").single();
    await alice.client.from("activity_log").update({ label: "edited" }).eq("id", row!.id);
    await alice.client.from("activity_log").delete().eq("id", row!.id);
    const { data } = await admin.from("activity_log").select("label").eq("id", row!.id).single();
    expect(data?.label).toBe("keep-me");
  });

  it("shows nothing to anonymous callers", async () => {
    const { data } = await anon.from("activity_log").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("refuses an oversized label or payload (new limits)", async () => {
    const longLabel = await alice.client.from("activity_log").insert({ label: "x".repeat(201), data: null });
    expect(longLabel.error?.message).toMatch(/activity_log_label_length/);

    const big = await alice.client.from("activity_log").insert({ label: "big", data: { blob: "x".repeat(300_000) } });
    expect(big.error?.message).toMatch(/activity_log_data_size/);
  });

  it("accepts a label of 200 characters and a sizeable payload", async () => {
    const ok = await alice.client.from("activity_log").insert({ label: "x".repeat(200), data: { blob: "x".repeat(100_000) } });
    expect(ok.error).toBeNull();
  });
});
