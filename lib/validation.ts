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
 * Validation for request bodies. Every borrow route used to hand `amount`, `marketId`,
 * `loanId`, `slippageBps` and friends to the SDK as they arrived; a route is a public POST
 * endpoint, so they are checked here first.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(message: string): Parsed<T> => ({ ok: false, message });

/** The most one request may move, in whole tokens. */
export const MAX_AMOUNT = 1_000_000_000_000;

/** The most slippage a request may allow: 10%. */
export const MAX_SLIPPAGE_BPS = 1_000;

const AMOUNT = /^\d+(\.\d{1,18})?$/;
const MARKET_ID = /^0x[0-9a-fA-F]{64}$/;
const LOAN_ID = /^[\w.:-]{1,128}$/;
const WALLET_ID = /^[0-9a-fA-F-]{36}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** A positive decimal string with no sign, exponent or whitespace. A default may be supplied. */
export function parseAmount(value: unknown, fallback?: string): Parsed<string> {
  const v = value === undefined ? fallback : value;
  if (typeof v !== "string" && typeof v !== "number") return fail("Enter an amount.");
  const text = String(v);
  if (!AMOUNT.test(text) || !(Number(text) > 0) || Number(text) > MAX_AMOUNT) {
    return fail("Enter a valid amount.");
  }
  return ok(text);
}

export function parseMarketId(value: unknown, fallback: string): Parsed<string> {
  const v = value === undefined ? fallback : value;
  return typeof v === "string" && MARKET_ID.test(v) ? ok(v) : fail("That market id isn't valid.");
}

export function parseLoanId(value: unknown): Parsed<string> {
  return typeof value === "string" && LOAN_ID.test(value) ? ok(value) : fail("loanId required");
}

/** Optional: undefined means "use the SDK default". An integer from 0 to MAX_SLIPPAGE_BPS. */
export function parseSlippageBps(value: unknown): Parsed<number | undefined> {
  if (value === undefined || value === null) return ok(undefined);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_SLIPPAGE_BPS) {
    return fail(`Slippage must be a whole number of basis points from 0 to ${MAX_SLIPPAGE_BPS}.`);
  }
  return ok(value);
}

export function parseHealthFactor(value: unknown, fallback = 2): Parsed<number> {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n <= 1 || n > 100) return fail("Target health factor must be above 1 and at most 100.");
  return ok(n);
}

const SORT_BY = ["lltv", "borrowApy"] as const;
export type SortBy = (typeof SORT_BY)[number];

export interface ExploreFilters {
  minLltv?: string;
  maxLltv?: string;
  sortBy?: SortBy;
  pageSize: number;
  pageAfter?: string;
}

export function parseExploreFilters(body: Record<string, unknown>): Parsed<ExploreFilters> {
  const DECIMAL = /^\d+(\.\d{1,18})?$/;
  for (const key of ["minLltv", "maxLltv"] as const) {
    const v = body[key];
    if (v !== undefined && !(typeof v === "string" && DECIMAL.test(v))) {
      return fail("Filters must be decimal strings.");
    }
  }

  let sortBy: SortBy | undefined;
  if (body.sortBy !== undefined) {
    if (!SORT_BY.includes(body.sortBy as SortBy)) return fail("sortBy must be lltv or borrowApy.");
    sortBy = body.sortBy as SortBy;
  }

  const pageSize = body.pageSize === undefined ? 25 : body.pageSize;
  if (typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return fail("pageSize must be a whole number from 1 to 100.");
  }

  let pageAfter: string | undefined;
  if (body.pageAfter !== undefined) {
    if (typeof body.pageAfter !== "string" || body.pageAfter.length === 0 || body.pageAfter.length > 512) {
      return fail("pageAfter is not valid.");
    }
    pageAfter = body.pageAfter;
  }

  return ok({ minLltv: body.minLltv as string | undefined, maxLltv: body.maxLltv as string | undefined, sortBy, pageSize, pageAfter });
}

export function isWalletId(value: unknown): value is string {
  return typeof value === "string" && WALLET_ID.test(value);
}

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS.test(value);
}
