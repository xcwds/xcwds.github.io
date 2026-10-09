# What's new

Each Markdown file here is one entry in Settings → What's new. Every PR people will notice adds
one new file, named with a short slug for the change (the name only has to be unique):

```md
- Short user-facing item, in plain text.
- Another item, if the change has more than one.
```

- One `- ` line per item, plain text (no Markdown formatting; Prettier skips this folder).
- No `id` or `date`: the build numbers and dates each entry from the commit that added it to
  `main` (`src/lib/server/changelog.ts`), so two PRs never conflict. Only the entries written
  before this folder existed carry them, in frontmatter.
- Never rename an entry file: git would see a new file, and the entry would show as new again.
  Editing an entry's text, or deleting it, is fine. CI checks both rules.
