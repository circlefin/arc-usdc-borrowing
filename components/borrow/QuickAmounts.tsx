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

export function QuickAmounts({
  onSelect,
  max,
  presets,
  onMax,
}: {
  onSelect: (v: string) => void;
  max: number | undefined;
  presets: string[];
  onMax?: () => void;
}) {
  return (
    <div className="flex gap-1 mt-2">
      {presets.map((v) => {
        const disabled = max === undefined || parseFloat(v) > max;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            disabled={disabled}
            className="flex-1 rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary"
          >
            {v}
          </button>
        );
      })}
      {onMax && (
        <button
          type="button"
          onClick={onMax}
          disabled={max === undefined || max <= 0}
          className="flex-1 rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary"
        >
          Max
        </button>
      )}
    </div>
  );
}
