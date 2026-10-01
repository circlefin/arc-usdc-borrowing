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
import { KitError } from "@circle-fin/borrow-kit";
import { serializeError } from "@/lib/kitErrorTypes";

describe("serializeError", () => {
  it("pulls code/name/type/recoverability off a real KitError", () => {
    const kitError = new KitError({
      name: "INPUT_VALIDATION_FAILED",
      message: "the Circle user has not completed wallet setup yet",
      code: 1098,
      type: "INPUT",
      recoverability: "FATAL",
    });
    expect(serializeError(kitError)).toEqual({
      message: "the Circle user has not completed wallet setup yet",
      code: 1098,
      name: "INPUT_VALIDATION_FAILED",
      type: "INPUT",
      recoverability: "FATAL",
    });
  });

  it("does not mistake a plain error-shaped object for a KitError", () => {
    const plainObject = {
      name: "INPUT_VALIDATION_FAILED",
      message: "looks like a KitError but isn't branded",
      code: 1098,
      type: "INPUT",
      recoverability: "FATAL",
    };
    expect(serializeError(plainObject)).toEqual({ message: "[object Object]" });
  });

  it("falls back to .message for a plain Error", () => {
    expect(serializeError(new Error("boom"))).toEqual({ message: "boom" });
  });

  it("stringifies anything else rather than losing it", () => {
    expect(serializeError("just a string")).toEqual({ message: "just a string" });
  });
});
