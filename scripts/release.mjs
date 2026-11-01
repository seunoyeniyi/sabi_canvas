// One-command release: bump, build, publish, push, then point the sibling
// apps (../client, ../storefront) at the new version.
//
//   npm run release -- patch            (or minor | major)
//   npm run release -- patch --dry-run  (prints the steps, changes nothing)
//
// The apps are only updated, not committed or pushed: review and push each
// repo yourself afterwards (backend first, then this package, then the apps).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bump = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: npm run release -- <patch|minor|major> [--dry-run]");
  process.exit(1);
}

function run(cmd, args, cwd = root, { capture = false } = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}${cwd === root ? "" : `   (in ${path.relative(root, cwd) || "."})`}`);
  if (dryRun) return "";
  const res = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit" });
  if (res.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status ?? 1);
  }
  return capture ? res.stdout.trim() : "";
}

const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout.trim();
if (dirty) {
  console.error("Working tree has uncommitted changes. Commit them first, `npm version` needs a clean tree.\n" + dirty);
  if (!dryRun) process.exit(1);
}

// Fail before bumping anything if npm isn't logged in (publish would 404 halfway through).
if (!dryRun) {
  const whoami = spawnSync("npm", ["whoami"], { cwd: root, encoding: "utf8" });
  if (whoami.status !== 0) {
    console.error("Not logged in to npm. Run `npm login` (as the account that owns sabi-canvas), then release again.");
    process.exit(1);
  }
}

// A version published from somewhere else would make `npm version` + `npm publish` collide.
const localVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const registry = spawnSync("npm", ["view", "sabi-canvas", "version"], { cwd: root, encoding: "utf8" }).stdout.trim();
const toNums = (v) => v.split(".").map(Number);
const behind = registry && toNums(localVersion).reduce((acc, n, i) => acc || Math.sign(n - toNums(registry)[i]), 0) < 0;
if (behind) {
  console.error(
    `npm already has sabi-canvas ${registry} but package.json says ${localVersion}.\n` +
      `Run \`npm version ${registry} --no-git-tag-version\`, commit it, then release again.`,
  );
  process.exit(1);
}

run("npm", ["version", bump]);
const version = dryRun ? `<next ${bump}>` : JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
run("npm", ["run", "build"]);
run("npm", ["publish"]);
run("git", ["push", "--follow-tags"]);

// npm says "may take a few minutes to become available": installing right away fails with ETARGET.
function waitForRegistry(v, timeoutMs = 10 * 60 * 1000) {
  console.log(`\nWaiting for sabi-canvas@${v} to appear on the registry...`);
  if (dryRun) return;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = spawnSync("npm", ["view", `sabi-canvas@${v}`, "version", "--prefer-online"], { cwd: root, encoding: "utf8" });
    if (res.status === 0 && res.stdout.trim() === v) return;
    spawnSync("sleep", ["10"]);
  }
  console.error(
    `\nsabi-canvas@${v} is published but not visible yet. When it is, run in each app:\n  npm install sabi-canvas@${v} --prefer-online`,
  );
  process.exit(1);
}
waitForRegistry(version);

for (const app of ["client", "storefront"]) {
  const dir = path.resolve(root, "..", app);
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (!pkg.dependencies?.["sabi-canvas"]) {
    console.log(`\nSkipping ${app}: it does not depend on sabi-canvas yet.`);
    continue;
  }
  run("npm", ["install", `sabi-canvas@${version}`, "--prefer-online"], dir);
}

console.log(`\nReleased sabi-canvas ${version}. Next: review, commit and push client/storefront.`);
