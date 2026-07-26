import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CANONICAL_STABLE_RELEASE_BRANCH,
  verifyStableReleaseCandidate,
} from "./verify-stable-release-candidate.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "openclaw-stable-policy-"));
  roots.push(root);
  git(root, "init", "-b", CANONICAL_STABLE_RELEASE_BRANCH);
  git(root, "config", "user.email", "stable-policy@example.invalid");
  git(root, "config", "user.name", "Stable Policy Test");
  writeFileSync(join(root, "package.json"), '{"version":"2026.7.1"}\n');
  writeFileSync(join(root, "gate.yml"), "trusted gate\n");
  writeFileSync(join(root, "policy.mjs"), "trusted policy\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "stable");
  const stableSha = git(root, "rev-parse", "HEAD");
  writeFileSync(join(root, "feature.txt"), "structured yield\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "feature");
  const digest = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
  const options = {
    repo: root,
    baseBranch: CANONICAL_STABLE_RELEASE_BRANCH,
    approvedStableSha: stableSha,
    protectedBaseSha: stableSha,
    trustedFiles: [
      { path: "gate.yml", sha256: digest("gate.yml") },
      { path: "policy.mjs", sha256: digest("policy.mjs") },
    ],
  };
  return { root, stableSha, options };
}

void describe("stable release candidate policy", () => {
  void it("accepts an exact-version descendant of the protected stable base", () => {
    assert.equal(verifyStableReleaseCandidate(fixture().options).ok, true);
  });

  void it("rejects a divergent candidate without approved stable ancestry", () => {
    const { root, options } = fixture();
    git(root, "checkout", "--orphan", "divergent");
    git(root, "rm", "-rf", ".");
    writeFileSync(join(root, "package.json"), '{"version":"2026.7.1"}\n');
    writeFileSync(join(root, "gate.yml"), "trusted gate\n");
    writeFileSync(join(root, "policy.mjs"), "trusted policy\n");
    git(root, "add", ".");
    git(root, "commit", "-m", "divergent");
    assert.throws(() => verifyStableReleaseCandidate(options), /approved_stable_ancestry_missing/);
  });

  void it("rejects a version regression", () => {
    const { root, options } = fixture();
    writeFileSync(join(root, "package.json"), '{"version":"2026.6.10"}\n');
    assert.throws(() => verifyStableReleaseCandidate(options), /version_regression/);
  });

  void it("rejects an altered trusted gate definition", () => {
    const { root, options } = fixture();
    writeFileSync(join(root, "gate.yml"), "weakened gate\n");
    assert.throws(() => verifyStableReleaseCandidate(options), /trusted_gate_definition_changed:gate.yml/);
  });

  void it("rejects the wrong merge target branch", () => {
    const { options } = fixture();
    assert.throws(
      () => verifyStableReleaseCandidate({ ...options, baseBranch: "main" }),
      /wrong_base_branch:main/,
    );
  });
});
