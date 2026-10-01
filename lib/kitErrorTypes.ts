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

import { isKitError } from "@circle-fin/borrow-kit";

/**
 * Shared shape for a serialized BorrowKit `KitError`, split out from
 * lib/borrowKit.ts (server-only — instantiates BorrowKit with secrets at
 * module scope) so client components can import just this type without any
 * risk of the server module's runtime code ending up in a client bundle.
 */
export interface SerializedKitError {
  message: string;
  code?: number;
  name?: string;
  type?: string;
  recoverability?: string;
}

/**
 * Route-handler catch-block helper. `KitError` (thrown by every BorrowKit
 * call) carries a stable numeric `code` (1200s = input, fix & retry; 8200s =
 * service, safe to retry) plus `name`/`type`/`recoverability` — surface all
 * of it so the client doesn't have to regex-parse a message string.
 */
export function serializeError(error: unknown): SerializedKitError {
  if (isKitError(error)) {
    return {
      message: error.message,
      code: error.code,
      name: error.name,
      type: error.type,
      recoverability: error.recoverability,
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}
