import * as https from "https";

interface GitHubFile {
  name: string;
  path: string;
  download_url: string;
  type: string;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: { "User-Agent": "ManifestVet/0.1.0" },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            if (res.headers.location) {
              httpsGet(res.headers.location).then(resolve).catch(reject);
              return;
            }
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
          res.on("error", reject);
        }
      )
      .on("error", reject);
  });
}

async function listFiles(
  owner: string,
  repo: string,
  branch: string,
  path: string = ""
): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const data = await httpsGet(url);
  return JSON.parse(data);
}

async function fetchFile(downloadUrl: string): Promise<string> {
  return httpsGet(downloadUrl);
}

export async function fetchManifestsFromGitHub(
  ownerRepo: string,
  branch: string = "main"
): Promise<{ path: string; content: string }[]> {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) {
    throw new Error(
      `Invalid repository format: "${ownerRepo}". Expected "owner/repo".`
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

  await walk("");
  return results;
}
