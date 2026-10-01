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
import { UserMenu } from "@/components/UserMenu";
import { useUcwSession } from "@/contexts/UcwSessionContext";
import { useAuthSession } from "@/contexts/AuthContext";

vi.mock("@/contexts/UcwSessionContext", () => ({ useUcwSession: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuthSession: vi.fn() }));

const mockedUseUcwSession = vi.mocked(useUcwSession);
const mockedUseAuthSession = vi.mocked(useAuthSession);

function baseUcwSession(overrides: Partial<ReturnType<typeof useUcwSession>> = {}) {
  return {
    resetPin: vi.fn(),
    recoverPin: vi.fn(),
    disconnect: vi.fn(),
    needsWalletSetup: false,
    ...overrides,
  } as ReturnType<typeof useUcwSession>;
}

function baseAuthSession(overrides: Partial<ReturnType<typeof useAuthSession>> = {}) {
  return {
    user: { email: "person@example.com" },
    signOut: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuthSession>;
}

beforeEach(() => {
  mockedUseUcwSession.mockReset();
  mockedUseAuthSession.mockReset();
});

describe("UserMenu", () => {
  it("shows the signed-in user's email as the trigger", () => {
    mockedUseUcwSession.mockReturnValue(baseUcwSession());
    mockedUseAuthSession.mockReturnValue(
      baseAuthSession({ user: { email: "a@b.com" } as ReturnType<typeof useAuthSession>["user"] }),
    );

    render(<UserMenu />);
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
  });

  // Regression test: Reset/Recover PIN only make sense for a user who
  // already has a wallet and PIN — needsWalletSetup is Circle's signal for
  // "this is a brand new user".
  it("hides Reset/Recover PIN for a brand-new user (needsWalletSetup)", async () => {
    mockedUseUcwSession.mockReturnValue(baseUcwSession({ needsWalletSetup: true }));
    mockedUseAuthSession.mockReturnValue(baseAuthSession());

    render(<UserMenu />);
    await userEvent.click(screen.getByText("person@example.com"));

    // The menu opens asynchronously (floating-ui positions it after a
    // tick), so wait for an item rather than querying synchronously.
    expect(await screen.findByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /reset pin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /recover pin/i })).not.toBeInTheDocument();
  });

  it("offers Reset PIN and Recover PIN for a returning user, wired to the right handlers", async () => {
    const resetPin = vi.fn();
    const recoverPin = vi.fn();
    mockedUseUcwSession.mockReturnValue(
      baseUcwSession({ needsWalletSetup: false, resetPin, recoverPin }),
    );
    mockedUseAuthSession.mockReturnValue(baseAuthSession());

    render(<UserMenu />);
    await userEvent.click(screen.getByText("person@example.com"));
    await userEvent.click(await screen.findByRole("menuitem", { name: /reset pin/i }));
    expect(resetPin).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText("person@example.com"));
    await userEvent.click(await screen.findByRole("menuitem", { name: /recover pin/i }));
    expect(recoverPin).toHaveBeenCalledTimes(1);
  });

  it("signs out via disconnect() + signOut() when Sign out is clicked", async () => {
    const disconnect = vi.fn();
    const signOut = vi.fn();
    mockedUseUcwSession.mockReturnValue(baseUcwSession({ disconnect }));
    mockedUseAuthSession.mockReturnValue(baseAuthSession({ signOut }));

    render(<UserMenu />);
    await userEvent.click(screen.getByText("person@example.com"));
    await userEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
