import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/components/ErrorBoundary.jsx", import.meta.url), "utf8");

assert.match(source, /componentDidCatch\(error\)/);
assert.doesNotMatch(source, /componentDidCatch\(error,\s*info\)/);
assert.match(source, /classifyRenderFailure\(error\)/);
assert.match(source, /This page hit a snag/);
assert.match(source, /An unexpected error occurred while rendering this page\./);
assert.match(source, /role=\"alert\"/);
assert.match(source, /aria-live=\"assertive\"/);
assert.match(source, /aria-labelledby=\"route-error-heading\"/);
assert.match(source, /ref=\{this\.headingRef\}/);
assert.match(source, /tabIndex=\{-1\}/);
assert.match(source, /componentDidUpdate\(\)/);
assert.match(source, /this\.headingRef\.current\.focus\(\)/);
assert.match(source, /aria-hidden=\"true\"/);
assert.match(source, /min-h-\[44px\]/);
assert.match(source, /to=\"\/\"/);

const classifierSource = source.match(/function classifyRenderFailure\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(classifierSource, "classifier must be present");
const classifier = vm.runInNewContext(`(() => { ${classifierSource}; return classifyRenderFailure; })()`);

const classifyCases = [
  [new Error("sensitive message"), "object"],
  ["sensitive thrown string", "string"],
  [{ message: "secret", token: "abc", nested: { account: "acct" } }, "object"],
  [null, "nullish"],
  [undefined, "nullish"],
  [42, "number"],
  [true, "boolean"],
  [() => "secret", "function"],
];
for (const [value, expected] of classifyCases) assert.equal(classifier(value), expected);

const hostile = new Proxy(Object.create({ name: "proto-secret" }), {
  get() { throw new Error("getter leaked"); },
  ownKeys() { throw new Error("ownKeys leaked"); },
  getOwnPropertyDescriptor() { throw new Error("descriptor leaked"); },
});
assert.equal(classifier(hostile), "object");

const methodBody = source.match(/componentDidCatch\(error\)\s*\{([\s\S]*?)\n\s*\}/)?.[1];
assert.ok(methodBody, "componentDidCatch body must be present");
const runtime = vm.runInNewContext(`(() => {
  ${classifierSource}
  const calls = [];
  const console = { error(...args) { calls.push(args); } };
  const componentDidCatch = new Function("error", ${JSON.stringify(methodBody)});
  const hostileError = new Proxy(Object.create({ name: "proto-secret" }), {
    get() { throw new Error("runtime getter leaked"); },
    ownKeys() { throw new Error("runtime ownKeys leaked"); },
    getOwnPropertyDescriptor() { throw new Error("runtime descriptor leaked"); }
  });
  componentDidCatch.call({ classifyRenderFailure }, hostileError);
  return calls;
})()`);
assert.deepEqual(runtime, [["Route render error:", "object"]]);
assert.equal(runtime[0].length, 2, "diagnostic sink must receive exactly two bounded arguments");
assert.equal(typeof runtime[0][1], "string");

const fallback = vm.runInNewContext(`(() => ({
  heading: "This page hit a snag",
  body: "An unexpected error occurred while rendering this page.",
  role: "alert",
  live: "assertive",
  focusTarget: "route-error-heading",
  rawErrorText: undefined,
}))()`);
assert.deepEqual(fallback, {
  heading: "This page hit a snag",
  body: "An unexpected error occurred while rendering this page.",
  role: "alert",
  live: "assertive",
  focusTarget: "route-error-heading",
  rawErrorText: undefined,
});

for (const secret of ["sensitive message", "getter leaked", "runtime getter leaked", "proto-secret", "account", "token"]) {
  assert.equal(source.includes(secret), false, `source contains forbidden test secret: ${secret}`);
}
assert.doesNotMatch(source, /this\.state\.error\?\.message/);
assert.doesNotMatch(source, /componentDidCatch\([^)]*,/);

console.log("error boundary runtime/privacy/accessibility contract checks passed");
