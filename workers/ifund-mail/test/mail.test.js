import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

function environment() {
  const rows = new Map();
  const objects = new Map();
  const env = {
    MAIL_API_TOKEN: "only-for-local-test-32-character-token-123456",
    MAIL_DB: {
      prepare(query) {
        return {
          bind(...params) {
            return {
              async run() {
                if (query.includes("INSERT OR IGNORE")) {
                  const [id, recipient, sender, subject, preview, body_text, received_at, raw_key, raw_size] = params;
                  if (!rows.has(id)) rows.set(id, {id, recipient, sender, subject, preview, body_text, received_at, raw_key, raw_size, is_read:0});
                  return {meta:{changes:1}};
                }
                if (query.includes("UPDATE mailbox_messages")) {
                  const row = rows.get(params[0]);
                  if (row) row.is_read = 1;
                  return {meta:{changes:row ? 1 : 0}};
                }
                throw new Error("Unexpected query");
              },
              async all() {
                if (!query.includes("SELECT id, recipient")) throw new Error("Unexpected query");
                return {results:Array.from(rows.values()).map(({body_text,raw_key,raw_size,...rest})=>rest)};
              },
              async first() {
                const row=rows.get(params[0]);
                if (!row) return null;
                const {raw_key,raw_size,preview,...visible} = row;
                return visible;
              },
            };
          },
        };
      },
    },
    MAIL_RAW: {
      async put(key, data) { objects.set(key, data); },
      async delete(key) { objects.delete(key); },
    },
  };
  return {env, rows, objects};
}
function incoming(to, content = "Hello, support team.") {
  const raw = [
    "From: Person <person@example.net>",
    "To: " + to,
    "Subject: Question about fundraising",
    "Message-ID: <test@example.net>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    content,
    "",
  ].join("\r\n");
  const data = new TextEncoder().encode(raw);
  let rejected = null;
  return {
    to, from: "person@example.net", rawSize: data.byteLength,
    raw: new ReadableStream({start(controller) {
      controller.enqueue(data);
      controller.close();
    }}),
    setReject(reason) { rejected=reason; },
    get rejected() { return rejected; },
  };
}
function request(path, token) {
  const headers = token ? {Authorization:"Bearer " + token} : {};
  return new Request("https://mail.example.test" + path, {headers});
}

test("inbound mail is private, deduplicated, and readable only through bearer authentication", async () => {
  const {env,rows,objects}=environment();
  const mail=incoming("support@interplanetaryfund.com");
  await worker.email(mail,env);
  assert.equal(mail.rejected,null);
  assert.equal(rows.size,1);
  assert.equal(objects.size,1);
  const unauthorized=await worker.fetch(request("/api/messages"),env);
  assert.equal(unauthorized.status,401);
  const list=await worker.fetch(request("/api/messages",env.MAIL_API_TOKEN),env);
  assert.equal(list.status,200);
  const payload=await list.json();
  assert.equal(payload.messages.length,1);
  assert.equal(payload.messages[0].sender,"person@example.net");
  assert.equal(payload.messages[0].body_text,undefined);
  const id=payload.messages[0].id;
  const full=await worker.fetch(request("/api/messages/"+id,env.MAIL_API_TOKEN),env);
  assert.equal((await full.json()).message.body_text,"Hello, support team.");
  const marked=await worker.fetch(new Request("https://mail.example.test/api/messages/"+id+"/read", {
    method:"POST",headers:{Authorization:"Bearer "+env.MAIL_API_TOKEN}
  }),env);
  assert.equal((await marked.json()).ok,true);
  assert.equal(rows.get(id).is_read,1);
});

test("unknown mailbox is rejected without storing contents",async()=>{
  const {env,rows}=environment();
  const message=incoming("stranger@interplanetaryfund.com");
  await worker.email(message,env);
  assert.match(message.rejected,/Mailbox not found/);
  assert.equal(rows.size,0);
});

test("oversize mail is rejected before parsing",async()=>{
  const {env,rows}=environment();
  const message=incoming("admin@interplanetaryfund.com");
  message.rawSize=11*1024*1024;
  await worker.email(message,env);
  assert.match(message.rejected,/10 MB/);
  assert.equal(rows.size,0);
});
