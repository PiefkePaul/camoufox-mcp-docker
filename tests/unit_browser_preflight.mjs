import assert from "node:assert/strict";
import { MISSING_BROWSER_MESSAGE, assertBrowserBinaryAvailable } from "../dist/browser-runtime.js";

// Binary missing: probe throws -> preflight throws the actionable fetch message.
assert.throws(
  () => assertBrowserBinaryAvailable(() => { throw new Error("Please run camoufox fetch to install"); }),
  (error) => {
    assert.match(error.message, /camoufox-js(@\d+\.\d+\.\d+)? fetch/, "error should name the fetch command");
    assert.equal(error.message, MISSING_BROWSER_MESSAGE);
    return true;
  },
);

// Binary present: probe returns a path -> preflight does not throw.
assert.doesNotThrow(() => assertBrowserBinaryAvailable(() => "/cache/camoufox/Camoufox"));

console.log("browser preflight unit tests passed");
