/**
 * Compiles `changelog/*.md` (one file per What's new entry) into the list `$lib/changelog`
 * exports. Runs in Node only: the Vite plugin in `vite.config.ts` serves the result as
 * `virtual:changelog`, and e2e tests call `loadChangelog()` directly.
 *
 * A file is a bullet list of items, with optional `id` and `date` frontmatter. Only the entries
 * written before this folder existed set them; for every other file both come from the commit
 * that added it to `main` (see `assignIds`), so a PR never picks an id and never conflicts.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import type { ChangelogEntry } from '../changelog';

export const CHANGELOG_DIR = fileURLToPath(new URL('../../../changelog', import.meta.url));

/** Files in the folder that aren't entries. */
const IGNORED = new Set(['README.md']);

/**
 * The newest entry written before this folder existed. Only those carry an `id`; a new one can't
 * pick its own, because only the build knows the order entries reach `main`.
 */
const LAST_HAND_NUMBERED_ID = 33;

/** Ids of entries added in the same second are spread over this many slots. */
const PER_SECOND = 100;

type ParsedEntry = { file: string; id?: number; date?: string; items: string[] };

const isDate = (value: string) =>
	/^\d{4}-\d{2}-\d{2}$/.test(value) &&
	new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** Parses one entry file; throws, naming the file, on anything malformed. */
export function parseEntry(file: string, text: string): ParsedEntry {
	const entry: ParsedEntry = { file, items: [] };
	let lines = text.replace(/\r\n?/g, '\n').split('\n');
	if (lines[0] === '---') {
		const end = lines.indexOf('---', 1);
		if (end < 0) fail(file, 'frontmatter has no closing ---');
		for (const line of lines.slice(1, end)) {
			if (!line.trim()) continue;
			const match = /^(\w+):\s*(.*?)\s*$/.exec(line);
			if (!match) fail(file, `bad frontmatter line "${line}"`);
			const [, key, value] = match!;
			if (key === 'id') {
				if (!/^[1-9]\d*$/.test(value)) fail(file, `id must be a positive integer, not "${value}"`);
				entry.id = Number(value);
				if (entry.id > LAST_HAND_NUMBERED_ID)
					fail(file, 'new entries get their id from the build; remove the id line');
			} else if (key === 'date') {
				if (!isDate(value)) fail(file, `date must be a real YYYY-MM-DD date, not "${value}"`);
				entry.date = value;
			} else {
				fail(file, `unknown frontmatter key "${key}" (only id and date)`);
			}
		}
		lines = lines.slice(end + 1);
	}
	for (const line of lines) {
		if (!line.trim()) continue;
		if (!line.startsWith('- ') || !line.slice(2).trim()) fail(file, `"${line}" isn't a "- " item`);
		const item = line.slice(2).trim();
		if (entry.items.includes(item)) fail(file, `"${item}" is listed twice`);
		entry.items.push(item);
	}
	if (!entry.items.length) fail(file, 'no items');
	return entry;
}

const git = (dir: string, args: string[]) =>
	execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Where an entry falls in time: the second it reached `main`, and its slot within that second. */
type Added = { second: number; slot: number };

const isEntryFile = (file: string) =>
	file.endsWith('.md') && !file.includes('/') && !IGNORED.has(file);

/**
 * When each entry file in `dir` was added on the current branch's first-parent line, so a PR's
 * entry is dated by the squash or merge commit that brought it to `main`, never by a commit inside
 * the PR. Files added in the same second get slots in commit order, then by name; history only
 * grows, so a slot never changes once given.
 *
 * Without git there's nothing to number by, so this throws. A shallow clone only knows its recent
 * commits: `strict` (on CI, where a wrong id would ship) throws, otherwise it warns and numbers
 * from what it has, which is fine for local builds and tests.
 */
