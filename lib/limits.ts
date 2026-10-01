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

import { createRateLimiter } from "@/lib/rateLimit";

type Limiter = ReturnType<typeof createRateLimiter>;

// Shared across route modules (and kept through dev-mode reloads), like the session store.
const globalForLimits = globalThis as unknown as { routeLimiters?: Record<string, Limiter> };

function limiter(name: string, limit: number, windowMs = 60_000): Limiter {
  const limiters = (globalForLimits.routeLimiters ??= {});
  return (limiters[name] ??= createRateLimiter({ limit, windowMs }));
}

/** Each of these is per user, per minute, per server instance. */
export const limits = {
  /** PIN and token routes: each call mints a Circle user token and a session. */
  pin: (userId: string) => limiter("pin", 10)(userId),
  /** Wallet reads. */
  wallet: (userId: string) => limiter("wallet", 60)(userId),
  /** Market data and quotes: read-only calls on the app's Circle API key. */
  quote: (userId: string) => limiter("quote", 60)(userId),
  /** Actions that start a transaction. */
  transact: (userId: string) => limiter("transact", 20)(userId),
};
