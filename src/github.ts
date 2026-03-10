import * as https from "https";

interface GitHubFile {
  name: string;
  path: string;
  download_url: string;
  type: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    "User-Agent": "ManifestVet/0.2.0",
    ...(token ? { Authorization: `token ${token}` } : {}),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGet(url: string, retries = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: getAuthHeaders() }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            httpsGet(res.headers.location, retries).then(resolve).catch(reject);
            return;
          }
        }

        if (
          (res.statusCode === 429 ||
            (res.statusCode === 403 &&
              res.headers["x-ratelimit-remaining"] === "0")) &&
          retries > 0
        ) {
          const resetAt = parseInt(res.headers["x-ratelimit-reset"] as string, 10);
          const waitMs = resetAt
            ? Math.max(0, resetAt * 1000 - Date.now()) + 1000
            : 60_000;
          console.error(
            `[manifestvet] GitHub rate limit hit. Waiting ${Math.round(waitMs / 1000)}s...`
          );
          sleep(waitMs)
            .then(() => httpsGet(url, retries - 1))
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function listFiles(
  owner: string,
  repo: string,
  branch: string,
  filePath: string = ""
): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
  const data = await httpsGet(url);
  return JSON.parse(data);
}

async function fetchFile(downloadUrl: string): Promise<string> {
  return httpsGet(downloadUrl);
}

/**
 * Parse a GitHub blob URL into its components.
 * e.g. https://github.com/owner/repo/blob/main/path/to/file.yaml
 */
function parseBlobUrl(
  url: string
): { owner: string; repo: string; branch: string; filePath: string } | null {
  const m = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
  );
  if (!m) return null;
  return { owner: m[1], repo: m[2], branch: m[3], filePath: m[4] };
}

function isBlobUrl(arg: string): boolean {
  return arg.startsWith("https://github.com/") && arg.includes("/blob/");
}

async function fetchManifestFromBlobUrl(
  blobUrl: string
): Promise<{ path: string; content: string }[]> {
  const parsed = parseBlobUrl(blobUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub blob URL: "${blobUrl}"`);
  }
  const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.branch}/${parsed.filePath}`;
  const content = await fetchFile(rawUrl);
  return [{ path: parsed.filePath, content }];
}

export async function fetchManifestsFromGitHub(
  ownerRepoOrUrl: string,
  branch: string = "main",
  startPath: string = ""
): Promise<{ path: string; content: string }[]> {
  if (isBlobUrl(ownerRepoOrUrl)) {
    return fetchManifestFromBlobUrl(ownerRepoOrUrl);
  }

  const [owner, repo] = ownerRepoOrUrl.split("/");
  if (!owner || !repo) {
    throw new Error(
      `Invalid repository format: "${ownerRepoOrUrl}". Expected "owner/repo" or a GitHub blob URL.`
    );
  }

  const results: { path: string; content: string }[] = [];

  async function walk(dirPath: string): Promise<void> {
    const files = await listFiles(owner, repo, branch, dirPath);
    for (const file of files) {
      if (file.type === "dir") {
        await walk(file.path);
      } else if (
        file.name.endsWith(".yaml") ||
        file.name.endsWith(".yml")
      ) {
        const content = await fetchFile(file.download_url);
        results.push({ path: file.path, content });
      }
    }
  }

  await walk(startPath);
  return results;
}
