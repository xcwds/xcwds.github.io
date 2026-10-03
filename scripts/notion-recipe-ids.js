// Prints every Notion page id already handled by the recipes import:
// imported recipes (src/lib/recipes/data/*.json) and intentionally skipped pages
// (src/lib/recipes/notion-skipped.json). Usage: pnpm recipes:notion-ids
import { readdirSync, readFileSync } from 'node:fs';

const dataDir = new URL('../src/lib/recipes/data/', import.meta.url);
const skippedFile = new URL('../src/lib/recipes/notion-skipped.json', import.meta.url);

const rows = readdirSync(dataDir)
	.filter((file) => file.endsWith('.json'))
	.map((file) => JSON.parse(readFileSync(new URL(file, dataDir), 'utf8')))
	.map((r) => ({
		status: 'imported',
		id: r.notion.id,
		lastEdited: r.notion.lastEditedTime,
		name: r.name
	}));

for (const s of JSON.parse(readFileSync(skippedFile, 'utf8')).skipped) {
	rows.push({ status: 'skipped', id: s.id, lastEdited: '', name: s.name });
}

for (const r of rows) console.log([r.status, r.id, r.lastEdited, r.name].join('\t'));
