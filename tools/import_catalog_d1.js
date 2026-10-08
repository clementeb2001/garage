const fs = require("node:fs");
const path = require("node:path");
const { execute } = require("./d1_cli");
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function isComplete(manifest, version, results) {
  if (!Array.isArray(results) || results.length !== 3) throw new Error("Incomplete catalog inspection");
  const info = results[0].results[0], counts = results[1].results[0], rows = results[2].results;
  if (!info || !counts || !Array.isArray(rows)) return false;
  const meta = version === manifest.legacyVersion ? manifest.legacyMeta : manifest.basicMeta;
  if (Number(info.product_count) !== manifest.products || Number(info.remus_count) !== manifest.remus || Number(info.dba_count) !== manifest.dba || !sameJson(JSON.parse(info.meta_json), meta)) return false;
  if (Number(counts.n) !== manifest.products || Number(counts.remus) !== manifest.remus || Number(counts.dba) !== manifest.dba) return false;
  if (rows.length !== Object.keys(manifest.metadata).length) return false;
  return rows.every(row => Object.hasOwn(manifest.metadata, row.meta_key) && sameJson(JSON.parse(row.value_json), manifest.metadata[row.meta_key]));
}
function inspectionSql(version) {
  if (!/^catalog-[a-f0-9]{16}$/.test(version)) throw new Error("Invalid catalog version");
  return `SELECT product_count,remus_count,dba_count,meta_json FROM catalog_versions WHERE version='${version}';` +
    `SELECT COUNT(*) AS n,COALESCE(SUM(manufacturer='REMUS'),0) AS remus,COALESCE(SUM(manufacturer='DBA'),0) AS dba FROM catalog_products WHERE version='${version}';` +
    `SELECT meta_key,value_json FROM catalog_metadata WHERE version='${version}' ORDER BY meta_key;`;
}
function syncCatalog(manifest, seedFile, run = execute) {
  const complete = version => isComplete(manifest, version, run(["--command", inspectionSql(version)]));
  let version = manifest.version;
  if (complete(version)) console.log("Catalog already complete; skipping product writes.");
  else if (complete(manifest.legacyVersion)) {
    version = manifest.legacyVersion;
    console.log("Existing legacy catalog matches all inputs; skipping product writes.");
  } else {
    run(["--file", seedFile]);
    if (!complete(version)) throw new Error("Catalog verification failed; active version was not changed");
  }
  // Exactly one settings row, and zero writes if it is already active.
  run(["--command", `INSERT INTO catalog_settings(key,value,updated_at) VALUES('active_catalog_version','${version}',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;`]);
  console.log(`Active catalog: ${version}. Older versions retained for rollback; no bulk deletion.`);
  return version;
}
if (require.main === module) {
  const seedFile = path.resolve(process.argv[2] || path.resolve(__dirname, "../worker/catalog-seed.sql"));
  syncCatalog(JSON.parse(fs.readFileSync(seedFile + ".json", "utf8")), seedFile);
}
module.exports = { isComplete, inspectionSql, syncCatalog };
