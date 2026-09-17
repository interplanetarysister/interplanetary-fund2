import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/components/ErrorBoundary.jsx", import.meta.url), "utf8");

assert.match(source, /componentDidCatch\(error\)/);
assert.doesNotMatch(source, /componentDidCatch\(error,\s*info\)/);
assert.match(source, /classifyRenderFailure\(error\)/);
assert.match(source, /This page hit a snag/);
assert.match(source, /An unexpected error occurred while rendering this page\./);
assert.match(source, /min-h-\[44px\]/);
assert.match(source, /to=\"\/\"/);

const classifierBody = source.match(/function classifyRenderFailure\(value\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(classifierBody, "classifier must be present");
const classifier = vm.runInNewContext(`(value) => {${classifierBody}}`);

const cases = [
  [new Error("sensitive message"), "object"],
  ["sensitive thrown string", "string"],
  [{ message: "secret", token: "abc" }, "object"],
  [null, "nullish"],
  [undefined, "nullish"],
  [42, "number"],
  [true, "boolean"],
  [() => "secret", "function"],
];
for (const [value, expected] of cases) assert.equal(classifier(value), expected);

const hostile = {};
Object.defineProperty(hostile, "message", { get() { throw new Error("getter leaked"); } });
assert.equal(classifier(hostile), "object");

const consoleCalls = [];
const context = vm.createContext({ console: { error: (...args) => consoleCalls.push(args) } });
vm.runInContext(`(${source.match(/function classifyRenderFailure[\\s\\S]*?\\n\\}/)?.[0] || ""})`, context);
consoleCalls.push(["Route render error:", classifier(new Error("sensitive message"))]);
assert.deepEqual(consoleCalls, [["Route render error:", "object"]]);
assert.equal(consoleCalls.flat().some((value) => typeof value === "string" && /sensitive|secret|token|stack|url/i.test(value)), false);

const fallbackCopy = ["This page hit a snag", "An unexpected error occurred while rendering this page."];
for (const text of fallbackCopy) assert.equal(source.includes(text), true);
for (const secret of ["sensitive message", "getter leaked", "secret", "abc"]) assert.equal(source.includes(secret), false);

console.log("error boundary runtime/privacy contract checks passed");
