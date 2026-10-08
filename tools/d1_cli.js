const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
function parseOutput(output) {
  // File imports emit progress lines even with --json. Find the final JSON
  // document without accepting arbitrary progress/error text as a result.
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "").trim();
  const starts = [...clean.matchAll(/^[ \t]*([\[{])/gm)];
  for (const match of starts) {
    const start = match.index + match[0].length - 1;
    const close = match[1] === "[" ? "]" : "}";
    const end = clean.lastIndexOf(close);
    if (end < start) continue;
    try {
      const parsed = JSON.parse(clean.slice(start,end+1));
      const results = Array.isArray(parsed) ? parsed : [parsed];
      if (!results.length || results.some(result => !result || typeof result !== "object" || (!Object.hasOwn(result,"success") && !Array.isArray(result.results)))) continue;
      if (results.some(result => result.success === false || result.error)) throw new Error("D1 command failed");
      return results;
    } catch (error) { if (error.message === "D1 command failed") throw error; }
  }
  throw new Error("Wrangler did not return a valid D1 JSON result");
}
function execute(args) {
  // Wrangler is installed and pinned by CI. Never launch a remote command in tests.
  const cli = path.join(root, "node_modules/wrangler/bin/wrangler.js");
  const output = execFileSync(process.execPath, [cli, "d1", "execute", "garage-admin", "--remote", "-c", "worker/admin-wrangler.toml", ...args, "--json"], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  return parseOutput(output);
}
module.exports = { execute, parseOutput };
