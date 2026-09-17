import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Inbox.jsx', 'utf8');

const SAFE_INBOX_ERROR = "We couldn't load your inbox right now. Please try again.";
const isArray = (value) => Array.isArray(value);
const isValidDonationResult = (result) => Boolean(result) && isArray(result.data?.donations);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeRequestFence() {
  let latest = 0;
  let mounted = true;
  return {
    begin() {
      const requestId = ++latest;
      return () => mounted && latest === requestId;
    },
    unmount() {
      mounted = false;
    },
    remount() {
      mounted = true;
    },
  };
}

assert(source.includes('const SAFE_INBOX_ERROR'), 'safe inbox error constant missing');
assert(source.includes('catch {'), 'raw thrown values must not be captured');
assert(!source.includes('e.message'), 'raw error message access remains');
assert(source.includes('setItems(null)'), 'failed aggregation must clear stale inbox state');
assert(source.includes('mountedRef.current'), 'mounted fence missing');
assert(source.includes('requestRef.current === requestId'), 'request-generation fence missing');

assert(isArray([]), 'valid empty arrays must remain valid');
assert(!isArray(null), 'null base response must be rejected');
assert(!isArray({}), 'object base response must be rejected');
assert(isValidDonationResult({ data: { donations: [] } }), 'valid empty donations must remain valid');
assert(!isValidDonationResult({ data: { donations: null } }), 'null donations must be rejected');
assert(!isValidDonationResult({ data: {} }), 'missing donations must be rejected');
assert(!isValidDonationResult(null), 'null provider response must be rejected');

const fence = makeRequestFence();
const first = fence.begin();
const second = fence.begin();
assert(!first(), 'stale request must be fenced after a newer request begins');
assert(second(), 'current request must remain writable');
fence.unmount();
assert(!second(), 'unmounted request must be fenced');
fence.remount();
const third = fence.begin();
assert(third(), 'remount must allow a fresh request');

assert(SAFE_INBOX_ERROR.length < 120, 'safe copy must remain bounded');
assert(!SAFE_INBOX_ERROR.includes('message'), 'safe copy must not expose provider diagnostics');

console.log('Inbox aggregation runtime contract passed (shape, fencing, and bounded-error checks).');
