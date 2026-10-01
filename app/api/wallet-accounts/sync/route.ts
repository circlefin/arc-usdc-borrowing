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

import { NextResponse } from "next/server";
import { ucwClient } from "@/lib/borrowKit";
import { limits } from "@/lib/limits";
import { badRequest, readJsonBody, requireUser, tooManyRequests } from "@/lib/routeAuth";
import { logRouteError } from "@/lib/routeLog";
import { latestSessionForUser } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isWalletId } from "@/lib/validation";

/**
 * Caches the user's wallet in `wallet_accounts`. The browser only names the wallet; the
 * address and chain come from Circle, looked up with the user's own session, so a client
 * cannot record a wallet that is not theirs. (It used to store whatever the body said, and
 * the table was writable by the user directly.)
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const read = await readJsonBody(req);
  if ("response" in read) return read.response;

  if (!isWalletId(read.body.walletId)) return badRequest("walletId is not valid.");

  const limited = limits.wallet(auth.user.id);
  if (!limited.ok) return tooManyRequests(limited);

  const session = latestSessionForUser(auth.user.id);
  if (!session) {
    return NextResponse.json({ message: "Your session expired. Sign in again." }, { status: 404 });
  }

  try {
    const { data } = await ucwClient.listWallets({ userToken: session.userToken });
    const wallet = data?.wallets?.find((w) => w.id === read.body.walletId);
    if (!wallet) {
      return NextResponse.json({ message: "That wallet was not found for your account." }, { status: 404 });
    }

    const { error } = await getSupabaseAdminClient().from("wallet_accounts").upsert(
      {
        user_id: auth.user.id,
        circle_wallet_id: wallet.id,
        wallet_address: wallet.address,
        blockchain: wallet.blockchain,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("wallet-accounts/sync", error);
    return NextResponse.json({ message: "Could not save your wallet." }, { status: 500 });
  }
}
