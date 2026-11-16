import { getAgentDir, type ExtensionAPI, type ExtensionContext, type ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { lstat, mkdir, realpath, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { registerCommandGuards } from "./shell-commands.ts";
import { loadPackagePolicy, type PackagePolicy } from "./package-policy.ts";

const STATE_TYPE = "path-intent";
const READ_TOOLS = new Set(["read", "grep", "find", "ls"]);
// Pi completion quotes paths containing separators such as whitespace. Do not
// strip punctuation: it may be part of the explicitly named filename.
const REFERENCE = /(?:^|[\s(`])@(?:"([^"]+)"|'([^']+)'|([^\s"'`<>()[\]{}]+))(?=$|[\s`),.;:!?])/gu;

type ReadGrant = { path: string; directory: boolean };
type StateChange = { grants: ReadGrant[] } | { yolo: boolean };
type PathRequest = {
	feature: string;
	action: { kind: string; path?: string };
	toolName: string;
};

function absolutePath(path: string, cwd: string): string {
	return resolve(cwd, path.replace(/^~(?=$|\/)/, homedir()));
}

function within(path: string, directory: string): boolean {
	const rel = relative(directory, path);
	return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("../"));
}

// Resolve existing ancestors too, so new scratch files get the same boundary
// checks as existing files without following symlinks outside a trusted root.
async function canonicalPath(path: string): Promise<string | undefined> {
	let ancestor = resolve(path);
	const suffix: string[] = [];
	while (true) {
		try {
			return join(await realpath(ancestor), ...suffix);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT" || dirname(ancestor) === ancestor) return;
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

async function initializeCommonAccess(pi: ExtensionAPI): Promise<{
	readRoots: string[];
	scratch?: string;
	warnings: string[];
}> {
	const home = homedir();
	const data = process.env.XDG_DATA_HOME ?? join(home, ".local/share");
	const roots = [
		join(home, "dotfiles"), join(home, ".agents"), join(home, ".pi/agent"),
		join(home, ".pi/profiles"), getAgentDir(),
		join(home, "go/pkg/mod"), join(home, ".gem"), join(data, "gem"),
		join(process.env.MISE_DATA_DIR ?? join(data, "mise"), "installs"),
		join(home, "Library/pnpm/store"), join(home, "Library/pnpm/global"),
		join(data, "pnpm/store"), join(data, "pnpm/global"),
		tmpdir(), "/tmp", "/var/tmp",
	];
	if (process.env.GOMODCACHE) roots.push(process.env.GOMODCACHE);
	for (const path of (process.env.GOPATH ?? "").split(delimiter).filter(Boolean)) roots.push(join(path, "pkg/mod"));
	if (process.env.GEM_HOME) roots.push(process.env.GEM_HOME);
	roots.push(...(process.env.GEM_PATH ?? "").split(delimiter).filter(Boolean));
	if (process.env.PNPM_HOME) roots.push(join(process.env.PNPM_HOME, "store"), join(process.env.PNPM_HOME, "global"));

	// Discover active custom installations once per extension load, outside any
	// project so project-local package-manager configuration does not run here.
	const queries = [
		{ command: "go", args: ["env", "-json", "GOMODCACHE", "GOROOT"], paths: (out: string): string[] => {
			const value = JSON.parse(out);
			return [value.GOMODCACHE, value.GOROOT];
		} },
		{ command: "ruby", args: ["-rjson", "-rrubygems", "-e", "puts JSON.generate(Gem.path + [RbConfig::CONFIG['rubylibprefix']])"], paths: (out: string): string[] => JSON.parse(out) },
		{ command: "pnpm", args: ["store", "path"], paths: (out: string): string[] => [out.trim()] },
	];
	const discoveries = await Promise.allSettled(queries.map(async (query) => {
		const result = await pi.exec(query.command, query.args, { cwd: home, timeout: 5000, maxBuffer: 16384 });
		if (result.code !== 0) throw new Error(`${query.command} exited ${result.code}`);
		const paths = query.paths(result.stdout);
		if (!Array.isArray(paths)) throw new Error("Installation paths must be an array");
		return paths;
	}));
	const warnings: string[] = [];
	for (const [index, result] of discoveries.entries()) {
		if (result.status === "fulfilled") roots.push(...result.value);
		else warnings.push(`Could not discover ${queries[index].command} inspection paths; standard paths remain available.`);
	}
	const canonical = await Promise.allSettled(roots
		.filter((path) => typeof path === "string" && isAbsolute(path) && path !== "/" && path !== home)
		.map(canonicalPath));
	const canonicalHome = await realpath(home);
	const readRoots = [...new Set(canonical.flatMap((result) => result.status === "fulfilled" &&
		result.value && result.value !== "/" && result.value !== canonicalHome ? [result.value] : []))];

	let scratch: string | undefined;
	const candidate = join(tmpdir(), `pi-scratch-${process.getuid?.() ?? "user"}`);
	try {
		await mkdir(candidate, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "EEXIST") throw error;
		});
		const info = await lstat(candidate);
		if (!info.isDirectory() || (info.mode & 0o077) !== 0 ||
			(process.getuid && info.uid !== process.getuid())) throw new Error("Scratch directory is not private and owned by this user");
		scratch = await realpath(candidate);
	} catch {
		warnings.push("Pi scratch access is disabled: its directory is missing, shared, symlinked, or not owned by this user.");
	}
	return { readRoots, scratch, warnings };
}

// Check both identities before normalizing the target for the path gate.
async function prepareFileCall(event: ToolCallEvent, cwd: string, policy: PackagePolicy) {
	if (!READ_TOOLS.has(event.toolName) && event.toolName !== "write" && event.toolName !== "edit") return;
	const input = event.input as Record<string, unknown>;
	// Native tools execute `path`; the package also accepts a legacy alias.
	// Never let that unused argument shadow the file the tool will access.
	delete input.file_path;
	const raw = input.path ?? (["grep", "find", "ls"].includes(event.toolName) ? "." : undefined);
	if (typeof raw !== "string") return;
	const requested = absolutePath(raw.replace(/^@/, ""), cwd);
	const originalDenial = await policy.fileDenial(requested, event.toolName, cwd);
	if (originalDenial) return { block: true as const, reason: originalDenial };
	const path = await canonicalPath(requested);
	if (!path) return { block: true as const, reason: "Cannot safely resolve this file target. For a dangling symlink, use its target path directly." };
	const resolvedDenial = path === requested ? undefined : await policy.fileDenial(path, event.toolName, cwd);
	if (resolvedDenial) return { block: true as const, reason: resolvedDenial };
	const canonicalCwd = await canonicalPath(cwd);
	// Preserve the workspace spelling when cwd itself is a symlink.
	input.path = canonicalCwd && within(path, canonicalCwd) ? resolve(cwd, relative(canonicalCwd, path)) : path;
	return { path, canonicalCwd };
}

async function inspectionGrants(paths: { kind: string; path: string }[]): Promise<ReadGrant[]> {
	const grants: ReadGrant[] = [];
	for (const item of paths) {
		const path = await canonicalPath(item.path);
		if (path) grants.push({ path, directory: item.kind === "directory" });
	}
	return grants;
}

export default async function pathIntent(pi: ExtensionAPI): Promise<void> {
	const policy = await loadPackagePolicy();
	const common = await initializeCommonAccess(pi);
	const documentation = await inspectionGrants(policy.documentationPaths);
	let skills: ReadGrant[] = [];
	const grants = new Map<string, ReadGrant>();
	let yolo = false;
	pi.on("tool_call", async (event, ctx) => {
		const target = await prepareFileCall(event, ctx.cwd, policy);
		if (target && "block" in target) return target;
		if (yolo || READ_TOOLS.has(event.toolName) || (!target && event.toolName !== "bash")) return;
		const paths = target ? [target.path] : event.toolName === "bash"
			? await policy.shellTargets(event.input as Record<string, unknown>, ctx.cwd, pi.exec) : [];
		const cwd = target?.canonicalCwd ?? await canonicalPath(ctx.cwd);
		// Bash is not read-only. Cover its recognized file actions as well as
		// native writes, without trying to infer arbitrary script effects.
		for (const requested of paths) {
			const path = target ? requested : await canonicalPath(requested);
			if (!path || (cwd && within(path, cwd)) || (common.scratch && within(path, common.scratch))) continue;
			// The package's built-in inspection grants otherwise allow writes too.
			if (![...documentation, ...skills].some((grant) => [requested, path].some((candidate) => candidate === grant.path || (grant.directory && within(candidate, grant.path))))) continue;
			const operation = event.toolName === "bash" ? String(event.input.command) : `${event.toolName}: ${path}`;
			if (!ctx.hasUI || !await ctx.ui.confirm("Allow external documentation or skill operation?", operation)) {
				return { block: true, reason: "External documentation or skill operation was not approved." };
			}
			return;
		}
	});
	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "grep" || event.isError) return;
		const root = absolutePath(typeof event.input.path === "string" ? event.input.path : ".", ctx.cwd);
		if (!(await stat(root).catch(() => undefined))?.isDirectory()) return;
		// Native grep emits file:line: matches and file-line- context rows.
		// Check every possible prefix so colons in filenames cannot hide a name.
		const withheld = (reason: string) => ({
			content: [{ type: "text" as const, text: `Search output withheld: ${reason} Narrow the glob to non-protected source files.` }],
			details: {},
			isError: true,
		});
		for (const block of event.content) {
			if (block.type !== "text") continue;
			const lines = block.text.split("\n");
			for (const [index, line] of lines.entries()) {
				const prefixes = [...line.matchAll(/:\d+: |-\d+- /g)];
				if (!prefixes.length && line && line !== "No matches found" &&
					!(index === lines.length - 1 && line.startsWith("[") && line.endsWith("]"))) {
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
	// Local renderers take precedence over package renderers. Keep delegated
	// decisions in session history without a transcript row for every access.
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
		description: "Approve external paths and cloud operations; keep credential, Git, Terraform, and publishing safeguards",
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
		description: "Toggle external-path and cloud-operation approval; keep credential and other command safeguards",
		handler: async (ctx) => setYolo(!yolo, ctx),
	});

	pi.on("session_start", (event, ctx) => {
		restore(ctx);
		if (event.reason !== "reload" && pi.getFlag("yolo") === true) setYolo(true, ctx);
		if (ctx.hasUI && common.warnings.length) ctx.ui.notify(common.warnings.join("\n"), "warning");
	});
	pi.on("before_agent_start", async (event, ctx) => {
		const activeSkills = event.systemPromptOptions?.skills;
		if (activeSkills?.length) skills = await inspectionGrants(activeSkills.flatMap((skill) => [
			{ kind: "directory", path: skill.baseDir }, { kind: "file", path: skill.filePath },
		]));
		if (ctx.hasUI && common.scratch) {
			return { systemPrompt: `${event.systemPrompt}\n\nUse ${JSON.stringify(common.scratch)} for disposable code and scratch files. This directory allows ordinary reads, writes, and edits; credential blocks and dangerous-command confirmations still apply.` };
		}
	});
	pi.on("session_tree", (_event, ctx) => restore(ctx));

	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return;
		const added: ReadGrant[] = [];
		for (const match of event.text.matchAll(REFERENCE)) {
			const path = absolutePath(match[1] ?? match[2] ?? match[3], ctx.cwd);
			try {
				const canonical = await realpath(path);
				const info = await stat(canonical);
				if (!info.isFile() && !info.isDirectory()) continue;
				const grant = { path: canonical, directory: info.isDirectory() };
				if (grants.get(canonical)?.directory === grant.directory) continue;
				grants.set(canonical, grant);
				added.push(grant);
			} catch {
				// Missing or inaccessible references grant nothing; the normal gate
				// still decides any later access to the path.
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
			// Shell commands can write even when they look like reads. Common
			// inspection paths and @ references authorize read-only tools only.
			if (!READ_TOOLS.has(request.toolName)) return;
			if (common.readRoots.some((root) => within(path, root)) || path.split("/").includes("node_modules")) {
				return { verdict: "allow", reason: "Trusted configuration, dependency, runtime, or temporary path" };
			}
			for (const grant of grants.values()) {
				if (path === grant.path || (grant.directory && within(path, grant.path))) {
					return { verdict: "allow", reason: "User explicitly referenced this file or directory with @" };
				}
			}
		},
	};
	const register = () => pi.events.emit("guardrails:delegate:register", { delegate });
	pi.events.on("guardrails:delegate:request", register);
	register();
}
