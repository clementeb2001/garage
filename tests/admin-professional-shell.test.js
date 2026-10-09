const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "intern/index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "intern/intern.js"), "utf8");

test("professional admin shell keeps all operational areas wired", () => {
  for (const page of ["dashboard", "requests", "planner", "customers", "workorders", "wartung", "bookings", "analyse", "system"]) {
    assert.match(html, new RegExp(`data-page="${page}"`));
    assert.match(html, new RegExp(`id="page-${page}"`));
  }
  assert.match(script, /function renderRequests\(\)/);
  assert.match(script, /function renderPlanner\(\)/);
  assert.match(script, /function renderSystem\(\)/);
});

test("system view uses authenticated backup endpoints", () => {
  assert.match(script, /api\("\/backups"\)/);
  assert.match(script, /api\("\/backup\/run"/);
  assert.match(script, /can\("members\.manage"\)/);
});
