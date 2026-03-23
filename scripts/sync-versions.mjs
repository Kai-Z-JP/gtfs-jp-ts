import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = rootPkg.version;

const packagesDir = join(root, 'packages');
const dirs = readdirSync(packagesDir).filter((d) => statSync(join(packagesDir, d)).isDirectory());

for (const dir of dirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (!pkg.name?.startsWith('@gtfs-jp/')) continue;
    if (pkg.version === version) continue;
    pkg.version = version;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${pkg.name} → ${version}`);
  } catch {
    // skip dirs without package.json
  }
}

console.log(`synced to ${version}`);
