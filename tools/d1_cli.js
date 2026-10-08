const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
function execute(args) {
  // Wrangler is installed and pinned by CI. Never launch a remote command in tests.
  const cli = path.join(root, "node_modules/wrangler/bin/wrangler.js");
  const output = execFileSync(process.execPath, [cli, "d1", "execute", "garage-admin", "--remote", "-c", "worker/admin-wrangler.toml", ...args, "--json"], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const parsed = JSON.parse(output);
  const results = Array.isArray(parsed) ? parsed : [parsed];
  if (results.some(result => result.success === false || result.error)) throw new Error("D1 command failed");
  return results;
}
module.exports = { execute };
