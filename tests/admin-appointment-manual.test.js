const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("worker/admin-api.js", "utf8");
const workerModule = import("data:text/javascript;base64," + Buffer.from(source + "\nexport function setTestMailer(fn){ sendEmail = fn; }\n").toString("base64"));

function mkDB(role = "validator") {
  const ran = [];
  const DB = {
    prepare(sql) {
      let args = [];
      return {
        bind(...v) { args = v; return this; },
        async first() {
          if (/FROM sessions/.test(sql)) return { username: "boss", expires_at: Math.floor(Date.now() / 1000) + 3600 };
          if (/SELECT username, name, role, active, must_change FROM users/.test(sql)) return { username: "boss", role, active: 1, name: "Boss" };
          if (/SELECT username FROM users WHERE username/.test(sql)) return { username: "marco" };
          // ensureCrmLink existence checks → pretend everything already exists (no extra inserts)
          if (/FROM customers WHERE lower/.test(sql)) return { id: 1 };
          if (/FROM customer_vehicles/.test(sql)) return { id: 2 };
          if (/FROM work_orders WHERE appointment_id/.test(sql)) return { id: 3 };
          return null;
        },
        async run() { ran.push(sql); return { meta: { changes: 1, last_row_id: 55 } }; },
      };
    },
    async batch(st) { const o = []; for (const s of st) o.push(await s.run()); return o; },
  };
  return { DB, ran };
}
function req(body, role) {
  return { ...mkDB(role) , request: new Request("https://garage-admin.autoservicebettenduerf.lu/appointments/manual", {
    method: "POST", headers: { Origin: "https://autoservicebettenduerf.lu", Cookie: "garage_session=x", "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) };
}
async function call(body, role = "validator") {
  const { default: worker, setTestMailer } = await workerModule;
  setTestMailer(async () => ({ ok: true, id: "m" }));
  const { DB, ran, request } = req(body, role);
  const jobs = [];
  const res = await worker.fetch(request, { DB }, { waitUntil(p) { jobs.push(p); } });
  await Promise.all(jobs);
  return { res, data: await res.json(), ran };
}
const base = { name: "Jean Muller", service: "Pneuwiessel", vehicle: "VW Golf", date: "2030-02-01", time: "09:30" };

test("validator can create a confirmed appointment by phone", async () => {
  const { res, data, ran } = await call(base);
  assert.equal(res.status, 200);
  assert.ok(data.id);
  const ins = ran.find(s => /INSERT INTO appointments/.test(s));
  assert.ok(ins, "appointment inserted");
  assert.match(ins, /'confirmed'/, "created as confirmed");
  assert.ok(ran.some(s => /INSERT INTO appointment_events.*Manuell ugeluecht/.test(s)) || ran.some(s => /appointment_events/.test(s)), "logged");
});

test("manual appointment with an email reports a queued confirmation mail", async () => {
  const { data } = await call({ ...base, email: "jean@example.com" });
  assert.equal(data.mailQueued, true);
});

test("missing date/time/name/service is rejected", async () => {
  for (const body of [{ ...base, date: "" }, { ...base, time: "" }, { ...base, name: "" }, { ...base, service: "" }]) {
    const { res, ran } = await call(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(!ran.some(s => /INSERT INTO appointments/.test(s)), "nothing inserted");
  }
});

test("viewers cannot create appointments", async () => {
  const { res } = await call(base, "viewer");
  assert.equal(res.status, 403);
});
