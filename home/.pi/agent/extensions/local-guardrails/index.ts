import { lstat, mkdir, realpath, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
  type ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

import { loadPackagePolicy, type InspectionPath, type PackagePolicy } from "./package-policy.ts";
import { registerCommandGuards } from "./shell-commands.ts";

const STATE_TYPE = "path-intent";
const READ_TOOLS = new Set(["read", "grep", "find", "ls"]);
// Completion can quote paths. Punctuation can belong to the referenced filename.
const REFERENCE = /(?:^|[\s(`])@(?:"([^"]+)"|'([^']+)'|([^\s"'`<>()[\]{}]+))(?=$|[\s`),.;:!?])/gu;

interface ReadGrant {
  readonly path: string;
  readonly directory: boolean;
}

type StateChange = { grants: ReadGrant[] } | { yolo: boolean };
type FileDenial = { block: true; reason: string };

interface FileTarget {
  readonly requested: string;
  readonly path: string;
}

interface PreparedFileTarget extends FileTarget {
  readonly workspace: string | undefined;
}

interface CommonAccess {
  readonly readRoots: readonly string[];
  readonly scratch: string | undefined;
  readonly warnings: readonly string[];
}

interface PathRequest {
  readonly feature: string;
  readonly action: { kind: string; path?: string };
  readonly toolName: string;
}

function absolutePath(path: string, cwd: string): string {
  return resolve(cwd, path.replace(/^~(?=$|\/)/, homedir()));
}

function within(path: string, directory: string): boolean {
  const rel = relative(directory, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("../"));
}

function matchesGrant(path: string, grant: ReadGrant): boolean {
  return path === grant.path || (grant.directory && within(path, grant.path));
}

/**
 * Resolves existing ancestors for paths that do not exist yet.
 * Returns undefined for dangling links or inaccessible ancestors.
 */
async function canonicalPath(path: string): Promise<string | undefined> {
  let ancestor = resolve(path);
  const suffix: string[] = [];
  while (true) {
    try {
      return join(await realpath(ancestor), ...suffix);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || dirname(ancestor) === ancestor)
        return;
      // ENOENT can mean a dangling symlink, not a genuinely absent suffix.
      try {
        if ((await lstat(ancestor)).isSymbolicLink()) return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
      }
      suffix.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
    }
  }
}

async function initializeCommonAccess(pi: ExtensionAPI): Promise<CommonAccess> {
  const home = homedir();
  const data = process.env.XDG_DATA_HOME ?? join(home, ".local/share");
  // JSON path grants include writes. Keep inspection-only grants covered by these read roots.
  const roots = [
    join(home, "dotfiles"),
    join(home, ".agents"),
    join(home, ".pi/agent"),
    join(home, ".pi/profiles"),
    getAgentDir(),
    join(home, "go/pkg/mod"),
    join(home, ".gem"),
    join(data, "gem"),
    join(process.env.MISE_DATA_DIR ?? join(data, "mise"), "installs"),
    join(home, "Library/pnpm/store"),
    join(home, "Library/pnpm/global"),
    join(data, "pnpm/store"),
    join(data, "pnpm/global"),
    tmpdir(),
    "/tmp",
    "/var/tmp",
  ];
  if (process.env.GOMODCACHE) roots.push(process.env.GOMODCACHE);
  for (const path of (process.env.GOPATH ?? "").split(delimiter).filter(Boolean))
    roots.push(join(path, "pkg/mod"));
  if (process.env.GEM_HOME) roots.push(process.env.GEM_HOME);
  roots.push(...(process.env.GEM_PATH ?? "").split(delimiter).filter(Boolean));
  if (process.env.PNPM_HOME)
    roots.push(join(process.env.PNPM_HOME, "store"), join(process.env.PNPM_HOME, "global"));

  // Run from home so project-local package-manager configuration does not execute.
  const queries = [
    {
      command: "go",
      args: ["env", "-json", "GOMODCACHE", "GOROOT"],
      paths: (out: string): string[] => {
        const value = JSON.parse(out);
        return [value.GOMODCACHE, value.GOROOT];
      },
    },
    {
      command: "ruby",
      args: [
        "-rjson",
        "-rrubygems",
        "-e",
        "puts JSON.generate(Gem.path + [RbConfig::CONFIG['rubylibprefix']])",
      ],
      paths: (out: string): string[] => JSON.parse(out),
    },
    { command: "pnpm", args: ["store", "path"], paths: (out: string): string[] => [out.trim()] },
  ];
  const discoveries = await Promise.all(
    queries.map(async (query) => {
      try {
        const result = await pi.exec(query.command, query.args, {
          cwd: home,
          timeout: 5000,
          maxBuffer: 16384,
        });
        if (result.code !== 0) throw new Error(`${query.command} exited ${result.code}`);
        const paths = query.paths(result.stdout);
        if (!Array.isArray(paths)) throw new Error("Installation paths must be an array");
        return { command: query.command, paths };
      } catch {
        return { command: query.command, paths: undefined };
      }
    }),
  );
  const warnings: string[] = [];
  for (const discovery of discoveries) {
    if (discovery.paths) {
      roots.push(...discovery.paths);
      continue;
    }
    warnings.push(
      `Could not discover ${discovery.command} inspection paths; standard paths remain available.`,
    );
  }
  const canonical = await Promise.all(
    roots
      .filter(
        (path) => typeof path === "string" && isAbsolute(path) && path !== "/" && path !== home,
      )
      .map(canonicalPath),
  );
  const canonicalHome = await realpath(home);
  const readRoots = new Set<string>();
  for (const path of canonical) {
    if (!path || path === "/" || path === canonicalHome) continue;
    readRoots.add(path);
  }

  let scratch: string | undefined;
  const candidate = join(tmpdir(), `pi-scratch-${process.getuid?.() ?? "user"}`);
  try {
    await mkdir(candidate, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    const info = await lstat(candidate);
    if (
      !info.isDirectory() ||
      (info.mode & 0o077) !== 0 ||
      (process.getuid && info.uid !== process.getuid())
    )
      throw new Error("Scratch directory is not private and owned by this user");
    scratch = await realpath(candidate);
  } catch {
    warnings.push(
      "Pi scratch access is disabled: its directory is missing, shared, symlinked, or not owned by this user.",
    );
  }
  return { readRoots: [...readRoots], scratch, warnings };
}

async function checkFileTarget(
  requested: string,
  toolName: string,
  cwd: string,
  policy: PackagePolicy,
): Promise<FileTarget | FileDenial> {
  const originalDenial = await policy.fileDenial(requested, toolName, cwd);
  if (originalDenial) return { block: true, reason: originalDenial };
  const path = await canonicalPath(requested);
  if (!path)
    return {
      block: true,
      reason:
        "Cannot safely resolve this file target. For a dangling symlink, use its target path directly.",
    };
  const resolvedDenial =
    path === requested ? undefined : await policy.fileDenial(path, toolName, cwd);
  if (resolvedDenial) return { block: true, reason: resolvedDenial };
  return { requested, path };
}

/** Normalizes native inputs before upstream's lexical path gate. */
async function prepareFileCall(
  event: ToolCallEvent,
  cwd: string,
  policy: PackagePolicy,
): Promise<PreparedFileTarget | FileDenial | undefined> {
  if (!READ_TOOLS.has(event.toolName) && event.toolName !== "write" && event.toolName !== "edit")
    return;
  const input = event.input as Record<string, unknown>;
  // Upstream's unused file_path alias must not shadow the native path.
  delete input.file_path;
  const raw = input.path ?? (["grep", "find", "ls"].includes(event.toolName) ? "." : undefined);
  if (typeof raw !== "string") return;
  const requested = absolutePath(raw.replace(/^@/, ""), cwd);
  const target = await checkFileTarget(requested, event.toolName, cwd, policy);
  if ("block" in target) return target;
  const { path } = target;
  const canonicalCwd = await canonicalPath(cwd);
  // Preserve the workspace spelling when cwd itself is a symlink.
  input.path =
    canonicalCwd && within(path, canonicalCwd) ? resolve(cwd, relative(canonicalCwd, path)) : path;
  return { ...target, workspace: canonicalCwd };
}

async function inspectionGrants(paths: readonly InspectionPath[]): Promise<ReadGrant[]> {
  const grants: ReadGrant[] = [];
  for (const item of paths) {
    const path = await canonicalPath(item.path);
    if (path) grants.push({ path, directory: item.kind === "directory" });
  }
  return grants;
}

/** Load before upstream hooks so native path normalization precedes their permission checks. */
export default async function pathIntent(pi: ExtensionAPI): Promise<void> {
  const policy = await loadPackagePolicy(pi.exec);
  const common = await initializeCommonAccess(pi);
  const documentation = await inspectionGrants(policy.documentationPaths);
  let skills: ReadGrant[] = [];
  const grants = new Map<string, ReadGrant>();
  let yolo = false;

  function needsSupplementalApproval(
    target: FileTarget,
    workspace: string | undefined,
    cwd: string,
  ): boolean {
    const { requested, path } = target;
    if (workspace && within(path, workspace)) return false;
    if (common.scratch && within(path, common.scratch)) return false;

    // Bash keeps its lexical operands. Upstream can miss a boundary escape through a symlink.
    if (within(requested, cwd)) return true;
    if (common.scratch && within(requested, common.scratch)) return true;
    // Inspection grants must not authorize external writes.
    if (common.readRoots.some((root) => within(path, root))) return true;

    const matches = (grant: ReadGrant) =>
      matchesGrant(requested, grant) || matchesGrant(path, grant);
    return documentation.some(matches) || skills.some(matches);
  }

  pi.on("tool_call", async (event, ctx) => {
    const target = await prepareFileCall(event, ctx.cwd, policy);
    if (target && "block" in target) return target;
    const targets: FileTarget[] = target ? [target] : [];
    if (event.toolName === "bash") {
      for (const requested of await policy.shellTargets(
        event.input as Record<string, unknown>,
        ctx.cwd,
      )) {
        const checked = await checkFileTarget(requested, "bash", ctx.cwd, policy);
        if ("block" in checked) return checked;
        targets.push(checked);
      }
    }
    // Check all file policies before approval or YOLO can return.
    if (yolo || READ_TOOLS.has(event.toolName) || !targets.length) return;
    const workspace = target?.workspace ?? (await canonicalPath(ctx.cwd));
    const external = targets.find((candidate) =>
      needsSupplementalApproval(candidate, workspace, ctx.cwd),
    );
    if (!external) return;
    const operation =
      event.toolName === "bash"
        ? String(event.input.command)
        : `${event.toolName}: ${external.path}`;
    if (!ctx.hasUI || !(await ctx.ui.confirm("Allow external file operation?", operation))) {
      return { block: true, reason: "External file operation was not approved." };
    }
  });
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "grep" || event.isError) return;
    const root = absolutePath(
      typeof event.input.path === "string" ? event.input.path : ".",
      ctx.cwd,
    );
    if (!(await stat(root).catch(() => undefined))?.isDirectory()) return;
    // Native grep emits file:line: matches and file-line- context rows.
    // Check every possible prefix so colons in filenames cannot hide a name.
    const withheld = (reason: string) => ({
      content: [
        {
          type: "text" as const,
          text: `Search output withheld: ${reason} Narrow the glob to non-protected source files.`,
        },
      ],
      details: {},
      isError: true,
    });
    for (const block of event.content) {
      if (block.type !== "text") continue;
      const lines = block.text.split("\n");
      for (const [index, line] of lines.entries()) {
        const prefixes = [...line.matchAll(/:\d+: |-\d+- /g)];
        if (
          !prefixes.length &&
          line &&
          line !== "No matches found" &&
          !(index === lines.length - 1 && line.startsWith("[") && line.endsWith("]"))
        ) {
          return withheld("Cannot safely identify a result filename.");
        }
        for (const match of prefixes) {
          const path = resolve(root, line.slice(0, match.index));
          const denial = await policy.fileDenial(path, "grep", ctx.cwd);
          if (denial) return withheld(denial);
        }
      }
    }
  });
  registerCommandGuards(pi, () => yolo, policy);
  // Keep delegated decisions in history without a transcript row for each access.
  pi.registerEntryRenderer("guardrails:decision", () => ({
    render: () => [],
    invalidate() {},
  }));

  function updateStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus("path-intent", yolo ? ctx.ui.theme.fg("error", "⚡ YOLO") : undefined);
  }

  function restore(ctx: ExtensionContext): void {
    grants.clear();
    yolo = false;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
      const change = entry.data as StateChange;
      if ("yolo" in change) yolo = change.yolo;
      if ("grants" in change) {
        for (const grant of change.grants) grants.set(grant.path, grant);
      }
    }
    updateStatus(ctx);
  }

  function setYolo(enabled: boolean, ctx: ExtensionContext): void {
    yolo = enabled;
    pi.appendEntry<StateChange>(STATE_TYPE, { yolo });
    updateStatus(ctx);
  }

  pi.registerFlag("yolo", {
    type: "boolean",
    default: false,
    description:
      "Approve external paths and cloud operations; keep credential, Git, Terraform, and publishing safeguards",
  });
  pi.registerCommand("yolo", {
    description: "Toggle external-path and cloud-operation approval; /yolo on|off",
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase();
      if (value && value !== "on" && value !== "off") {
        ctx.ui.notify("Usage: /yolo [on|off]", "warning");
        return;
      }
      setYolo(value ? value === "on" : !yolo, ctx);
    },
  });
  pi.registerShortcut("alt+shift+y", {
    description:
      "Toggle external-path and cloud-operation approval; keep credential and other command safeguards",
    handler: async (ctx) => setYolo(!yolo, ctx),
  });

  pi.on("session_start", (event, ctx) => {
    restore(ctx);
    if (event.reason !== "reload" && pi.getFlag("yolo") === true) setYolo(true, ctx);
    if (ctx.hasUI && common.warnings.length) ctx.ui.notify(common.warnings.join("\n"), "warning");
  });
  pi.on("before_agent_start", async (event, ctx) => {
    const activeSkills = event.systemPromptOptions?.skills;
    if (activeSkills?.length)
      skills = await inspectionGrants(
        activeSkills.flatMap((skill) => [
          { kind: "directory", path: skill.baseDir },
          { kind: "file", path: skill.filePath },
        ]),
      );
    if (ctx.hasUI && common.scratch) {
      return {
        systemPrompt: `${event.systemPrompt}\n\nUse ${JSON.stringify(common.scratch)} for disposable code and scratch files. This directory allows ordinary reads, writes, and edits; credential blocks and dangerous-command confirmations still apply.`,
      };
    }
  });
  pi.on("session_tree", (_event, ctx) => restore(ctx));

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return;
    const added: ReadGrant[] = [];
    for (const match of event.text.matchAll(REFERENCE)) {
      const path = absolutePath(match[1] ?? match[2] ?? match[3]!, ctx.cwd);
      try {
        const canonical = await realpath(path);
        const info = await stat(canonical);
        if (!info.isFile() && !info.isDirectory()) continue;
        const grant = { path: canonical, directory: info.isDirectory() };
        if (grants.get(canonical)?.directory === grant.directory) continue;
        grants.set(canonical, grant);
        added.push(grant);
      } catch {
        // Missing or inaccessible references grant nothing.
      }
    }
    if (added.length > 0) pi.appendEntry<StateChange>(STATE_TYPE, { grants: added });
  });

  const delegate = {
    id: "personal:path-intent",
    name: "personal path access",
    async decide(request: PathRequest, ctx: { cwd: string }) {
      if (request.feature !== "pathAccess" || request.action.kind !== "file") return;
      if (yolo) return { verdict: "allow", reason: "External-path YOLO is enabled" };
      if (!request.action.path) return;
      const path = await canonicalPath(absolutePath(request.action.path, ctx.cwd));
      if (!path) return;
      if (common.scratch && within(path, common.scratch)) {
        return { verdict: "allow", reason: "Dedicated Pi scratch directory" };
      }
      // Bash never qualifies as read-only, even for commands used for inspection.
      if (!READ_TOOLS.has(request.toolName)) return;
      if (
        common.readRoots.some((root) => within(path, root)) ||
        path.split("/").includes("node_modules")
      ) {
        return {
          verdict: "allow",
          reason: "Trusted configuration, dependency, runtime, or temporary path",
        };
      }
      for (const grant of grants.values()) {
        if (matchesGrant(path, grant)) {
          return {
            verdict: "allow",
            reason: "User explicitly referenced this file or directory with @",
          };
        }
      }
    },
  };
  const register = () => pi.events.emit("guardrails:delegate:register", { delegate });
  pi.events.on("guardrails:delegate:request", register);
  register();
}
