import assert from "node:assert/strict";

const SAFE_NOTIFICATION_ERROR = "Notifications are temporarily unavailable. Please try again.";

function createLifecycleModel() {
  let mounted = false;
  let authGeneration = 0;
  let requestGeneration = 0;
  let notifications = [{ id: "known-good", read: false }];
  let error = null;
  const stateLog = [];

  const commit = (label, fn) => {
    stateLog.push(label);
    fn();
  };

  return {
    mount() {
      mounted = true;
      authGeneration += 1;
      error = null;
      return { authGeneration };
    },
    unmount() {
      mounted = false;
      authGeneration += 1;
      requestGeneration += 1;
    },
    changeAuth() {
      authGeneration += 1;
      requestGeneration += 1;
      error = null;
      return { authGeneration };
    },
    startLoad() {
      requestGeneration += 1;
      return { authGeneration, requestGeneration };
    },
    resolveAuth(token, userId) {
      if (!mounted || token !== authGeneration || !userId) return false;
      return true;
    },
    resolveLoad(token, rows) {
      if (!mounted || token.authGeneration !== authGeneration || token.requestGeneration !== requestGeneration) return false;
      if (!Array.isArray(rows)) return false;
      commit("load-success", () => {
        notifications = rows;
        error = null;
      });
      return true;
    },
    rejectLoad(token) {
      if (!mounted || token.authGeneration !== authGeneration || token.requestGeneration !== requestGeneration) return false;
      commit("load-error", () => {
        error = SAFE_NOTIFICATION_ERROR;
      });
      return true;
    },
    deliverSubscription(token, event) {
      if (!mounted || token !== authGeneration || event?.type !== "create") return false;
      const incoming = event?.data;
      if (!incoming || typeof incoming.id !== "string") return false;
      commit("subscription", () => {
        notifications = [incoming, ...notifications.filter((item) => item.id !== incoming.id)].slice(0, 20);
        error = null;
      });
      return true;
    },
    snapshot() {
      return { mounted, authGeneration, requestGeneration, notifications, error, stateLog: [...stateLog] };
    },
  };
}

const model = createLifecycleModel();
const firstMount = model.mount();
const authToken = firstMount.authGeneration;
const firstLoad = model.startLoad();

model.unmount();
assert.equal(model.resolveAuth(authToken, "user-1"), false, "late auth resolution must not commit after unmount");
assert.equal(model.resolveLoad(firstLoad, [{ id: "stale", read: false }]), false, "stale load must not commit after unmount");
assert.equal(model.snapshot().stateLog.length, 0);

const secondMount = model.mount();
const secondLoad = model.startLoad();
const newerLoad = model.startLoad();
assert.equal(model.resolveLoad(secondLoad, [{ id: "older", read: false }]), false, "older overlapping load must be fenced");
assert.equal(model.resolveLoad(newerLoad, [{ id: "fresh", read: false }]), true, "newest load may commit");
assert.deepEqual(model.snapshot().notifications.map((row) => row.id), ["fresh"]);

const subscriptionToken = model.snapshot().authGeneration;
assert.equal(model.deliverSubscription(subscriptionToken, { type: "create", data: { id: "fresh", read: true } }), true);
assert.deepEqual(model.snapshot().notifications.map((row) => row.id), ["fresh"]);
assert.equal(model.snapshot().notifications[0].read, true, "duplicate subscription delivery replaces by id instead of duplicating");

model.changeAuth();
assert.equal(model.deliverSubscription(subscriptionToken, { type: "create", data: { id: "late", read: false } }), false, "old subscription must not commit after auth change");
assert.equal(model.rejectLoad(newerLoad), false, "old request must not commit after auth change");

const beforeFailure = model.snapshot().notifications;
const activeLoad = model.startLoad();
assert.equal(model.rejectLoad(activeLoad), true);
assert.deepEqual(model.snapshot().notifications, beforeFailure, "load failure preserves last known-good list");
assert.equal(model.snapshot().error, SAFE_NOTIFICATION_ERROR, "raw provider/backend error text is never stored");

console.log("NotificationBell lifecycle contract passed");
