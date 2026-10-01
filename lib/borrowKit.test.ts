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
import { beforeEach, describe, expect, it, vi } from "vitest";

const providerConfigs: unknown[] = [];

vi.mock("@circle-fin/user-controlled-wallets", () => ({ initiateUserControlledWalletsClient: () => ({}) }));
vi.mock("@circle-fin/borrow-kit", () => ({
  BorrowKit: class {},
  BorrowServiceProvider: class {
    constructor(config: unknown) {
      providerConfigs.push(config);
    }
  },
  Blockchain: {},
  getChainByEnum: () => "",
  isKitError: () => false,
}));

async function load(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  (globalThis as unknown as { borrowKit?: unknown; ucwClient?: unknown }).borrowKit = undefined;
  vi.resetModules();
  providerConfigs.length = 0;
  await import("@/lib/borrowKit");
  return providerConfigs[0] as Record<string, unknown>;
}

beforeEach(() => vi.resetAllMocks());

describe("Borrow service authentication", () => {
  it("uses the Circle API key", async () => {
    const config = await load({ CIRCLE_API_KEY: "TEST_API_KEY:id:secret", BORROW_BASE_URL: "https://api.circle.com" });
    expect(config).toEqual({ apiKey: "TEST_API_KEY:id:secret", baseUrl: "https://api.circle.com" });
  });

  it("only sets what is configured", async () => {
    const config = await load({ CIRCLE_API_KEY: undefined, BORROW_BASE_URL: undefined });
    expect(config).toEqual({});
  });
});
