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

import type { ExploreMarketsResult } from "@circle-fin/borrow-kit";
import { Trash2 } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionStatus } from "./ActionStatus";
import { postJson } from "@/lib/api";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { formatRatio } from "@/lib/format";

export function MarketExplorer() {
  const explore = useAsyncAction<ExploreMarketsResult>("Explore markets");

  const markets = explore.data?.markets ?? [];

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Explore markets</CardTitle>
        <CardAction className="row-span-1 self-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-my-1"
            aria-label="Clear markets"
            onClick={explore.reset}
            disabled={markets.length === 0}
          >
            <Trash2 className="size-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          The panels above default to the Arc Testnet cirBTC/USDC market. This lists every
          Morpho market Borrow Kit can see on Arc.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={explore.isLoading}
          onClick={() => explore.run(() => postJson<ExploreMarketsResult>("/api/borrow/markets", {}))}
        >
          {explore.isLoading ? "Loading…" : "Load markets"}
        </Button>
        <ActionStatus {...explore} loadingLabel="Fetching markets…" successLabel={`${markets.length} market(s) loaded.`} />
        {markets.length > 0 && (
          <div className="space-y-1.5">
            {markets.map((m) => (
              <div key={m.marketId} className="rounded-md border border-border p-2 text-xs font-mono break-all">
                {m.collateralAsset.symbol}/{m.loanAsset.symbol} · {formatRatio(m.lltv, 0)} LLTV · {m.marketId}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
