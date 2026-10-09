// Temporary, for the #91 stress experiment: summarizes a Playwright JSON report.
// Counts browser crashes (a test that couldn't open a context, or "Target crashed") and, for
// each, names the test that ran just before it in the same worker (the one the crash followed).
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const [file = 'results.json', label = 'run'] = process.argv.slice(2);
if (!existsSync(file)) {
	console.log(`${label}: no report`);
	process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));

const results = [];
const walk = (suite, path) => {
	for (const spec of suite.specs ?? [])
		for (const t of spec.tests)
			for (const r of t.results)
				results.push({
					title: `${spec.file}:${spec.line} ${spec.title}`,
					worker: r.workerIndex,
					start: Date.parse(r.startTime),
					status: r.status,
					error: (r.errors ?? []).map((e) => e.message ?? '').join('\n')
				});
	for (const child of suite.suites ?? []) walk(child, path);
};
for (const suite of report.suites) walk(suite, '');

const isCrash = (r) =>
	/has been closed|Target crashed|Browser closed|SEGV/.test(r.error) && r.status !== 'passed';
const crashes = results.filter(isCrash);
const failures = results.filter((r) => r.status !== 'passed' && r.status !== 'skipped');

const lines = [
	`### ${label}`,
	`${results.length} tests, ${failures.length} failed, ${crashes.length} browser crashes`
];
for (const c of crashes) {
	const before = results
		.filter((r) => r.worker === c.worker && r.start < c.start)
		.sort((a, b) => b.start - a.start)[0];
	const segv = /SEGV_\w+ \w+/.exec(c.error)?.[0] ?? 'no SEGV line';
	lines.push(
		`- ${c.title} (${segv}); ran after: ${before ? before.title : 'nothing (first test)'}`
	);
}
for (const f of failures.filter((r) => !isCrash(r)))
	lines.push(`- other failure: ${f.title}: ${f.error.split('\n')[0].slice(0, 160)}`);

const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
