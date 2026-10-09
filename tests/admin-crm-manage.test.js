const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("worker/admin-api.js", "utf8");
const workerModule = import("data:text/javascript;base64," + Buffer.from(source + "\nexport {};\n").toString("base64"));

function mkDB(rows = {}, role = "admin") {
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
          if (/FROM customer_vehicles WHERE customer_id=\?1 AND lower/.test(sql)) return rows.vehicleDupe || null;
          if (/FROM customer_vehicles WHERE id/.test(sql)) return rows.vehicle === undefined ? { id: 5 } : rows.vehicle;
          if (/FROM customers WHERE id/.test(sql)) return rows.customer === undefined ? { id: 1 } : rows.customer;
          if (/FROM work_orders WHERE id/.test(sql)) return rows.workorder === undefined ? { id: 9 } : rows.workorder;
          if (/FROM appointments WHERE id/.test(sql)) return { id: 3 };
          return null;
        },
        async run() { ran.push(sql); return { meta: { changes: 1, last_row_id: 50 } }; },
      };
    },
    async batch(st) { const out = []; for (const s of st) out.push(await s.run()); return out; },
  };
  return { DB, ran };
}
function req(path, method, body) {
  return new Request("https://garage-admin.autoservicebettenduerf.lu" + path, {
    method, headers: { Origin: "https://autoservicebettenduerf.lu", Cookie: "garage_session=x", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
}
const ctx = () => ({ waitUntil() {} });

test("adding a duplicate vehicle is rejected", async () => {
  const { default: worker } = await workerModule;
  const { DB, ran } = mkDB({ vehicleDupe: { id: 77 } });
  const res = await worker.fetch(req("/customers/1/vehicles", "POST", { makeModel: "VW Golf", vin: "WVW1" }), { DB }, ctx());
  assert.equal(res.status, 409);
  assert.ok(!ran.some(s => /INSERT INTO customer_vehicles/.test(s)), "no duplicate inserted");
});

test("admin can delete a vehicle; linked work orders are unlinked", async () => {
  const { default: worker } = await workerModule;
  const { DB, ran } = mkDB();
  const res = await worker.fetch(req("/customers/1/vehicles/5", "DELETE"), { DB }, ctx());
  assert.equal(res.status, 200);
  assert.ok(ran.some(s => /UPDATE work_orders SET vehicle_id=NULL/.test(s)));
  assert.ok(ran.some(s => /DELETE FROM customer_vehicles WHERE id/.test(s)));
});

test("admin can delete a work order with its events; non-admin cannot", async () => {
  const { default: worker } = await workerModule;
  const ok = mkDB();
  const resOk = await worker.fetch(req("/work-orders/9", "DELETE"), { DB: ok.DB }, ctx());
  assert.equal(resOk.status, 200);
  assert.ok(ok.ran.some(s => /DELETE FROM work_order_events/.test(s)));
  assert.ok(ok.ran.some(s => /DELETE FROM work_orders WHERE id/.test(s)));
  const no = mkDB({}, "validator");
  const resNo = await worker.fetch(req("/work-orders/9", "DELETE"), { DB: no.DB }, ctx());
  assert.equal(resNo.status, 403);
  assert.ok(!no.ran.some(s => /^DELETE/.test(s)));
});

test("deleting a customer archives rather than hard-deletes", async () => {
  const { default: worker } = await workerModule;
  const { DB, ran } = mkDB();
  const res = await worker.fetch(req("/customers/1", "DELETE"), { DB }, ctx());
  assert.equal(res.status, 200);
  assert.ok(ran.some(s => /UPDATE customers SET archived=1/.test(s)), "soft-deleted");
  assert.ok(!ran.some(s => /DELETE FROM customers/.test(s)), "not hard-deleted");
});

test("saving the appointment plan propagates mechanic and duration to the linked work order", async () => {
  const { default: worker } = await workerModule;
  const { DB, ran } = mkDB();
  const res = await worker.fetch(req("/appointments/3/plan", "POST", { assigned: "marco", duration: "90", planNote: "x" }), { DB }, ctx());
  assert.equal(res.status, 200);
  assert.ok(ran.some(s => /UPDATE work_orders SET assigned_to=\?1, planned_minutes=\?2.*WHERE appointment_id/.test(s)), "work order synced");
});
