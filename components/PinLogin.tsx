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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUcwSession } from "@/contexts/UcwSessionContext";
import { useAuthSession } from "@/contexts/AuthContext";

export function PinLogin() {
  const { createWallet, disconnect, needsWalletSetup, isBusy, error } = useUcwSession();
  const { signOut, isBusy: authBusy } = useAuthSession();

  function handleSignOut() {
    disconnect();
    void signOut();
  }

  // Returning user: the app already auto-attempted to resume their Circle
  // session (see UcwSessionContext's auto-resume effect). If it failed,
  // Reset/Recover PIN are available from the user menu in the header (it's
  // already visible here — status is signed-in the moment this renders).
  if (!needsWalletSetup) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {error ? "We couldn't restore your session." : "Restoring your session…"}
          </p>
          {error && (
            <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={authBusy}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Brand-new user: wallet creation is auto-triggered by UcwSessionContext
  // as soon as needsWalletSetup goes true, so there's no button to click in
  // the happy path — just the PIN challenge Circle's SDK pops up. Reset/
  // Recover PIN don't apply yet since there's no wallet or PIN to reset.
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-base">Setting up your Circle wallet</CardTitle>
        <CardDescription>
          Circle prompts you to set a PIN when a challenge appears — this creates a
          User-Controlled Wallet tied to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          {isBusy ? "Setting up…" : error ? "Wallet setup didn't finish." : "Setting up…"}
        </p>

        {error && (
          <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2">
          {error && !isBusy && (
            <Button size="sm" onClick={() => void createWallet()}>
              Try again
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={isBusy || authBusy}>
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
