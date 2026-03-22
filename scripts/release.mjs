import {readFileSync} from "node:fs";
import {execSync} from "node:child_process";
import {join} from "node:path";

const root = new URL("..", import.meta.url).pathname;
const {version} = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
);

// prerelease tag detection: 4.0.0-beta.1 → "beta", 4.0.0-alpha.1 → "alpha", 4.0.0-rc.1 → "rc"
const prerelease = version.match(/-([a-z]+)/)?.[1];
const tag = prerelease ?? "latest";

const run = (cmd) => {
    console.log(`\n> ${cmd}`);
    execSync(cmd, {cwd: root, stdio: "inherit"});
};

// 1. sync versions
run("node scripts/sync-versions.mjs");

// 2. build & test
run("pnpm build");
run("pnpm test");

// 3. publish (types first, loader depends on it)
console.log(`\npublishing with --tag ${tag}`);
run(`pnpm --filter @gtfs-jp/types publish --no-git-checks --tag ${tag}`);
run(`pnpm --filter @gtfs-jp/loader publish --no-git-checks --tag ${tag}`);

console.log(`\nreleased ${version} (tag: ${tag})`);
