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

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PinLogin } from "@/components/PinLogin";
import { AuthForm } from "@/components/auth/AuthForm";
import { StatCards } from "@/components/borrow/StatCards";
import { CollateralPanel } from "@/components/borrow/CollateralPanel";
import { LoanPanel } from "@/components/borrow/LoanPanel";
import { ActivityLog } from "@/components/borrow/ActivityLog";
import { MarketExplorer } from "@/components/borrow/MarketExplorer";
import { useUcwSession } from "@/contexts/UcwSessionContext";
import { useAuthSession } from "@/contexts/AuthContext";
import { useBorrowState } from "@/hooks/useBorrowState";

export default function BorrowKitPage() {
  const { status, signOut } = useAuthSession();
  const { session, wallet, error, isBusy, refreshWallet, disconnect } = useUcwSession();
  const { market, position, activeLoanId, refetchAll } = useBorrowState();

  function handleSignOut() {
    disconnect();
    void signOut();
  }

  return (
    <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-5 sm:py-8 space-y-6 sm:space-y-8">
      <div>
        <p className="text-muted-foreground mt-1 text-sm">
          Deposit cirBTC as collateral and borrow USDC against a Morpho market on Arc Testnet —
          powered by Circle&apos;s Borrow Kit SDK.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : status === "signed-out" ? (
        <AuthForm />
      ) : !session ? (
        <PinLogin />
      ) : !wallet ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {isBusy ? "Setting up your wallet…" : "We couldn't find your wallet yet."}
            </p>
            {error && (
              <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive text-center">
                {error}
              </p>
            )}
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshWallet()}
                disabled={isBusy}
              >
                Try again
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isBusy}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatCards market={market} position={position} />

          <div className="grid md:grid-cols-2 gap-4 items-start">
            <CollateralPanel activeLoanId={activeLoanId} onSuccess={refetchAll} />
            <LoanPanel activeLoanId={activeLoanId} onSuccess={refetchAll} />
          </div>

          <MarketExplorer />
          <ActivityLog />
        </>
      )}      
    </div>
  );
}
