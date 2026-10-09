const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const api = fs.readFileSync(path.join(root, "worker/admin-api.js"), "utf8");
const html = fs.readFileSync(path.join(root, "intern/index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "intern/intern.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "worker/business-migrations.sql"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/deploy-worker.yml"), "utf8");

test("CRM migration is additive and repeat-safe", () => {
  assert.doesNotMatch(migration, /\b(?:DELETE|DROP|TRUNCATE)\b/i);
  assert.match(migration, /NOT EXISTS[\s\S]*customers/i);
  assert.match(migration, /NOT EXISTS[\s\S]*work_orders/i);
});

test("production database is exported before schema migration", () => {
  const backup = workflow.indexOf("d1 export garage-admin");
  const schema = workflow.indexOf("- name: Apply only missing admin schema definitions");
  assert(backup > 0 && schema > backup);
  assert.match(workflow, /retention-days: 14/);
});

test("customer and work-order modules are wired end to end", () => {
  for (const route of ["/customers", "/work-orders"]) assert.match(api, new RegExp(route.replace("/", "\\/")));
  for (const page of ["page-customers", "page-workorders"]) assert.match(html, new RegExp(`id="${page}"`));
  assert.match(ui, /function renderCustomers\(/);
  assert.match(ui, /function renderWorkOrders\(/);
});
