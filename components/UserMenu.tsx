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

import { ChevronDown, LogOut, KeyRound, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSession } from "@/contexts/AuthContext";
import { useUcwSession } from "@/contexts/UcwSessionContext";

export function UserMenu() {
  const { user, signOut } = useAuthSession();
  const { needsWalletSetup, resetPin, recoverPin, disconnect } = useUcwSession();

  function handleSignOut() {
    disconnect();
    void signOut();
  }

  // Reset/Recover PIN only make sense for a user who already has a wallet
  // and PIN — needsWalletSetup is Circle's own signal for "this is a brand
  // new user", so gate on that rather than on whether a wallet happens to be
  // loaded in this render (which can be transiently false while resuming).
  const showPinActions = !needsWalletSetup;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground outline-none select-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground">
        <span className="max-w-[16rem] truncate">{user?.email}</span>
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
        {showPinActions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void resetPin()}>
              <RotateCcw />
              Reset PIN
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void recoverPin()}>
              <KeyRound />
              Recover PIN
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
