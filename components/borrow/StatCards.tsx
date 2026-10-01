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

import type { MarketInfo, Loan } from "@circle-fin/borrow-kit";
import { StatCard } from "./StatCard";
import { HealthGauge } from "./HealthGauge";
import { formatAssetAmount, formatRatio } from "@/lib/format";

export function StatCards({ market, position }: { market: MarketInfo | undefined; position: Loan | undefined }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Market Liquidity"
        value={formatAssetAmount(market?.liquidity, 2)}
        sub={market?.lltv !== null && market?.lltv !== undefined ? `Up to ${formatRatio(market.lltv, 0)} LLTV` : undefined}
      />
      <StatCard
        label="Your cirBTC Collateral"
        value={position?.collateral ? formatAssetAmount(position.collateral, 8) : "0 cirBTC"}
      />
      <StatCard
        label="Your USDC Borrowed"
        value={position?.borrowed ? formatAssetAmount(position.borrowed, 6) : "0 USDC"}
      />
      <HealthGauge position={position} />
    </div>
  );
}
