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

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PinLogin } from "@/components/PinLogin";
import { useUcwSession } from "@/contexts/UcwSessionContext";
import { useAuthSession } from "@/contexts/AuthContext";

vi.mock("@/contexts/UcwSessionContext", () => ({ useUcwSession: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuthSession: vi.fn() }));

const mockedUseUcwSession = vi.mocked(useUcwSession);
const mockedUseAuthSession = vi.mocked(useAuthSession);

function baseUcwSession(overrides: Partial<ReturnType<typeof useUcwSession>> = {}) {
  return {
    createWallet: vi.fn(),
    resetPin: vi.fn(),
    recoverPin: vi.fn(),
    disconnect: vi.fn(),
    needsWalletSetup: false,
    isBusy: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useUcwSession>;
}

function baseAuthSession(overrides: Partial<ReturnType<typeof useAuthSession>> = {}) {
  return { signOut: vi.fn(), isBusy: false, ...overrides } as ReturnType<typeof useAuthSession>;
}

beforeEach(() => {
  mockedUseUcwSession.mockReset();
  mockedUseAuthSession.mockReset();
});

describe("PinLogin sign-out escape hatch", () => {
  // Regression test: a user stuck on "Restoring your session…" (waiting on
  // auto-resume) or on the wallet-setup screen previously had no way out
  // except closing the tab.
  it("offers a sign-out button while restoring the session, and it disconnects + signs out", async () => {
    const disconnect = vi.fn();
    const signOut = vi.fn();
    mockedUseUcwSession.mockReturnValue(baseUcwSession({ needsWalletSetup: false, disconnect }));
    mockedUseAuthSession.mockReturnValue(baseAuthSession({ signOut }));

    render(<PinLogin />);
    expect(screen.getByText(/restoring your session/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("offers a sign-out button on the wallet-setup screen", async () => {
    const disconnect = vi.fn();
    const signOut = vi.fn();
    mockedUseUcwSession.mockReturnValue(baseUcwSession({ needsWalletSetup: true, disconnect }));
    mockedUseAuthSession.mockReturnValue(baseAuthSession({ signOut }));

    render(<PinLogin />);
    expect(screen.getByText("Setting up your Circle wallet")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe("PinLogin new-user wallet setup", () => {
  // Regression test: wallet creation used to require a manual "Create
  // wallet" click, and showed Reset/Recover PIN buttons that make no sense
  // for someone who has no wallet or PIN yet. Creation is now auto-triggered
  // by UcwSessionContext, so this screen shouldn't offer either action while
  // things are working normally.
  it("shows no action buttons (besides Sign out) while auto-creation is in progress", () => {
    mockedUseUcwSession.mockReturnValue(
      baseUcwSession({ needsWalletSetup: true, isBusy: true, error: null }),
    );
    mockedUseAuthSession.mockReturnValue(baseAuthSession());

    render(<PinLogin />);
    expect(screen.queryByRole("button", { name: /create wallet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset pin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recover pin/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("offers a Try again button (not Reset/Recover PIN) once auto-creation has failed", async () => {
    const createWallet = vi.fn();
    mockedUseUcwSession.mockReturnValue(
      baseUcwSession({
        needsWalletSetup: true,
        isBusy: false,
        error: "Your hint can't be the same as the answer.",
        createWallet,
      }),
    );
    mockedUseAuthSession.mockReturnValue(baseAuthSession());

    render(<PinLogin />);
    expect(screen.getByText("Your hint can't be the same as the answer.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset pin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recover pin/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(createWallet).toHaveBeenCalledTimes(1);
  });
});

describe("PinLogin returning-user session resume", () => {
  // Reset/Recover PIN live in the header UserMenu instead (see
  // UserMenu.test.tsx) — they're always reachable there once signed in, not
  // just after a failed resume. PinLogin itself never renders them.
  it("never shows Reset/Recover PIN buttons, even after auto-resume has failed", () => {
    mockedUseUcwSession.mockReturnValue(
      baseUcwSession({ needsWalletSetup: false, isBusy: false, error: "PIN entry failed" }),
    );
    mockedUseAuthSession.mockReturnValue(baseAuthSession());

    render(<PinLogin />);
    expect(screen.getByText("PIN entry failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset pin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recover pin/i })).not.toBeInTheDocument();
  });
});
