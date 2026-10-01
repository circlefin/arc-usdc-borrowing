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
 * Logs a route failure without dumping the error object. HTTP client errors carry the whole
 * request config, and that includes the Authorization header with the API key, which then
 * lands in the server logs.
 */
export function logRouteError(tag: string, error: unknown) {
  const e = error as { message?: unknown; code?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  const message = typeof e?.message === "string" ? e.message : String(error);
  const status = e?.status ?? e?.response?.status;
  const parts = [message];
  if (e?.code !== undefined) parts.push(`code=${String(e.code)}`);
  if (status !== undefined) parts.push(`status=${String(status)}`);
  console.error(`[${tag}]`, parts.join(" "));
}
