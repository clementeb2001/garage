const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("worker/admin-api.js", "utf8");
const workerModule = import("data:text/javascript;base64," + Buffer.from(source + "\nexport {};\n").toString("base64"));

function mkDB(role = "admin", settingsRows = []) {
  const ran = [];
  const stmt = (sql) => {
    let args = [];
    return {
      bind(...v) { args = v; return this; },
      async first() {
        if (/FROM sessions/.test(sql)) return { username: "boss", expires_at: Math.floor(Date.now() / 1000) + 3600 };
        if (/SELECT username, name, role, active, must_change FROM users/.test(sql)) return { username: "boss", role, active: 1, name: "Boss" };
        return null;
      },
      async all() { if (/FROM admin_settings/.test(sql)) return { results: settingsRows }; return { results: [] }; },
      async run() { ran.push({ sql, args }); return { meta: { changes: 1 } }; },
    };
  };
  return { DB: { prepare: stmt, async batch(st) { const o = []; for (const s of st) o.push(await s.run()); return o; } }, ran };
}
function req(method, body) {
  return new Request("https://garage-admin.autoservicebettenduerf.lu/settings", {
    method, headers: { Origin: "https://autoservicebettenduerf.lu", Cookie: "garage_session=x", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
}
const ctx = () => ({ waitUntil() {} });

test("GET /settings returns stored business settings", async () => {
  const { default: worker } = await workerModule;
  const { DB } = mkDB("validator", [{ key: "open_from", value: "08:00" }, { key: "default_duration", value: "90" }]);
  const res = await worker.fetch(req("GET"), { DB }, ctx());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.settings.open_from, "08:00");
  assert.equal(data.settings.default_duration, "90");
});

test("admin can save valid opening hours and default duration", async () => {
  const { default: worker } = await workerModule;
  const { DB, ran } = mkDB("admin");
  const res = await worker.fetch(req("POST", { openFrom: "07:30", openTo: "18:30", defaultDuration: "90" }), { DB }, ctx());
  assert.equal(res.status, 200);
  const writes = ran.filter(r => /INSERT INTO admin_settings/.test(r.sql));
  assert.equal(writes.length, 3, "three settings upserted");
});

test("invalid times and durations are rejected", async () => {
  const { default: worker } = await workerModule;
  for (const body of [
    { openFrom: "25:00", openTo: "18:00", defaultDuration: "60" },
    { openFrom: "18:00", openTo: "08:00", defaultDuration: "60" }, // from >= to
    { openFrom: "07:00", openTo: "19:00", defaultDuration: "5" },  // too short
    { openFrom: "07:00", openTo: "19:00", defaultDuration: "9999" },
  ]) {
    const { DB, ran } = mkDB("admin");
    const res = await worker.fetch(req("POST", body), { DB }, ctx());
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(!ran.some(r => /INSERT INTO admin_settings/.test(r.sql)), "nothing written");
  }
});

test("non-admin cannot change business settings", async () => {
  const { default: worker } = await workerModule;
  const { DB, ran } = mkDB("validator");
  const res = await worker.fetch(req("POST", { openFrom: "07:00", openTo: "19:00", defaultDuration: "60" }), { DB }, ctx());
  assert.equal(res.status, 403);
  assert.ok(!ran.some(r => /INSERT INTO admin_settings/.test(r.sql)));
});