export function addedTimes(dir: string, strict = !!process.env.CI): Map<string, Added> {
	let shallow: string;
	try {
		shallow = git(dir, ['rev-parse', '--is-shallow-repository']).trim();
	} catch {
		throw new Error(
			'changelog: entries without an id need git history to number them, and this is not a git repository.'
		);
	}
	if (shallow === 'true') {
		const message =
			'changelog: entries without an id need full git history to number them, and this is a shallow clone. Run `git fetch --unshallow` (on CI, check out with fetch-depth: 0).';
		if (strict) throw new Error(message);
		console.warn(`${message} Numbering from the commits it has.`);
	}
	let log: string;
	try {
		log = git(dir, [
			'log',
			'--reverse',
			'--first-parent',
			'--diff-merges=first-parent',
			// Without this, a file that arrived by a rename is an R and never counts as added.
			'--no-renames',
			'--diff-filter=A',
			'--relative',
			'--name-only',
			'--format=%x00%ct',
			'--',
			'.'
		]);
	} catch {
		log = ''; // No commits yet.
	}
	const commits: { second: number; files: string[] }[] = [];
	for (const line of log.split('\n')) {
		if (line.startsWith('\0')) commits.push({ second: Number(line.slice(1)), files: [] });
		else if (isEntryFile(line)) commits.at(-1)?.files.push(line);
	}
	const added = new Map<string, Added>();
	const used = new Map<number, number>();
	// Oldest first: a file deleted and added again keeps its latest addition.
	for (const { second, files } of commits) {
		for (const file of files.sort()) {
			const slot = used.get(second) ?? 0;
			used.set(second, slot + 1);
			added.set(file, { second, slot });
		}
	}
	return added;
}

/**
 * Fills in `id` and `date` for entries without them, from when they were added (now, for files
 * git doesn't know yet). `id = second * 100 + slot`: ordered by merge, above every hand-numbered
 * id, and unchanged when other entries come and go (a revert can't shift them).
 */
export function assignIds(
	parsed: ParsedEntry[],
	times: () => Map<string, Added>,
	now = () => Math.floor(Date.now() / 1000)
): ChangelogEntry[] {
	const pending = parsed.filter((e) => e.id === undefined);
	const known = pending.length ? times() : new Map<string, Added>();
	// Files git doesn't know yet take the slots after any commit in this second.
	const second = now();
	let next =
		Math.max(-1, ...[...known.values()].filter((a) => a.second === second).map((a) => a.slot)) + 1;
	const entries = parsed.map((entry) => {
		let { id, date } = entry;
		if (id === undefined) {
			const added = known.get(entry.file) ?? { second, slot: next++ };
			if (added.slot >= PER_SECOND)
				fail(entry.file, `over ${PER_SECOND} entries added in one second`);
			id = added.second * PER_SECOND + added.slot;
			date ??= new Date(added.second * 1000).toISOString().slice(0, 10);
		}
		return {
			id,
			date: date ?? fail(entry.file, 'an entry with an id needs a date'),
			items: entry.items
		};
	});
	const seen = new Map<number, string>();
	parsed.forEach((entry, i) => {
		const other = seen.get(entries[i].id);
		if (other) fail(entry.file, `id ${entries[i].id} is also used by changelog/${other}`);
		seen.set(entries[i].id, entry.file);
	});
	return entries.sort((a, b) => b.id - a.id);
}

function fail(file: string, message: string): never {
	throw new Error(`changelog/${file}: ${message}`);
}

/** Every entry in `dir`, newest first. */
export function loadChangelog(dir = CHANGELOG_DIR, strict = !!process.env.CI): ChangelogEntry[] {
	const files = readdirSync(dir).filter(isEntryFile).sort();
	const parsed = files.map((file) => parseEntry(file, readFileSync(`${dir}/${file}`, 'utf8')));
	return assignIds(parsed, () => addedTimes(dir, strict));
}

const VIRTUAL_ID = 'virtual:changelog';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** Vite plugin serving `loadChangelog()` as `virtual:changelog`, reloading in dev on edits. */
export function changelogPlugin(dir = CHANGELOG_DIR): Plugin {
	return {
		name: 'xcwds-changelog',
		resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
		load(id) {
			if (id !== RESOLVED_ID) return;
			this.addWatchFile(dir);
			return `export default ${JSON.stringify(loadChangelog(dir))};`;
		},
		configureServer(server) {
			server.watcher.add(dir);
			const reload = (file: string) => {
				if (!file.startsWith(dir + sep)) return;
				const module = server.moduleGraph.getModuleById(RESOLVED_ID);
				if (module) server.moduleGraph.invalidateModule(module);
				server.ws.send({ type: 'full-reload' });
			};
			server.watcher.on('add', reload).on('change', reload).on('unlink', reload);
		}
	};
}
