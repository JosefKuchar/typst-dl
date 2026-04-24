import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

/**
 * Default Typst package namespace used by the CLI and library entrypoints.
 */
export const DEFAULT_NAMESPACE = "git";

export interface RepositoryInfo {
  tempDirName: string;
  cloneUrl: string;
}

export interface PackageInfo {
  name: string;
  version: string;
  exclude: string[];
}

export interface DownloadOptions {
  namespace?: string;
  dataDir?: string;
  force?: boolean;
}

export interface InstalledTemplate {
  destination: string;
  namespace: string;
  name: string;
  version: string;
}

/**
 * Parse and validate a Git repository URL supported by the downloader.
 */
export function parseGitRepositoryUrl(input: string): RepositoryInfo {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP(S) Git repository URLs are currently supported.");
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const repoSegment = pathSegments[pathSegments.length - 1];

  if (!repoSegment) {
    throw new Error("Expected a Git repository URL with a repository path.");
  }

  const tempDirName = repoSegment.endsWith(".git")
    ? repoSegment.slice(0, -".git".length)
    : repoSegment;

  if (!tempDirName) {
    throw new Error("Repository name could not be determined from the URL.");
  }

  return {
    tempDirName,
    cloneUrl: input,
  };
}

/**
 * Resolve the Typst data directory using the same platform-specific rules as Typst.
 */
export function resolveTypstDataDir(): string {
  const homeDir = os.homedir();

  if (process.platform === "win32") {
    return process.env.APPDATA ?? path.join(homeDir, "AppData", "Roaming");
  }

  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support");
  }

  return process.env.XDG_DATA_HOME ?? path.join(homeDir, ".local", "share");
}

/**
 * Resolve the base package directory used by Typst for installed packages.
 */
export function getTypstPackagesDir(dataDir = resolveTypstDataDir()): string {
  return path.join(dataDir, "typst", "packages");
}

/**
 * Resolve the final destination for a package installation.
 */
export function getTemplateDestination(
  packageInfo: PackageInfo,
  namespace = DEFAULT_NAMESPACE,
  dataDir = resolveTypstDataDir(),
): string {
  return path.join(getTypstPackagesDir(dataDir), namespace, packageInfo.name, packageInfo.version);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Read and validate the package metadata from the repository's `typst.toml`.
 */
export async function readPackageInfo(repoDir: string): Promise<PackageInfo> {
  const manifestPath = path.join(repoDir, "typst.toml");

  if (!fs.existsSync(manifestPath)) {
    throw new Error("Repository root does not contain typst.toml.");
  }

  const { parse: parseToml } = await import("smol-toml");
  const parsed = parseToml(fs.readFileSync(manifestPath, "utf8"));

  if (!isRecord(parsed) || !isRecord(parsed.package)) {
    throw new Error("typst.toml is missing a [package] table.");
  }

  const { name, version, exclude } = parsed.package;

  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("typst.toml is missing package.name.");
  }

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error("typst.toml is missing package.version.");
  }

  if (exclude !== undefined) {
    if (!Array.isArray(exclude) || exclude.some((entry) => typeof entry !== "string")) {
      throw new Error("typst.toml package.exclude must be an array of strings.");
    }
  }

  const excludeEntries = exclude === undefined ? [] : (exclude as string[]);

  return {
    name,
    version,
    exclude: excludeEntries,
  };
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/").replace(/^\.\/+/u, "").replace(/\/+$/u, "");
}

function shouldExcludePath(repoDir: string, filePath: string, excludes: readonly string[]): boolean {
  const relativePath = normalizeRelativePath(path.relative(repoDir, filePath));

  if (relativePath === "") {
    return false;
  }

  return excludes.some((entry) => {
    const normalizedEntry = normalizeRelativePath(entry);
    return relativePath === normalizedEntry || relativePath.startsWith(`${normalizedEntry}/`);
  });
}

/**
 * Validate and normalize a Typst package namespace.
 */
export function validateNamespace(namespace: string): string {
  const normalized = namespace.trim();

  if (normalized === "") {
    throw new Error("Namespace must not be empty.");
  }

  if (normalized.includes("/") || normalized.includes("\\") || normalized.includes(":")) {
    throw new Error("Namespace must not contain path separators.");
  }

  return normalized;
}

function createTemporaryCloneDir(tempDirName: string): { tempRoot: string; tempCloneDir: string } {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "typst-dl-"));
  return {
    tempRoot,
    tempCloneDir: path.join(tempRoot, tempDirName),
  };
}

async function cloneRepository(repo: RepositoryInfo, tempCloneDir: string): Promise<void> {
  try {
    await git.clone({
      fs,
      http,
      dir: tempCloneDir,
      url: repo.cloneUrl,
      singleBranch: true,
      depth: 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clone ${repo.cloneUrl}: ${message}`);
  }
}

function ensureDestinationAvailable(destination: string, force: boolean): void {
  if (!fs.existsSync(destination)) {
    return;
  }

  if (!force) {
    throw new Error(`Package already exists: ${destination}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
}

function copyPackageFiles(repoDir: string, destination: string, excludeEntries: readonly string[]): void {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(repoDir, destination, {
    recursive: true,
    filter: (source) => {
      if (source === repoDir) {
        return true;
      }

      if (path.basename(source) === ".git") {
        return false;
      }

      return !shouldExcludePath(repoDir, source, excludeEntries);
    },
  });
  fs.rmSync(path.join(destination, ".git"), { recursive: true, force: true });
}

async function installClonedPackage(
  repoDir: string,
  namespace: string,
  dataDir: string,
  force: boolean,
): Promise<InstalledTemplate> {
  const packageInfo = await readPackageInfo(repoDir);
  const destination = getTemplateDestination(packageInfo, namespace, dataDir);

  ensureDestinationAvailable(destination, force);

  try {
    copyPackageFiles(repoDir, destination, packageInfo.exclude);
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }

  return {
    destination,
    namespace,
    name: packageInfo.name,
    version: packageInfo.version,
  };
}

/**
 * Clone a Typst package repository and install it into Typst's local package directory.
 */
export async function downloadTemplate(
  inputUrl: string,
  options: DownloadOptions = {},
): Promise<InstalledTemplate> {
  const repo = parseGitRepositoryUrl(inputUrl);
  const namespace = validateNamespace(options.namespace ?? DEFAULT_NAMESPACE);
  const dataDir = options.dataDir ?? resolveTypstDataDir();
  const force = options.force ?? false;
  const { tempRoot, tempCloneDir } = createTemporaryCloneDir(repo.tempDirName);

  try {
    await cloneRepository(repo, tempCloneDir);
    return await installClonedPackage(tempCloneDir, namespace, dataDir, force);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
