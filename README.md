# gobo-translation-modifications

Directus **hook** extension for Gobo translation-related API behavior.

**Repository:** [github.com/larsgobo/gobo-directus-translating-modifications-extension](https://github.com/larsgobo/gobo-directus-translating-modifications-extension)

## Setup

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

Rebuilds on file changes. On Docker, set `EXTENSIONS_AUTO_RELOAD=true` on the Directus instance to reload without restart.

## Link to Directus

Symlink this package into your Directus `extensions` folder:

```bash
npm run link
```

Or copy the built `dist/` output into `extensions/gobo-translation-modifications/`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Production build (`dist/index.js`) |
| `npm run dev` | Watch mode, no minify |
| `npm run link` | Create/check extension symlink |
| `npm run validate` | Run extension validations |

## Project layout

```
gobo-translation-modifications/
├── src/
│   └── index.ts          # Hook entry (filter/action handlers)
├── dist/                 # Built output (gitignored)
├── package.json          # directus:extension manifest
├── tsconfig.json
└── extension.config.js   # Optional Rollup/watch CLI config
```

## Next steps

Implement translation logic in `src/index.ts` using [Directus hooks](https://directus.io/docs/guides/extensions/api-extensions/hooks).
