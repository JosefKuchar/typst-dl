# typst-download

Download a Typst package from an HTTP(S) Git repository into Typst's local package directory.

## Usage

```bash
npx typst-download <git-repository-url>
```

Example:

```bash
npx typst-download https://github.com/stuxf/basic-typst-resume-template
```

## What it does

- clones the repository
- reads `typst.toml` from the repository root
- detects `package.name` and `package.version`
- installs the package to:

```text
{data-dir}/typst/packages/{namespace}/{name}/{version}
```

Default namespace: `git`

`{data-dir}` is resolved the same way Typst does:

- Linux: `$XDG_DATA_HOME` or `~/.local/share`
- macOS: `~/Library/Application Support`
- Windows: `%APPDATA%`

## Options

```text
typst-download <git-repository-url> [--namespace <name>] [--data-dir <path>] [--force]
```

- `--namespace`, `-n`: override the namespace, defaults to `git`
- `--data-dir`: override Typst's data directory
- `--force`: replace an already installed `{namespace}/{name}/{version}`

## Notes

- currently supports HTTP(S) Git repository URLs
- respects `package.exclude` from `typst.toml`
