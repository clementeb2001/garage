const fs = require("node:fs");
const path = require("node:path");
const { execute } = require("./d1_cli");
const schema = require("../worker/admin-schema.json");
function tableNames() {
  return [...new Set(schema.flatMap(group => [
    ...group.create.map(sql => sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1]),
    ...group.columns.map(column => column.table),
  ]))];
}
function planSchema(snapshot) {
  if (!snapshot.tables.bookings) throw new Error("Existing bookings table is required; bootstrap is a separate operation");
  const tables = Object.fromEntries(Object.entries(snapshot.tables).map(([name, columns]) => [name, new Set(columns)]));
  const statements = [], indexes = new Set(snapshot.indexes);
  // Tables and columns must be ready before indexes are created.
  for (const group of schema) {
    for (const sql of group.create) {
      const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      if (!tables[name]) {
        statements.push(sql);
        tables[name] = new Set([...sql.matchAll(/(?:\(|,\s*)(\w+)\s+(?:TEXT|INTEGER|REAL)\b/g)].map(match => match[1]));
      }
    }
    for (const { table, definition } of group.columns) {
      if (!tables[table]) throw new Error(`Missing prerequisite table: ${table}`);
      const column = definition.split(" ")[0];
      if (!tables[table].has(column)) {
        statements.push(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
        tables[table].add(column);
      }
    }
  }
  for (const group of schema) for (const sql of group.indexes) {
    const match = sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/);
    if (!match) throw new Error(`Unsupported index definition: ${sql}`);
    const name = match[1];
    if (!indexes.has(name)) { statements.push(sql); indexes.add(name); }
  }
  return statements;
}
function main() {
  const names = tableNames();
  const sql = "SELECT name,type FROM sqlite_master WHERE type IN ('table','index');" + names.map(name => `PRAGMA table_info(${name});`).join("");
  const result = execute(["--command", sql]);
  if (result.length !== names.length + 1) throw new Error("Incomplete schema inspection");
  const objects = result[0].results;
  const snapshot = { tables: {}, indexes: objects.filter(row => row.type === "index").map(row => row.name) };
  names.forEach((name, index) => {
    if (objects.some(row => row.type === "table" && row.name === name)) snapshot.tables[name] = result[index + 1].results.map(row => row.name);
  });
  const statements = planSchema(snapshot);
  if (!statements.length) { console.log("Admin schema is current; no writes needed."); return; }
  const file = path.resolve(__dirname, "../worker/admin-schema-pending.sql");
  fs.writeFileSync(file, statements.join(";\n") + ";\n");
  execute(["--file", file]);
  console.log(`Applied ${statements.length} missing schema definitions; no seed or business-data updates.`);
}
if (require.main === module) main();
module.exports = { planSchema, tableNames };
