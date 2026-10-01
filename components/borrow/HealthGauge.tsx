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

import type { Loan, HealthFactorBand } from "@circle-fin/borrow-kit";
import { formatAssetAmount, formatRatio } from "@/lib/format";

const BAND_STYLE: Record<HealthFactorBand, { label: string; text: string; bar: string }> = {
  SAFE: { label: "Safe", text: "text-emerald-400", bar: "bg-emerald-500" },
  WARN: { label: "Warn", text: "text-amber-400", bar: "bg-amber-500" },
  URGENT: { label: "Urgent", text: "text-orange-400", bar: "bg-orange-500" },
  IMMINENT: { label: "Imminent", text: "text-red-400", bar: "bg-red-500" },
  LIQUIDATABLE: { label: "Liquidatable", text: "text-red-500", bar: "bg-red-600 animate-pulse" },
};

export function HealthGauge({ position }: { position: Loan | undefined }) {
  const healthFactor = position?.healthFactor ?? undefined;
  const band = position?.healthFactorBand ?? undefined;
  const style = band ? BAND_STYLE[band] : undefined;

  // Map health factor to a 0-100 gauge — 1.0 sits near the left edge, 2.0+
  // fills the bar (matches the SDK's SAFE >=1.20 / LIQUIDATABLE <1.00 bands).
  const pct = healthFactor !== undefined ? Math.max(0, Math.min(100, ((healthFactor - 1) / 1) * 100)) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">Loan Health</p>
      <p className={`text-lg font-semibold font-mono ${style?.text ?? ""}`}>
        {healthFactor !== undefined ? healthFactor.toFixed(2) : "—"}
        {style && <span className="ml-2 text-xs font-sans font-medium align-middle">{style.label}</span>}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${style?.bar ?? "bg-secondary"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        {position?.ltv !== null && position?.ltv !== undefined ? `LTV ${formatRatio(position.ltv)}` : "No active loan"}
        {position?.liquidationPrice ? ` · liq. price ${formatAssetAmount(position.liquidationPrice, 2)}` : ""}
      </p>
    </div>
  );
}
