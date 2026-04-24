#!/usr/bin/env node

import { DEFAULT_NAMESPACE, downloadTemplate, getTypstPackagesDir, resolveTypstDataDir } from "./index";

interface CliOptions {
  inputUrl?: string;
  namespace: string;
  dataDir?: string;
}

function printUsage(): void {
  console.error("Usage: typst-download <github-repository-url> [--namespace <name>] [--data-dir <path>]");
  console.error(`Default namespace: ${DEFAULT_NAMESPACE}`);
  console.error(`Default Typst packages directory: ${getTypstPackagesDir(resolveTypstDataDir())}`);
}

function parseArguments(argv: string[]): CliOptions {
  const options: CliOptions = {
    namespace: DEFAULT_NAMESPACE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      printUsage();
      process.exit(0);
    }

    if (argument === "--namespace" || argument === "-n") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --namespace.");
      }

      options.namespace = value;
      index += 1;
      continue;
    }

    if (argument === "--data-dir") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --data-dir.");
      }

      options.dataDir = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (options.inputUrl) {
      throw new Error("Only one GitHub repository URL can be provided.");
    }

    options.inputUrl = argument;
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  if (!options.inputUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const installed = await downloadTemplate(options.inputUrl, {
      namespace: options.namespace,
      dataDir: options.dataDir,
    });
    console.log(`Installed @${installed.namespace}/${installed.name}:${installed.version}`);
    console.log(installed.destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
