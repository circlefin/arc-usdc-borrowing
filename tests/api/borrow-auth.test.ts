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
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALICE, BOB, adminFrom, borrowKit, liveSession, post, signIn, ucwClient } from "../helpers/route-mocks";

const API_DIR = path.join(process.cwd(), "app/api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

const routes = routeFiles(API_DIR).map((file) => "/" + path.relative(process.cwd(), file).replaceAll(path.sep, "/"));

async function callRoute(route: string, request: Request) {
  const mod = await import(/* @vite-ignore */ path.join(process.cwd(), route));
  return mod.POST ? mod.POST(request) : mod.GET(request);
}

describe("every API route requires a signed-in user", () => {
  it("found the routes", () => {
    // Guards the guard: if the glob breaks, the loop below would test nothing.
    expect(routes.length).toBeGreaterThanOrEqual(24);
  });

  it.each(routes)("%s", async (route) => {
    signIn(null);
    const request = route.includes("/events/")
      ? new Request("http://localhost/api/events?sessionId=whatever")
      : post({ sessionId: "x", loanId: "loan-1", amount: "1", userToken: "t", walletId: "d3f0a1b2-1111-4222-8333-444455556666" });

    const res = await callRoute(route, request);

    expect(res.status).toBe(401);
    for (const fn of [...Object.values(borrowKit), ...Object.values(ucwClient), adminFrom]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("a session belongs to the user who created it", () => {
  const cases: Array<[string, Record<string, unknown>, keyof typeof borrowKit]> = [
    ["borrow", { amount: "1" }, "borrow"],
    ["repay", { loanId: "loan-1", amount: "1" }, "repay"],
    ["close", { loanId: "loan-1" }, "closeLoan"],
    ["add-collateral", { loanId: "loan-1", amount: "1" }, "addCollateral"],
    ["withdraw-collateral", { loanId: "loan-1", amount: "1" }, "withdrawCollateralRepayIfNeeded"],
  ];

  it.each(cases)("%s refuses another user's session id", async (route, body, method) => {
    const aliceSession = await liveSession(ALICE);
    signIn(BOB);
    const res = await callRoute(`/app/api/borrow/${route}/route.ts`, post({ sessionId: aliceSession, ...body }));
    expect(res.status).toBe(404);
    expect(borrowKit[method]).not.toHaveBeenCalled();
  });

  it.each(cases)("%s works for the owner", async (route, body, method) => {
    const aliceSession = await liveSession(ALICE);
    signIn(ALICE);
    borrowKit[method].mockResolvedValue({ ok: true });
    const res = await callRoute(`/app/api/borrow/${route}/route.ts`, post({ sessionId: aliceSession, ...body }));
    expect(res.status).toBe(200);
    expect(borrowKit[method]).toHaveBeenCalledTimes(1);
  });

  it("loans and borrow-quote refuse another user's session id", async () => {
    const aliceSession = await liveSession(ALICE);
    signIn(BOB);
    for (const route of ["loans", "borrow-quote"]) {
      const res = await callRoute(`/app/api/borrow/${route}/route.ts`, post({ sessionId: aliceSession, amount: "1" }));
      expect(res.status).toBe(404);
    }
    expect(borrowKit.getLoans).not.toHaveBeenCalled();
    expect(borrowKit.getBorrowQuote).not.toHaveBeenCalled();
  });

  it("does not tell a stranger whether the session exists", async () => {
    const aliceSession = await liveSession(ALICE);
    signIn(BOB);
    const other = await callRoute("/app/api/borrow/borrow/route.ts", post({ sessionId: aliceSession, amount: "1" }));
    const missing = await callRoute("/app/api/borrow/borrow/route.ts", post({ sessionId: "00000000-0000-4000-8000-000000000000", amount: "1" }));
    expect(other.status).toBe(missing.status);
    expect(await other.json()).toEqual(await missing.json());
  });

  it("the event stream is only handed to the session's owner", async () => {
    const aliceSession = await liveSession(ALICE);
    const url = `http://localhost/api/events?sessionId=${aliceSession}`;

    signIn(BOB);
    expect((await callRoute("/app/api/events/route.ts", new Request(url))).status).toBe(404);

    signIn(ALICE);
    const res = await callRoute("/app/api/events/route.ts", new Request(url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    await res.body!.cancel();
  });
});
