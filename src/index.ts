import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

export const DEFAULT_TEMPLATES_DIR = path.resolve(process.cwd(), "templates");

export interface RepositoryInfo {
  owner: string;
  repo: string;
  cloneUrl: string;
}

export function parseGithubRepositoryUrl(input: string): RepositoryInfo {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only github.com repository URLs are supported.");
  }

  const [owner, repoSegment] = url.pathname.split("/").filter(Boolean);

  if (!owner || !repoSegment) {
    throw new Error("Expected a GitHub repository URL in the form https://github.com/<owner>/<repo>.");
  }

  const repo = repoSegment.endsWith(".git")
    ? repoSegment.slice(0, -".git".length)
    : repoSegment;

  if (!repo) {
    throw new Error("Repository name could not be determined from the URL.");
  }

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
  };
}

export function getTemplateDestination(
  repo: RepositoryInfo,
  templatesDir = DEFAULT_TEMPLATES_DIR,
): string {
  return path.join(templatesDir, repo.owner, repo.repo);
}

export async function downloadTemplate(
  inputUrl: string,
  templatesDir = DEFAULT_TEMPLATES_DIR,
): Promise<string> {
  const repo = parseGithubRepositoryUrl(inputUrl);
  const destination = getTemplateDestination(repo, templatesDir);

  if (fs.existsSync(destination)) {
    throw new Error(`Destination already exists: ${destination}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });

  try {
    await git.clone({
      fs,
      http,
      dir: destination,
      url: repo.cloneUrl,
      singleBranch: true,
      depth: 1,
    });
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clone ${repo.cloneUrl}: ${message}`);
  }

  return destination;
}
