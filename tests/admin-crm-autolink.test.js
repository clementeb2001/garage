const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("worker/admin-api.js", "utf8");
const workerModule = import("data:text/javascript;base64," + Buffer.from(source + "\nexport function setTestMailer(fn){ sendEmail = fn; }\n").toString("base64"));

// Appointment being confirmed: a real customer with a vehicle, not yet in the CRM.
const appt = { id: 7, kind: "appointment", status: "new", name: "Jean Muller", email: "jean@example.com", phone: "621 00 00", service: "Pneuwiessel", vehicle: "VW Golf", vin: "WVWABC", msg: "4 Pneuen", duration_min: 120, assigned_to: "marco", confirmed_date: null, confirmed_time: null, lang: "lb" };

function run(opts = {}) {
  const inserts = [], updates = [];
  const exists = Object.assign({ customer: false, vehicle: false, workorder: false }, opts.exists || {});
  const DB = {
    prepare(sql) {
      let args = [];
      return {
        bind(...v) { args = v; return this; },
        async first() {
          if (/FROM sessions/.test(sql)) return { username: "staff", expires_at: Math.floor(Date.now() / 1000) + 3600 };
          if (/SELECT username, name, role, active, must_change FROM users/.test(sql)) return { username: "staff", role: "validator", active: 1, name: "Staff" };
          if (/SELECT username FROM users WHERE username/.test(sql)) return { username: "marco" };
          if (/FROM appointments WHERE id/.test(sql)) return appt;
          if (/FROM customers WHERE lower/.test(sql)) return exists.customer ? { id: 100 } : null;
          if (/FROM customer_vehicles WHERE customer_id/.test(sql)) return exists.vehicle ? { id: 200 } : null;
          if (/FROM work_orders WHERE appointment_id/.test(sql)) return exists.workorder ? { id: 300 } : null;
          return null;
        },
        async run() {
          if (/^INSERT/.test(sql)) inserts.push(sql);
          if (/^UPDATE/.test(sql)) updates.push(sql);
          return { meta: { changes: 1, last_row_id: /customers/.test(sql) ? 100 : /customer_vehicles/.test(sql) ? 200 : /work_orders/.test(sql) ? 300 : 1 } };
        },
      };
    },
    async batch(st) { return Promise.all(st.map(s => s.run())); },
  };
  return { DB, inserts, updates };
}

async function confirm(envExtra) {
  const { default: worker, setTestMailer } = await workerModule;
  setTestMailer(async () => ({ ok: true, id: "mock" }));
  const { DB, inserts, updates } = envExtra;
  const jobs = [];
  const req = new Request("https://garage-admin.autoservicebettenduerf.lu/appointments/7/status", {
    method: "POST",
    headers: { Origin: "https://autoservicebettenduerf.lu", Cookie: "garage_session=x", "Content-Type": "application/json" },
    body: JSON.stringify({ status: "confirmed", date: "2030-02-01", time: "09:30" }),
  });
  const res = await worker.fetch(req, { DB }, { waitUntil(p) { jobs.push(p); } });
  await Promise.all(jobs);
  return { res, data: await res.json(), inserts, updates };
}

test("confirming an appointment creates customer, vehicle and a linked work order", async () => {
  const env = run();
  const { res, data, inserts } = await confirm(env);
  assert.equal(res.status, 200);
  assert.equal(data.confirmedTime, "09:30");
  assert.ok(inserts.some(s => s.startsWith("INSERT INTO customers")), "customer inserted");
  assert.ok(inserts.some(s => s.startsWith("INSERT INTO customer_vehicles")), "vehicle inserted");
  assert.ok(inserts.some(s => s.startsWith("INSERT INTO work_orders")), "work order inserted");
  assert.ok(inserts.some(s => s.startsWith("INSERT INTO work_order_events")), "work order event logged");
});

test("auto-link is idempotent: nothing re-created when the records already exist", async () => {
  const env = run({ exists: { customer: true, vehicle: true, workorder: true } });
  const { res, inserts } = await confirm(env);
  assert.equal(res.status, 200);
  assert.ok(!inserts.some(s => s.startsWith("INSERT INTO customers")), "no duplicate customer");
  assert.ok(!inserts.some(s => s.startsWith("INSERT INTO customer_vehicles")), "no duplicate vehicle");
  assert.ok(!inserts.some(s => s.startsWith("INSERT INTO work_orders")), "no duplicate work order");
});
