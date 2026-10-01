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

import { describe, expect, it } from "vitest";
import { humanize, rawMessage } from "@/lib/errors";

describe("rawMessage", () => {
  it("uses .message for a real Error", () => {
    expect(rawMessage(new Error("boom"))).toBe("boom");
  });

  // Regression test: the W3S SDK's challenge callback rejects with a plain
  // `{ code?, message }` object, not a real Error (see
  // @circle-fin/w3s-pw-web-sdk's `Error` type). Before this fix, that fell
  // through to `String(err)`, which stringifies a plain object as literally
  // "[object Object]" instead of showing the SDK's actual failure reason.
  it("extracts .message from a plain object that isn't an Error instance", () => {
    const sdkError = { code: 155110, message: "PIN entry was cancelled" };
    expect(rawMessage(sdkError)).toBe("PIN entry was cancelled");
  });

  it("returns empty string when the object has no message field at all", () => {
    // "[object Object]" is never worth showing or logging, so it's dropped.
    expect(rawMessage({ code: 500 })).toBe("");
  });

  it("stringifies primitives", () => {
    expect(rawMessage("already a string")).toBe("already a string");
    expect(rawMessage(42)).toBe("42");
  });
});

describe("humanize (wallet SDK failures)", () => {
  it("turns a cancelled PIN challenge into a plain-language message", () => {
    const parsed = humanize({ code: 155110, message: "PIN entry was cancelled" });
    expect(parsed.title).toBe("You cancelled the request.");
    expect(parsed.technical).toBe("PIN entry was cancelled");
  });

  it("never shows a messageless SDK object to the user", () => {
    expect(humanize({ code: 500 }).title).toBe("Something went wrong. Please try again.");
  });
});
