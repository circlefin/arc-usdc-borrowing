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

import { test, expect } from "@playwright/test";
import { mockSupabaseAuth, mockAppApis, signIn } from "./mocks";

test.describe("sign-up", () => {
  test("shows email-confirmation notice instead of jumping straight to signed-in", async ({
    page,
  }) => {
    await mockSupabaseAuth(page, { signUpConfirmed: false });
    await page.goto("/");

    await page.getByPlaceholder("you@example.com").fill("new-user@example.com");
    await page.getByPlaceholder("min 6 characters").fill("password123");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.getByText(/check your email to confirm your account/i)).toBeVisible();
    // No session was returned, so the app must not treat this as signed in.
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });

  test("disables both buttons until email and password are valid", async ({ page }) => {
    await page.goto("/");
    const signUpButton = page.getByRole("button", { name: "Sign up" });
    const signInButton = page.getByRole("button", { name: "Sign in" });

    await expect(signUpButton).toBeDisabled();
    await expect(signInButton).toBeDisabled();

    await page.getByPlaceholder("you@example.com").fill("a@b.com");
    await page.getByPlaceholder("min 6 characters").fill("12345"); // too short
    await expect(signUpButton).toBeDisabled();

    await page.getByPlaceholder("min 6 characters").fill("123456");
    await expect(signUpButton).toBeEnabled();
    await expect(signInButton).toBeEnabled();
  });
});

test.describe("wallet setup", () => {
  // Regression test: wallet creation for a brand-new user used to require
  // clicking a "Create wallet" button. It's now auto-triggered as soon as
  // the app learns the user has no wallet — this asserts that a user who
  // never clicks anything still lands on the dashboard.
  test("a brand-new user's wallet is created automatically, with no button click required", async ({
    page,
  }) => {
    await mockSupabaseAuth(page);
    await mockAppApis(page, {
      hasWallet: false,
      walletListSequence: [[{ id: "w1", address: "0xabc", blockchain: "ARC-TESTNET" }]],
    });
    await page.goto("/");

    await signIn(page, "no-wallet@example.com");

    // No "Create wallet" click anywhere — straight through to the dashboard.
    await expect(page.getByText("Collateral")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Loan" })).toBeVisible();
  });

  // Regression test: previously the dashboard's own useBorrowState() hook
  // called /api/borrow/loans the instant session.sessionId went truthy —
  // right after /api/pin/setup responded, well before the wallet was
  // actually confirmed to exist. Assert the real request order here rather
  // than just the end state, since the bug was about *when* the call fires,
  // not just whether it eventually succeeds.
  test("does not request /api/borrow/loans until the wallet is confirmed via wallets/list", async ({
    page,
  }) => {
    await mockSupabaseAuth(page);
    await mockAppApis(page, {
      hasWallet: true,
      walletListSequence: [[{ id: "w1", address: "0xabc", blockchain: "ARC-TESTNET" }]],
    });

    const requestOrder: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/wallets/list") || url.includes("/api/borrow/loans")) {
        requestOrder.push(url.includes("/api/wallets/list") ? "wallets/list" : "borrow/loans");
      }
    });

    await page.goto("/");
    await signIn(page, "has-wallet@example.com");

    // Dashboard renders once session + wallet are both ready.
    await expect(page.getByText("Collateral")).toBeVisible();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Loan" })).toBeVisible();

    await expect
      .poll(() => requestOrder.includes("borrow/loans"), { timeout: 10_000 })
      .toBe(true);

    const firstWalletsListIndex = requestOrder.indexOf("wallets/list");
    const firstLoansIndex = requestOrder.indexOf("borrow/loans");
    expect(firstWalletsListIndex).toBeGreaterThanOrEqual(0);
    expect(firstWalletsListIndex).toBeLessThan(firstLoansIndex);
  });

  // The header user-menu dropdown (email → Reset/Recover PIN + Sign out) is
  // portal-rendered via @base-ui/react — worth a real-browser check since
  // that positioning/open behavior is exactly the kind of thing jsdom fakes
  // imperfectly in the unit tests.
  test("the header user menu shows Reset/Recover PIN for a returning user and signs out", async ({
    page,
  }) => {
    await mockSupabaseAuth(page);
    await mockAppApis(page, {
      hasWallet: true,
      walletListSequence: [[{ id: "w1", address: "0xabc", blockchain: "ARC-TESTNET" }]],
    });

    await page.goto("/");
    await signIn(page, "has-wallet@example.com");
    await expect(page.getByText("Collateral")).toBeVisible();

    await page.getByText("has-wallet@example.com").click();
    await expect(page.getByRole("menuitem", { name: "Reset PIN" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Recover PIN" })).toBeVisible();

    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Sign in" })).toBeVisible();
  });

  // Regression test: previously, if Circle never indexed a freshly created
  // wallet, the UI showed "Setting up your wallet…" forever with no error,
  // no retry, and no way out. It must now settle into an error state with
  // both options after the retry budget is exhausted.
  test("wallet creation that never confirms settles into a retry/sign-out screen instead of hanging forever", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await mockSupabaseAuth(page);
    // /api/wallets/list always returns empty — simulates Circle never
    // indexing the wallet within the app's retry budget.
    await mockAppApis(page, { hasWallet: false, walletListSequence: [[]] });

    await page.goto("/");
    await signIn(page, "stuck-wallet@example.com");

    await expect(page.getByText("We couldn't find your wallet yet.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Sign in" })).toBeVisible();
  });
});
