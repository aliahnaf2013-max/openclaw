#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CANONICAL_STABLE_RELEASE_BRANCH = "pulse-v2026.7.1-base";
export const APPROVED_STABLE_VERSION = "2026.7.1";

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function verifyStableReleaseCandidate(options) {
  const repo = resolve(options.repo);
  if (options.baseBranch !== CANONICAL_STABLE_RELEASE_BRANCH) {
    throw new Error(`wrong_base_branch:${options.baseBranch}`);
  }
  if (!/^[0-9a-f]{40}$/.test(options.approvedStableSha)) {
    throw new Error("approved_stable_sha_invalid");
  }
  if (!/^[0-9a-f]{40}$/.test(options.protectedBaseSha)) {
    throw new Error("protected_base_sha_invalid");
  }

  const packageJson = JSON.parse(readFileSync(resolve(repo, "package.json"), "utf8"));
  if (packageJson.version !== APPROVED_STABLE_VERSION) {
    throw new Error(`version_regression:${String(packageJson.version)}`);
  }

  try {
    git(repo, "merge-base", "--is-ancestor", options.approvedStableSha, "HEAD");
  } catch {
    throw new Error("approved_stable_ancestry_missing");
  }
  try {
    git(repo, "merge-base", "--is-ancestor", options.protectedBaseSha, "HEAD");
  } catch {
    throw new Error("protected_base_ancestry_missing");
  }

  for (const trusted of options.trustedFiles) {
    const path = resolve(repo, trusted.path);
    const actual = sha256(path);
    if (actual !== trusted.sha256) {
      throw new Error(`trusted_gate_definition_changed:${trusted.path}`);
    }
  }

  return {
    ok: true,
    head_sha: git(repo, "rev-parse", "HEAD"),
    approved_stable_sha: options.approvedStableSha,
    protected_base_sha: options.protectedBaseSha,
    base_branch: options.baseBranch,
    package_version: packageJson.version,
    trusted_files: options.trustedFiles,
  };
}

function parseArgs(argv) {
  const values = new Map();
  const trustedFiles = [];
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value == null) {
      throw new Error(`invalid_argument:${flag}`);
    }
    index += 1;
    if (flag === "--trusted-file") {
      const separator = value.lastIndexOf("=");
      if (separator <= 0) {
        throw new Error("trusted_file_argument_invalid");
      }
      const path = value.slice(0, separator);
      const digest = value.slice(separator + 1);
      if (!/^[0-9a-f]{64}$/.test(digest)) {
        throw new Error("trusted_file_digest_invalid");
      }
      trustedFiles.push({ path, sha256: digest });
    } else {
      values.set(flag, value);
    }
  }
  if (trustedFiles.length === 0) {
    throw new Error("trusted_files_required");
  }
  return {
    repo: values.get("--repo") ?? "",
    baseBranch: values.get("--base-branch") ?? "",
    approvedStableSha: values.get("--approved-stable-sha") ?? "",
    protectedBaseSha: values.get("--protected-base-sha") ?? "",
    trustedFiles,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.stdout.write(`${JSON.stringify(verifyStableReleaseCandidate(parseArgs(process.argv.slice(2))))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
