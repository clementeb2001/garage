const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const script = fs.readFileSync("intern/intern.js", "utf8");
const html = fs.readFileSync("intern/index.html", "utf8");
const sw = fs.readFileSync("intern/sw.js", "utf8");

test("calendar jump clears stale appointment search before focusing the card", () => {
  const start = script.indexOf("  function focusAppointment(id)");
  const end = script.indexOf("\n  function openDay(dkey)", start);
  assert.ok(start > -1 && end > start);
  const search = { value: "AB-R-999" };
  const card = { classList: { add() {}, remove() {} }, scrollIntoView() {} };
  const ctx = {
    reqState: { appointment: { filter: "new", query: "AB-R-999" } },
    closeDay() {},
    gotoPage(page) { ctx.page = page; },
    $(id) { return id === "appt-search" ? search : null; },
    document: { getElementById(id) { return id === "req-appointment-42" ? card : null; } },
    setTimeout(fn) { fn(); }
  };
  vm.createContext(ctx);
  vm.runInContext(script.slice(start, end), ctx);
  ctx.focusAppointment(42);
  assert.equal(ctx.reqState.appointment.query, "");
  assert.equal(ctx.reqState.appointment.filter, "all");
  assert.equal(search.value, "");
  assert.equal(ctx.page, "appointments");
});

test("day schedule always shows the hour grid with an availability note and safe mobile overlap", () => {
  assert.match(script, /day-sched-note/);
  // The hour grid (day-sched-scroll) is used for every day, scheduled or free.
  assert.match(script, /scheduled\.length \? gridWrap : \(/);
  assert.match(script, /maxCols > 2/);
  assert.match(script, /maxCols \* 150/);
  assert.match(html, /\.day-sched-scroll[^}]*overflow-x:\s*auto/);
  assert.match(script, /Nach net zougewisen/);
});

test("day dialog is modal, labelled and keyboard managed", () => {
  assert.match(html, /class="daycard" role="dialog" aria-modal="true" aria-labelledby="day-title" tabindex="-1"/);
  assert.match(script, /dayReturnFocus/);
  assert.match(script, /e\.key !== "Tab"/);
  assert.match(script, /closeDay\(true\)/);
});

test("PWA cache and page reference the same current admin script", () => {
  const pageVersion = html.match(/intern\.js\?v=(\d+)/)[1];
  const cachedVersion = sw.match(/intern\.js\?v=(\d+)/)[1];
  assert.equal(cachedVersion, pageVersion);
  assert.equal(pageVersion, "82");
  assert.match(sw, /ab-intern-v83/);
});
