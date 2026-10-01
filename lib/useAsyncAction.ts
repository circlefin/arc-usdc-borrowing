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

"use client";

import { useCallback, useState } from "react";
import { logEvent } from "@/lib/activityLog";
import { parseKitError, type FriendlyError } from "@/lib/errors";

/** Kept as a named re-export so components don't reach into lib/errors. */
export type AsyncActionError = FriendlyError;

/** Wraps a Borrow Kit fetch call with loading/success/error state and logs the raw result. */
export function useAsyncAction<T>(label: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<AsyncActionError | null>(null);
  const [data, setData] = useState<T | undefined>();

  const run = useCallback(
    async (fn: () => Promise<T>) => {
      setIsLoading(true);
      setIsSuccess(false);
      setError(null);
      try {
        const result = await fn();
        setData(result);
        setIsSuccess(true);
        logEvent(label, result);
        return result;
      } catch (err) {
        const parsed = parseKitError(err);
        setError(parsed);
        logEvent(`${label} — error`, parsed);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [label],
  );

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
    setData(undefined);
  }, []);

  return { run, isLoading, isSuccess, error, data, reset };
}
