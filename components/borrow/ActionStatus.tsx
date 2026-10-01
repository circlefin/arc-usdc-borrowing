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

import type { AsyncActionError } from "@/lib/useAsyncAction";

export function ActionStatus({
  isLoading,
  isSuccess,
  error,
  loadingLabel = "Working…",
  successLabel = "Done.",
}: {
  isLoading: boolean;
  isSuccess: boolean;
  error: AsyncActionError | null;
  loadingLabel?: string;
  successLabel?: string;
}) {
  if (isLoading) return <p className="text-xs text-amber-600 dark:text-amber-400">{loadingLabel}</p>;
  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
        <p className="font-medium">{error.title}</p>
        {error.detail && <p className="mt-0.5 text-destructive/90">{error.detail}</p>}
        {error.retryable && <p className="mt-0.5 text-destructive/70">Safe to retry.</p>}
      </div>
    );
  }
  if (isSuccess) return <p className="text-xs text-emerald-600 dark:text-emerald-400">{successLabel}</p>;
  return null;
}
