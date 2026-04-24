# typst-dl

Download a Typst package from an HTTP(S) Git repository into Typst's local package directory.

Typst Universe packages are published by opening a pull request against
`typst/packages`. `typst-dl` solves the pre-publish and out-of-tree case: install a
package directly from its Git repository while developing, testing, or using a
package that is not in Typst Universe yet.

## Install

```bash
npm install -g typst-dl
```

You can also run it without installing:

```bash
npx typst-dl <git-repository-url>
```

## CLI usage

```bash
npx typst-dl https://github.com/stuxf/basic-typst-resume-template
```

The command prints the installed package identifier:

```text
Installed @git/<package-name>:<package-version>
```

Use that identifier in your Typst file with `#import`:

```typst
#import "@git/<package-name>:<package-version>": *
```

For example, a package whose `typst.toml` contains `name = "my-package"` and
`version = "1.0.0"` can be imported as:

```typst
#import "@git/my-package:1.0.0": *
```

```text
typst-dl <git-repository-url> [--namespace <name>] [--data-dir <path>] [--force]
```

Options:

- `--namespace`, `-n`: override the namespace, defaults to `git`
- `--data-dir`: override Typst's data directory
- `--force`: replace an already installed `{namespace}/{name}/{version}`
- `--help`, `-h`: print usage information

## Behavior

- Clones the repository with a shallow clone.
- Reads `typst.toml` from the repository root.
- Detects `package.name` and `package.version`.
- Installs the package to:

```text
{data-dir}/typst/packages/{namespace}/{name}/{version}
```

Default namespace: `git`

`{data-dir}` is resolved the same way Typst does:

- Linux: `$XDG_DATA_HOME` or `~/.local/share`
- macOS: `~/Library/Application Support`
- Windows: `%APPDATA%`

## Notes

- Currently supports HTTP(S) Git repository URLs.
- Respects `package.exclude` from `typst.toml`.
- Does not keep the cloned `.git` directory in the installed package.
