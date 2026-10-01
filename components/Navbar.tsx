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

import Link from "next/link";
import { CopyableText } from "@/components/wallet/CopyableText";
import { UserMenu } from "@/components/UserMenu";
import { useUcwSession } from "@/contexts/UcwSessionContext";
import { useAuthSession } from "@/contexts/AuthContext";

export function Navbar() {
  const { wallet, balances } = useUcwSession();
  const { status } = useAuthSession();

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto max-w-4xl flex flex-col gap-2 py-2 px-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:h-14 sm:py-0">
        <Link href="/" className="flex items-center gap-2 font-bold text-base sm:text-lg shrink-0">
          <span className="text-xl">◈</span>
          <span>Arc USDC Borrowing Sample App</span>
        </Link>

        {status === "signed-in" ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3 text-sm sm:justify-end">
            {wallet && (
              <>
                {balances.map((b) => (
                  <span key={b.symbol} className="inline-flex items-center">
                    <span className="text-muted-foreground mr-1">{b.symbol}:</span>
                    <span className="font-medium">{b.amount}</span>
                  </span>
                ))}
                {balances.length > 0 && (
                  <span className="text-muted-foreground/40 hidden sm:inline">|</span>
                )}
                <CopyableText value={wallet.address}>
                  <code className="text-sm">
                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </code>
                </CopyableText>
              </>
            )}
            <UserMenu />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
