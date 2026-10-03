# Importing recipes from Notion

Agent notes for keeping `/recipes` in sync with the owner's Notion recipes.

## Source of truth

- Notion database: **📖 Recipes** in _Home Workspace_
  - Database: `3557491e-ffd1-4013-88d9-bf7c8d9a6731`
  - Data source: `collection://c7e933c6-7183-4f81-88ce-1225369e0002`
  - Properties: `Name` (title), `Tags` (multi-select)
- There is an older **🍗 Recipes** database under _Old / Personal Home_
  (`69456a19-6c79-4ec1-bd4c-c0973762fe19`). It is archived personal clutter and is
  **not** imported. Don't search the whole workspace for "recipe" and import every hit.

## What has already been imported?

Every imported recipe is one JSON file in `src/lib/recipes/data/<slug>.json` and carries
`notion.id` and `notion.lastEditedTime`. Pages deliberately left out are listed with a
reason in `src/lib/recipes/notion-skipped.json`.

```sh
pnpm recipes:notion-ids   # tab-separated: status, notion id, lastEditedTime, name
```

Compare that list with the rows of the Notion data source (query it with the Notion MCP
`query-data-sources` tool in `rows` mode, then `fetch` each page). A Notion row is:

- **new** if its id isn't in the list → import it (or add it to the skip list),
- **changed** if the page's `page_last_edited_at` is newer than `notion.lastEditedTime`
  → re-import its content and bump the timestamp,
- **removed** if an imported id no longer exists in the database → ask before deleting.

## Rules

- **Skip parody recipes.** Anything tagged `Parody` (or obviously a joke post) never goes in
  `/recipes`. The parody pork chop post already lives as its own page at the long route under
  `src/routes/the-best-apple-cider-...`; leave it alone. A unit test fails if a recipe tagged
  `Parody` is imported.
- Record every skipped page in `notion-skipped.json` with a reason, so the next run doesn't
  re-evaluate it.
- Keep content faithful to Notion. Light cleanup only: split `<br>`-joined lines into list
  items, drop leading `- ` bullets, normalize ranges to en dashes (`3–4`), drop scraping
  junk (e.g. the stray TikTok like/comment counts in the pizza dough page) and creator
  sign-offs. Keep the `Source:` link as `source`.
- Strip the emoji from the Notion title into the `emoji` field.
- Slug = short kebab-case of the name (drop filler like "with", "and"). Slugs are URLs —
  don't rename an existing one.

## Recipe file shape

See the `Recipe` type in `src/lib/recipes/index.ts`. Notion page sections map as:

| Notion                         | JSON                                               |
| ------------------------------ | -------------------------------------------------- |
| intro paragraph                | `description`                                      |
| `Serves:` / `Yields:`          | `servings` (shown as "Yield")                      |
| `Time:`                        | `time`                                             |
| other intro lines              | `notes[]`                                          |
| `## INGREDIENTS`               | `ingredients[]`                                    |
| `## INSTRUCTIONS` (numbered)   | `instructions[]` (numbers stripped)                |
| `## TIPS` (incl. sub-headings) | `tips[]` (sub-heading becomes a prefix)            |
| `Tags` property                | `tags[]`                                           |
| page id / last edited          | `notion.id`, `notion.url`, `notion.lastEditedTime` |

No code changes are needed to add a recipe: the index (`src/routes/recipes/+page.svelte`)
and detail pages (`src/routes/recipes/[slug]/`) pick up every file in `data/` via
`import.meta.glob`, and `entries` prerenders each slug.

The `/recipes` search filters by recipe name and tags only — it does not search recipe
content.

## Verify

```sh
pnpm check && pnpm lint && pnpm test:unit -- --run --project server && pnpm build
```

`pnpm test:e2e` needs a Playwright browser; in Claude Code cloud containers point
`launchOptions.executablePath` at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`
instead of running `playwright install`.
