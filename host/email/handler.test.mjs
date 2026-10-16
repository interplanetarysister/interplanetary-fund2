import { test } from "node:test";
import assert from "node:assert/strict";
import { handleOfficialEmail } from "./handler.mjs";
import { signPayload } from "./signature.mjs";

const secret = "z".repeat(48);
const mailboxes = "support@interplanetaryfund.com,info@interplanetaryfund.com";
const raw = "From: sender@example.net\r\nTo: support@interplanetaryfund.com\r\nSubject: Test\r\nMessage-ID: <a@example.net>\r\n\r\nHello.";
const bytes = new TextEncoder().encode(raw);

function message(to = "support@interplanetaryfund.com", rawSize = bytes.byteLength) {
  return {
    from: "sender@example.net",
    to,
    rawSize,
    raw: new Blob([bytes]).stream(),
    headers: new Headers({ subject: "Test" }),
    rejected: null,
    setReject(reason) { this.rejected = reason; },
  };
}

function env(put = async () => {}) {
  return {
    IFUND_MAIL_ALLOWED_ADDRESSES: mailboxes,
    IFUND_MAIL_INGEST_ENDPOINT: "https://api.example.net/inbox/ingest",
    IFUND_MAIL_INGEST_SHARED_SECRET: secret,
    IFUND_MAIL_ARCHIVE: { put },
  };
}

const parseEmail = async () => ({
  subject: "Test", text: "Hello.", attachments: [{ filename: "a.txt" }],
});

test("approved support and info mailboxes persist before confirmed ingress", async () => {
  for (const address of ["support@interplanetaryfund.com", "info@interplanetaryfund.com"]) {
    const order = [];
    let savedKey = "";
    await handleOfficialEmail(message(address), env(async (key, data) => {
      order.push("archive");
      savedKey = key;
      assert.equal(data.byteLength, bytes.byteLength);
    }), {
      parseEmail,
      post: async (url, init) => {
        order.push("ingress");
        assert.equal(String(url), "https://api.example.net/inbox/ingest");
        const sent = JSON.parse(init.body);
        assert.equal(sent.to, address);
        assert.equal(sent.from, "sender@example.net");
        assert.equal(sent.attachment_count, 1);
        assert.equal(sent.text, "Hello.");
        assert.equal(init.headers["x-ifund-mail-signature"], await signPayload(
          init.body, init.headers["x-ifund-mail-timestamp"], secret
        ));
        assert.match(savedKey, /^received\/[a-f0-9]{64}\/[a-f0-9]{64}\.eml$/);
        return Response.json({ ok: true });
      },
    });
    assert.deepEqual(order, ["archive", "ingress"]);
  }
});

test("rejects unauthorised addresses without reading or storing content", async () => {
  const item = message("stranger@interplanetaryfund.com");
  await handleOfficialEmail(item, {}, {});
  assert.match(item.rejected, /does not accept/i);
});

test("oversized email is rejected before archive", async () => {
  const item = message("support@interplanetaryfund.com", 25 * 1024 * 1024 + 1);
  await handleOfficialEmail(item, env(), { parseEmail });
  assert.match(item.rejected, /exceeds/i);
});

test("plaintext ingress URLs are rejected", async () => {
  const config = env();
  config.IFUND_MAIL_INGEST_ENDPOINT = "http://api.example.net/ingest";
  await assert.rejects(handleOfficialEmail(message(), config, { parseEmail }), /HTTPS/);
});

test("archive failure prevents downstream delivery", async () => {
  let called = false;
  await assert.rejects(handleOfficialEmail(message(), env(async () => {
    throw new Error("archive offline");
  }), { parseEmail, post: async () => { called = true; } }), /archive offline/);
  assert.equal(called, false);
});

test("downstream failures never masquerade as successful inbox receipt", async () => {
  await assert.rejects(handleOfficialEmail(message(), env(), {
    parseEmail,
    post: async () => Response.json({ error: "no" }, { status: 503 }),
  }), /HTTP 503/);
  await assert.rejects(handleOfficialEmail(message(), env(), {
    parseEmail,
    post: async () => Response.json({ ok: false }),
  }), /did not confirm receipt/);
});
