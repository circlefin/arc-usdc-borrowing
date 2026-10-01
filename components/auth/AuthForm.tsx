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

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "@/contexts/AuthContext";

export function AuthForm() {
  const { signUp, signIn, isBusy, error } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedUp, setSignedUp] = useState(false);

  const valid = email.trim().length > 3 && password.length >= 6;

  async function handleSignUp() {
    if (!valid) return;
    await signUp(email.trim(), password);
    setSignedUp(true);
  }

  function handleSignIn() {
    if (!valid) return;
    void signIn(email.trim(), password);
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-base">Sign in</CardTitle>
        <CardDescription>
          Your account links to a Circle User-Controlled Wallet automatically — no separate
          user ID needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Email</p>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Password</p>
          <Input
            type="password"
            placeholder="min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleSignUp} disabled={isBusy || !valid}>
            {isBusy ? "Working…" : "Sign up"}
          </Button>
          <Button variant="outline" onClick={handleSignIn} disabled={isBusy || !valid}>
            Sign in
          </Button>
        </div>

        {signedUp && !error && (
          <div className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            Check your email to confirm your account, then sign in.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
