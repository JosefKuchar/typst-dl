#!/usr/bin/env node

import { parseArgs } from "node:util";
import { DEFAULT_NAMESPACE, downloadTemplate, getTypstPackagesDir, resolveTypstDataDir } from "./index";

const USAGE =
  "Usage: typst-download <git-repository-url> [--namespace <name>] [--data-dir <path>] [--force]";

interface CliOptions {
  inputUrl?: string;
  namespace: string;
  dataDir?: string;
  force: boolean;
}

function printUsage(): void {
  console.error(USAGE);
  console.error(`Default namespace: ${DEFAULT_NAMESPACE}`);
  console.error(`Default Typst packages directory: ${getTypstPackagesDir(resolveTypstDataDir())}`);
}

function parseArguments(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      namespace: {
        type: "string",
        short: "n",
        default: DEFAULT_NAMESPACE,
      },
      "data-dir": {
        type: "string",
      },
      force: {
        type: "boolean",
        default: false,
      },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (positionals.length > 1) {
    throw new Error("Only one Git repository URL can be provided.");
  }

  return {
    inputUrl: positionals[0],
    namespace: values.namespace,
    dataDir: values["data-dir"],
    force: values.force,
  };
}

async function run(options: CliOptions): Promise<void> {
  if (!options.inputUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const installed = await downloadTemplate(options.inputUrl, {
      namespace: options.namespace,
      dataDir: options.dataDir,
      force: options.force,
    });
    console.log(`Installed @${installed.namespace}/${installed.name}:${installed.version}`);
    console.log(installed.destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  await run(parseArguments(process.argv.slice(2)));
}

void main();
