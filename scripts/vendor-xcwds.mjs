// Packs the @xcwds packages from a checkout of xcwds/core into vendor/xcwds/, which package.json
// installs from until they are published to npm (xcwds/core#26). Run it after changing core:
//
//   node scripts/vendor-xcwds.mjs ../core && pnpm install --no-frozen-lockfile
//
// It builds core first, so the tarballs hold current `dist/` folders.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const PACKAGES = [
	'core',
	'sveltekit',
	'testing',
	'plugin-shell',
	'plugin-theme',
	'plugin-offline',
	'plugin-update',
	'plugin-install',
	'plugin-settings',
	'plugin-tools',
	'plugin-timers',
	'plugin-share',
	'plugin-changelog'
];

const core = resolve(process.argv[2] ?? '../core');
const out = resolve('vendor/xcwds');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

run('pnpm', ['install', '--frozen-lockfile'], core);
run('pnpm', ['build'], core);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of PACKAGES)
	run('pnpm', ['pack', '--pack-destination', out], join(core, 'packages', name));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: core, encoding: 'utf8' }).trim();
console.log(`Packed ${readdirSync(out).length} packages from xcwds/core ${commit}.`);
