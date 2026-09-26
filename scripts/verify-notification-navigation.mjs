import fs from "node:fs";

const bell = fs.readFileSync("src/components/NotificationBell.jsx", "utf8");
const layout = fs.readFileSync("src/components/Layout.jsx", "utf8");

const required = [
  [bell, 'to="/notifications"', "NotificationBell must open the dedicated notifications surface"],
  [bell, 'Array.isArray(items) ? items : []', "NotificationBell must bound non-array responses"],
  [bell, 'if (!mounted || !me?.id) return;', "NotificationBell must fence auth completion after unmount"],
  [layout, 'aria-label="Go to inbox"', "Layout brand navigation remains explicitly review-gated"],
];

const missing = required.filter(([source, needle]) => !source.includes(needle));
if (missing.length) {
  throw new Error(`notification navigation contract failed: ${missing.map(([, , label]) => label).join("; ")}`);
}

if (bell.includes('to="/inbox"')) {
  throw new Error("NotificationBell must not route the bell itself to the generic inbox");
}

console.log("notification navigation contract passed");
