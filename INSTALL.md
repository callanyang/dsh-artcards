# dsh-artcards installation guide

## Requirements

- DeepSeek Harness with an initialized `web` profile;
- Node.js 22 or newer;
- pnpm or Corepack when the `dsh` command is unavailable during installation.

Check the main requirements:

```bash
dsh --version
node --version
```

## Install

Keep the project directory in a permanent location, then run:

```bash
cd /path/to/dsh-artcards
./install.sh
```

The plugin is installed as a local link, so do not move or delete the project directory while it is installed.

Restart DSH:

```bash
dsh web
```

## Verify and use

Open DSH Web and run a task that creates or modifies a file. A card should appear below the response with the file name, directory, and available open actions.

If needed, confirm that the plugin is registered:

```bash
grep -n artcards ~/.dsh/profiles/web/package.json
```

## Uninstall

```bash
cd /path/to/dsh-artcards
./uninstall.sh
```

Restart `dsh web` after removal. The uninstall script is safe to run more than once.

## Troubleshooting

### The install script cannot find pnpm

Enable the pnpm version provided by Corepack, then retry:

```bash
corepack enable
./install.sh
```

### Artifact cards do not appear

1. Restart DSH and refresh the browser.
2. Confirm that `dsh-artcards` appears in `~/.dsh/profiles/web/package.json`.
3. Run a task that actually creates or modifies a file. Read-only tasks do not produce cards.

### Only the default open action is available

Use `127.0.0.1` or `localhost` to access DSH Web, and make sure DSH and the browser run on the same desktop machine.
