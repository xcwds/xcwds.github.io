import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changelog } from '../changelog';
import { loadChangelog, parseEntry } from './changelog';

describe('parseEntry', () => {
	it('reads items and optional frontmatter', () => {
		expect(parseEntry('a.md', '---\nid: 3\ndate: 2026-10-03\n---\n\n- One.\n- Two.\n')).toEqual({
			file: 'a.md',
			id: 3,
			date: '2026-10-03',
			items: ['One.', 'Two.']
		});
		expect(parseEntry('b.md', '- Only.\r\n')).toEqual({ file: 'b.md', items: ['Only.'] });
	});

	it.each([
		['', 'no items'],
		['Some text\n', `isn't a "- " item`],
		['-\n', `isn't a "- " item`],
		['- Same.\n- Same.\n', 'listed twice'],
		['---\nid: 0\n---\n- A.\n', 'positive integer'],
		['---\nid: 1.5\n---\n- A.\n', 'positive integer'],
		['---\nid: 34\ndate: 2026-10-10\n---\n- A.\n', 'id from the build'],
		['---\ndate: 2026-02-30\n---\n- A.\n', 'real YYYY-MM-DD'],
		['---\ntitle: Hi\n---\n- A.\n', 'unknown frontmatter key'],
		['---\nid: 1\n- A.\n', 'no closing ---']
	])('rejects %j', (text, message) => {
		expect(() => parseEntry('bad.md', text)).toThrow(`changelog/bad.md: `);
		expect(() => parseEntry('bad.md', text)).toThrow(message);
	});
});

describe('loadChangelog', () => {
	let repo: string;
	afterEach(() => rmSync(repo, { recursive: true, force: true }));

	/** A repo with a `changelog/` folder; commits are dated by `time` (Unix seconds). */
	function setup() {
		repo = mkdtempSync(join(tmpdir(), 'changelog-'));
		mkdirSync(join(repo, 'changelog'));
		git('init', '-q', '-b', 'main');
		git('config', 'user.email', 'test@example.com');
		git('config', 'user.name', 'Test');
		return join(repo, 'changelog');
	}
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...dates } });
	let dates: Record<string, string> = {};
	function commit(time: number, message = 'commit') {
		dates = { GIT_AUTHOR_DATE: `@${time} +0000`, GIT_COMMITTER_DATE: `@${time} +0000` };
		git('add', '-A');
		git('commit', '-q', '-m', message);
	}
	const write = (dir: string, file: string, text: string) => writeFileSync(join(dir, file), text);

	it('numbers entries by the time they reached main, not when they were written', () => {
		const dir = setup();
		write(dir, 'old.md', '---\nid: 7\ndate: 2026-10-01\n---\n- Old.\n');
		write(dir, 'README.md', 'Not an entry.\n');
		commit(1_700_000_000);
		// "early" is written first on a branch, but "late" merges to main before it does.
		git('checkout', '-q', '-b', 'early');
		write(dir, 'early.md', '- Early.\n');
		commit(1_700_000_100);
		git('checkout', '-q', 'main');
		write(dir, 'late.md', '- Late.\n');
		commit(1_700_000_200);
		dates = { GIT_AUTHOR_DATE: '@1700000300 +0000', GIT_COMMITTER_DATE: '@1700000300 +0000' };
		git('merge', '-q', '--no-ff', '-m', 'merge early', 'early');

		expect(loadChangelog(dir)).toEqual([
			{ id: 170000030000, date: '2023-11-14', items: ['Early.'] },
			{ id: 170000020000, date: '2023-11-14', items: ['Late.'] },
			{ id: 7, date: '2026-10-01', items: ['Old.'] }
		]);
	});

	it('keeps ids when another entry is reverted, and spreads one second over distinct ids', () => {
		const dir = setup();
		write(dir, 'b.md', '- B.\n');
		write(dir, 'a.md', '- A.\n');
		commit(1_700_000_000);
		write(dir, 'c.md', '- C.\n');
		commit(1_700_000_100);
		write(dir, 'a2.md', '- Same second, later commit.\n');
		commit(1_700_000_100);
		const before = loadChangelog(dir);
		expect(before.map((e) => e.id)).toEqual([
			170000010001, 170000010000, 170000000001, 170000000000
		]);
		rmSync(join(dir, 'a.md'));
		commit(1_700_000_200, 'revert a');
		expect(loadChangelog(dir)).toEqual(before.filter((e) => e.items[0] !== 'A.'));
	});

	it('treats a renamed entry as added by the rename, the same on every build', () => {
		const dir = setup();
		write(dir, 'a.md', '- A long enough item for git to pair the files as a rename.\n');
		commit(1_700_000_000);
		git('mv', 'changelog/a.md', 'changelog/b.md');
		commit(1_700_000_100);
		expect(loadChangelog(dir).map((e) => e.id)).toEqual([170000010000]);
	});

	it('puts files git does not know yet first, dated today', () => {
		const dir = setup();
		write(dir, 'a.md', '- A.\n');
		commit(1_700_000_000);
		write(dir, 'new.md', '- New.\n');
		const [newest] = loadChangelog(dir);
		expect(newest.items).toEqual(['New.']);
		expect(newest.id).toBeGreaterThan(Math.floor(Date.now() / 1000 - 60) * 100);
		expect(newest.date).toBe(new Date().toISOString().slice(0, 10));
	});

	it('refuses to guess ids without full git history on CI', () => {
		const dir = setup();
		write(dir, 'a.md', '- A.\n');
		commit(1_700_000_000);
		const clone = join(repo, 'clone');
		git('clone', '-q', '--depth', '1', `file://${repo}`, clone);
		expect(() => loadChangelog(join(clone, 'changelog'), true)).toThrow('shallow clone');
		// Outside CI it warns and numbers from the commits it has.
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(loadChangelog(join(clone, 'changelog'), false)).toHaveLength(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('git fetch --unshallow'));
		warn.mockRestore();
		// Entries that carry their own id don't need history.
		write(join(clone, 'changelog'), 'a.md', '---\nid: 1\ndate: 2026-10-01\n---\n- A.\n');
		expect(loadChangelog(join(clone, 'changelog'), true)).toHaveLength(1);
	});

	it('rejects a duplicate id', () => {
		const dir = setup();
		write(dir, 'a.md', '---\nid: 1\ndate: 2026-10-01\n---\n- A.\n');
		write(dir, 'b.md', '---\nid: 1\ndate: 2026-10-01\n---\n- B.\n');
		expect(() => loadChangelog(dir)).toThrow('id 1 is also used by changelog/a.md');
	});
});

describe('the app changelog', () => {
	it('is compiled newest first, and keeps the ids entries had before they moved to files', () => {
		expect(changelog.length).toBeGreaterThanOrEqual(33);
		expect(changelog.map((e) => e.id)).toEqual(
			[...changelog.map((e) => e.id)].sort((a, b) => b - a)
		);
		expect(changelog.filter((e) => e.id <= 33).map((e) => e.id)).toEqual(
			Array.from({ length: 33 }, (_, i) => 33 - i)
		);
	});
});
