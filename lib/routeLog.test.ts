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

import { describe, expect, it, vi } from "vitest";

import { logRouteError } from "@/lib/routeLog";

describe("logRouteError", () => {
  it("logs the message, code and status, and nothing else from the error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("Request failed with status code 401"), {
      code: 155101,
      response: { status: 401, config: { headers: { Authorization: "Bearer TEST_API_KEY:secret" } } },
      config: { headers: { Authorization: "Bearer TEST_API_KEY:secret" } },
    });
    logRouteError("pin/setup", error);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual(["[pin/setup]", "Request failed with status code 401 code=155101 status=401"]);
  });

  it("copes with values that are not errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logRouteError("x", "plain string");
    logRouteError("x", null);
    logRouteError("x", undefined);
    expect(spy.mock.calls.map((c) => c[1])).toEqual(["plain string", "null", "undefined"]);
  });
});
