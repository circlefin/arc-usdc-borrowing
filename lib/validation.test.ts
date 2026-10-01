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

import { describe, expect, it } from "vitest";

import { isAddress, isWalletId, parseAmount, parseExploreFilters, parseHealthFactor, parseLoanId, parseMarketId, parseSlippageBps } from "@/lib/validation";

describe("parseAmount", () => {
  it("accepts a positive decimal, a number, or the default", () => {
    expect(parseAmount("1.5")).toEqual({ ok: true, value: "1.5" });
    expect(parseAmount(2)).toEqual({ ok: true, value: "2" });
    expect(parseAmount(undefined, "0.1")).toEqual({ ok: true, value: "0.1" });
  });

  it("rejects everything else, and a missing value without a default", () => {
    for (const v of [undefined, null, "", "0", "-1", "1e5", "0x1", " 1", "1.", ".5", {}, [], true, "9".repeat(13), 0, -3, Number.NaN, 1e21]) {
      expect(parseAmount(v).ok, JSON.stringify(v)).toBe(false);
    }
  });
});

describe("parseSlippageBps", () => {
  it("treats absent as the SDK default and bounds the rest", () => {
    expect(parseSlippageBps(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseSlippageBps(null)).toEqual({ ok: true, value: undefined });
    expect(parseSlippageBps(0)).toEqual({ ok: true, value: 0 });
    expect(parseSlippageBps(1000)).toEqual({ ok: true, value: 1000 });
    expect(parseSlippageBps(1001).ok).toBe(false);
    expect(parseSlippageBps(-1).ok).toBe(false);
    expect(parseSlippageBps(1.5).ok).toBe(false);
  });
});

describe("ids", () => {
  it("market id is 0x + 64 hex", () => {
    const id = "0x" + "aB".repeat(32);
    expect(parseMarketId(id, "x")).toEqual({ ok: true, value: id });
    expect(parseMarketId(undefined, id)).toEqual({ ok: true, value: id });
    expect(parseMarketId("0x12", id).ok).toBe(false);
  });

  it("loan id is a short token of word characters", () => {
    for (const ok of ["loan-1", "0xabc", "a.b:c_d", "x".repeat(128)]) expect(parseLoanId(ok).ok).toBe(true);
    for (const bad of ["", " ", "a/b", "a b", "x".repeat(129), "é", undefined, 3]) expect(parseLoanId(bad).ok).toBe(false);
  });

  it("wallet id and address guards", () => {
    expect(isWalletId("d3f0a1b2-1111-4222-8333-444455556666")).toBe(true);
    expect(isWalletId("d3f0a1b2")).toBe(false);
    expect(isAddress("0x" + "a".repeat(40))).toBe(true);
    expect(isAddress("0x" + "a".repeat(39))).toBe(false);
  });
});

describe("parseHealthFactor", () => {
  it("defaults to 2 and must be above 1", () => {
    expect(parseHealthFactor(undefined)).toEqual({ ok: true, value: 2 });
    expect(parseHealthFactor("1.5")).toEqual({ ok: true, value: 1.5 });
    expect(parseHealthFactor(1).ok).toBe(false);
    expect(parseHealthFactor(101).ok).toBe(false);
    expect(parseHealthFactor("x").ok).toBe(false);
  });
});

describe("parseExploreFilters", () => {
  it("defaults the page size to 25 and drops unknown fields", () => {
    expect(parseExploreFilters({ chain: "Ethereum" })).toEqual({
      ok: true,
      value: { minLltv: undefined, maxLltv: undefined, sortBy: undefined, pageSize: 25, pageAfter: undefined },
    });
  });
});
