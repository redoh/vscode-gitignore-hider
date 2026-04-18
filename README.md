# Gitignore Hider

Toggle hiding of `.gitignore` entries in the VS Code Explorer with a single click.

No more scrolling past `node_modules`, `.turbo`, `dist`, `build` to get to the files you actually work on — and still one click away when you need them.

## Features

- **One-click toggle** from the status bar (👁 / 👁‍🗨)
- Reads your workspace `.gitignore` and hides matching folders/files
- **Non-destructive** — remembers exactly which entries it added and restores your original `files.exclude` when toggled off
- **Auto-refresh** — if you edit `.gitignore` while hiding is active, the excludes update automatically
- Optional **auto-hide on startup** per workspace
- Support for **extra patterns** beyond what's in `.gitignore`

## Usage

After installing, open any workspace that has a `.gitignore` file.

- Click the eye icon in the status bar (bottom right) to toggle
- Or open the Command Palette and run:
  - `Gitignore Hider: Hide .gitignore Entries`
  - `Gitignore Hider: Show .gitignore Entries`
  - `Gitignore Hider: Toggle`
  - `Gitignore Hider: Refresh from .gitignore`

The status bar icon reflects the current state:

| Icon | Meaning |
| ---- | ------- |
| 👁    | `.gitignore` entries are visible in the Explorer |
| 👁‍🗨  | `.gitignore` entries are hidden |

## Settings

```jsonc
{
  // Automatically hide on workspace open
  "gitignoreHider.autoHideOnStartup": false,

  // Extra glob patterns to hide alongside .gitignore
  "gitignoreHider.additionalPatterns": [
    "**/.DS_Store",
    "**/*.log"
  ]
}
```

## How patterns are translated

`.gitignore` syntax is converted to VS Code's `files.exclude` glob format:

| `.gitignore` | `files.exclude` pattern |
| ------------ | ----------------------- |
| `node_modules` | `**/node_modules` |
| `node_modules/` | `**/node_modules` |
| `/build` | `build` |
| `*.log` | `**/*.log` |
| `dist/**` | `dist/**` |

Comments (`#`), empty lines, and negation patterns (`!`) are skipped.

## Why non-destructive matters

The extension writes its additions into `files.exclude` at workspace scope and tracks them in the workspace state. When you toggle off, it removes **only** what it added — any manual entries you had in `files.exclude` stay intact.

## Development

```bash
bun install
bun run compile
# Press F5 in VS Code to launch an Extension Development Host
```

To build a local `.vsix`:

```bash
bunx @vscode/vsce package
code --install-extension vscode-gitignore-hider-*.vsix
```

## License

MIT — see [LICENSE](./LICENSE).
