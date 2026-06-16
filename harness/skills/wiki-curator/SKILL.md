# Wiki Curator Skill

Use this skill when adding or reviewing wiki knowledge.

## Steps

1. Identify the raw source file in `raw/`.
2. Run `npm run build:wiki`.
3. Open `wiki/index.md` and confirm the new source appears.
4. Search for related concept pages.
5. If a concept is missing, add a deterministic concept pattern to `scripts/build-llm-wiki.js` or create a reviewed concept page.
6. Run `npm run validate`.
7. Start `npm run app` and visually inspect the result.

## Quality Bar

- Every answer should have a source page.
- Every generated link should resolve.
- Raw files should not be edited during curation.
