#!/usr/bin/env node

import { DEFAULT_TEMPLATES_DIR, downloadTemplate } from "./index";

async function main(): Promise<void> {
  const [, , inputUrl] = process.argv;

  if (!inputUrl) {
    console.error("Usage: typst-download <github-repository-url>");
    console.error(`Templates directory: ${DEFAULT_TEMPLATES_DIR}`);
    process.exitCode = 1;
    return;
  }

  try {
    const destination = await downloadTemplate(inputUrl);
    console.log(`Downloaded template to ${destination}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
