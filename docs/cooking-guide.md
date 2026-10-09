# Cooking guide

Agent notes for the cooking guide at `/guide` (tracking issue #96): short, phone-first articles
with general cooking know-how that isn't tied to one recipe (which method to use, cuts of meat,
doneness, kitchen basics). Recipes live at `/recipes` ([classic-recipes.md](classic-recipes.md));
both share the Recipes tab, with a Recipes | Guide switch (`src/lib/RecipesGuideSwitch.svelte`)
at the top of both index pages.

Each article is one JSON file in `src/lib/guide/data/<slug>.json`; the index and article pages
pick up every file via `import.meta.glob`, so adding one needs no code changes. Slugs and section
ids are URLs, so don't rename them. See the `GuideArticle` type in `src/lib/guide/index.ts`.

## Fields

- `slug`, `name`, `emoji`, `tags` (searched with the name and summary), `summary` (one or two
  sentences, shown under the title and on the index).
- `category`: one of `CATEGORIES` (`methods`, `meat`, `vegetables`, `staples`, `basics`); the
  index groups articles by it, in that order.
- `sections[]`: `{ heading, blocks, id? }`. Each section is an `<h2>` with an anchor id: `id`, or
  the heading slugified. Give an explicit `id` when you might reword the heading later.
- `blocks[]`: a string (a paragraph), or
  - `{ "type": "list", "items": [...], "ordered"?: true }`
  - `{ "type": "tip", "text": ... }`
  - `{ "type": "warning", "text": ... }` for food-safety warnings
  - `{ "type": "table", "columns": [...], "rows": [[...]], "caption"?: ... }`. On phones each row
    becomes a card headed by its first cell, so make the first column the row's name and keep
    tables to about 4 columns.
- `related`: `{ guides?, recipes?, tools? }` (slugs, slugs, `/utils/...` paths), shown as cards at
  the end.

## Inline text

Any text (paragraphs, list items, tips, table cells) supports `**bold**` and links by id:
`[sear](guide:stovetop#searing)`, `[Roast Chicken](recipe:roast-chicken)`,
`[Oven Time Converter](tool:/utils/oven-time)`. No raw HTML or outside links in text.
`src/lib/guide/guide.spec.ts` fails on any link to a missing article, section, recipe or tool, so
only link to articles that exist.

## Writing

- Short and practical: what to do, why, and the common mistakes. Readers are at the stove.
- Units like the recipes: °F with °C in parentheses, rounded like an oven dial (`400°F (200°C)`,
  ranges `400–450°F (200–230°C)`; the spec checks this), and sizes in both (`1 inch (2.5 cm)`).
- Food-safety numbers (safe internal temperatures, storage times, thawing, the danger zone) follow
  USDA FSIS. Keep them in the doneness and food-safety article and link to it rather than
  repeating numbers elsewhere. Where common practice differs from USDA (rare steak, runny eggs),
  say so plainly.
- A PR that adds articles lists the sources it checked numbers against in its description.
- Add each new article's changelog line to the PR's `src/lib/changelog.ts` entry.

## Verify

`src/lib/guide/guide.spec.ts` checks every article's shape, links and temperatures;
`e2e/guide.test.ts` covers the switch, search, navigation and tables.
