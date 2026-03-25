import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , channel, bump] = process.argv;

if (!channel || !bump) {
  console.error('Usage: node scripts/bump-version.mjs <channel> <bump>');
  process.exit(1);
}

const pkgPath = join(new URL('..', import.meta.url).pathname, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const match = pkg.version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+)\.(\d+))?$/);
if (!match) {
  console.error(`Unsupported version format: ${pkg.version}`);
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]);
const preLabel = match[4] ?? null;
const preNumber = match[5] ? Number(match[5]) : null;
const isPrerelease = preLabel !== null;

const stable = (nextMajor, nextMinor, nextPatch) => `${nextMajor}.${nextMinor}.${nextPatch}`;
const beta = (nextMajor, nextMinor, nextPatch, nextPreNumber = 0) =>
  `${nextMajor}.${nextMinor}.${nextPatch}-beta.${nextPreNumber}`;

let nextVersion;

switch (`${channel}:${bump}`) {
  case 'beta:prerelease':
    if (preLabel === 'beta' && preNumber !== null) {
      nextVersion = beta(major, minor, patch, preNumber + 1);
      break;
    }
    nextVersion = beta(major, minor, patch + 1);
    break;
  case 'beta:prepatch':
    nextVersion = beta(major, minor, patch + 1);
    break;
  case 'beta:preminor':
    nextVersion = beta(major, minor + 1, 0);
    break;
  case 'beta:premajor':
    nextVersion = beta(major + 1, 0, 0);
    break;
  case 'stable:promote':
    if (!isPrerelease) {
      console.error(`Version ${pkg.version} is already stable`);
      process.exit(1);
    }
    nextVersion = stable(major, minor, patch);
    break;
  case 'stable:patch':
    nextVersion = stable(major, minor, patch + 1);
    break;
  case 'stable:minor':
    nextVersion = stable(major, minor + 1, 0);
    break;
  case 'stable:major':
    nextVersion = stable(major + 1, 0, 0);
    break;
  default:
    console.error(`Unsupported channel/bump combination: ${channel}/${bump}`);
    process.exit(1);
}

pkg.version = nextVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(nextVersion);
