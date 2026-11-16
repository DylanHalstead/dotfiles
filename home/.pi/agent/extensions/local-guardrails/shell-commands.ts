import { getAgentDir, isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import type { PackagePolicy } from "./package-policy.ts";

// Use the shell parser shipped with the pinned guardrails package, not a
// second shell tokenizer with different quoting/substitution semantics.
const require = createRequire(join(getAgentDir(), "npm/node_modules/@aliou/pi-guardrails/package.json"));
const { parse } = require("@aliou/sh") as {
	parse(command: string): { ast: unknown; errors?: unknown[] };
};

type Decision = "none" | "read" | "confirm" | "secret";
const CLOUD = new Set(["aws", "gcloud", "kubectl"]);
const CLOUD_TEXT = /\b(?:aws|gcloud|kubectl)\b/;
const VALUE_OPTIONS = new Set([
	"--profile", "--region", "--output", "-o", "--query", "--endpoint-url",
	"--cli-connect-timeout", "--cli-read-timeout", "--ca-bundle",
	"--project", "--account", "--configuration", "--billing-project",
	"--impersonate-service-account", "--format", "--verbosity",
	"--context", "--namespace", "-n", "--cluster", "--user", "--server",
	"--request-timeout", "--as", "--as-group", "--kubeconfig", "--zone",
	"--filter", "--limit", "--sort-by", "--page-size", "--max-items", "--starting-token",
]);
const BOOLEAN_OPTIONS = new Set([
	"--no-cli-pager", "--no-paginate", "--debug", "--quiet", "--all-namespaces", "-A",
	"--show-labels", "--no-headers", "--help", "-h", "--version",
]);
const GCLOUD_GROUPS = new Set([
	"projects", "auth", "compute instances", "compute disks", "compute networks",
	"compute firewall-rules", "container clusters", "sql instances", "iam service-accounts",
	"storage buckets", "storage objects", "run services", "functions", "config configurations",
]);

function literal(node: unknown): string | undefined {
	if (!node || typeof node !== "object") return;
	const value = node as { type: string; value?: string; parts?: unknown[] };
	if (value.type === "Literal" || value.type === "SglQuoted") return value.value;
	if (value.type !== "Word" && value.type !== "DblQuoted") return;
	const parts = (value.parts ?? []).map(literal);
	return parts.every((part) => part !== undefined) ? parts.join("") : undefined;
}

function commands(node: unknown, result: (string | undefined)[][], normalized: string[]): void {
	if (!node || typeof node !== "object") return;
	const value = node as Record<string, unknown>;
	if (value.type === "SimpleCommand") {
		result.push(((value.words ?? []) as unknown[]).map(literal));
	}
	if (value.type === "Pipeline") {
		const stages = value.commands as { command: { type: string; words?: unknown[] } }[];
		if (stages.every((stage) => stage.command.type === "SimpleCommand")) {
			const pipeline = stages.map((stage) => policyCommand((stage.command.words ?? []).map(literal)));
			// Anchored rules must also see downloads after a preceding stage.
			for (let first = 0; first < pipeline.length - 1; first++) {
				normalized.push(pipeline.slice(first).join(" | "));
			}
		}
	}
	for (const child of Object.values(value)) {
		if (Array.isArray(child)) child.forEach((item) => commands(item, result, normalized));
		else if (child && typeof child === "object") commands(child, result, normalized);
	}
}

function operands(args: string[]): string[] | undefined {
	const result: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg.startsWith("-")) { result.push(arg); continue; }
		const option = arg.split("=", 1)[0];
		if (BOOLEAN_OPTIONS.has(arg)) continue;
		if (!VALUE_OPTIONS.has(option)) return;
		if (!arg.includes("=")) {
			if (args[i + 1] === undefined || args[i + 1].startsWith("-")) return;
			i++;
		}
	}
	return result;
}

function unwrap(call: (string | undefined)[]): (string | undefined)[] {
	while (call[0] && ["env", "command", "exec"].includes(basename(call[0]))) {
		const wrapper = basename(call[0]);
		let index = 1;
		while (index < call.length) {
			const word = call[index];
			if (word === undefined) return call;
			if (word === "--") { index++; break; }
			if (wrapper === "env" && /^[A-Za-z_][\w]*=/.test(word)) { index++; continue; }
			if (["-i", "--ignore-environment", "-p"].includes(word)) { index++; continue; }
			if (["-u", "--unset", "-C", "--chdir", "-a"].includes(word)) { index += 2; continue; }
			if (wrapper === "env" && /^(?:--(?:unset|chdir)=|-[uC].)/.test(word)) { index++; continue; }
			if (word.startsWith("-")) return call;
			break;
		}
		call = call.slice(index);
	}
	return call;
}

function classify(cli: string, args: string[]): Decision {
	// Secret-returning operations are denied even if an unrelated option is
	// unknown. Inspection names alone do not prove the output is non-secret.
	const text = args.join(" ");
	if (cli === "aws" && (
		/\b(?:get-secret-value|batch-get-secret-value|get-parameter|get-parameters|get-parameters-by-path|get-session-token|get-federation-token|assume-role(?:-with-web-identity|-with-saml)?|get-login-password|get-authorization-token|export-credentials)\b/.test(text) ||
		/\bconfigure\b[\s\S]*\bget\b[\s\S]*\baws_(?:access_key_id|secret_access_key|session_token)\b/.test(text)
	)) return "secret";
	if (cli === "gcloud" && (
		/\bprint-(?:access|identity)-token\b/.test(text) || /\bsecrets\b[\s\S]*\bversions\b[\s\S]*\baccess\b/.test(text)
	)) return "secret";
	if (cli === "kubectl" && (
		/(?:^|[\s,])secrets?(?:[\s,/.]|$)/i.test(text) || /\bconfig\b[\s\S]*\bview\b/.test(text) || /(?:^|\s)--raw(?:=|\s|$)/.test(text)
	)) return "secret";
	const words = operands(args);
	if (!words) return "confirm";
	if (cli === "aws") {
		const [service, operation] = words;
		if (service === "s3" && operation === "ls") return "read";
		if (service === "sts" && operation === "get-caller-identity") return "read";
		if (operation && /^(?:list|describe|head)-/.test(operation)) return "read";
		return "confirm";
	}
	if (cli === "gcloud") {
		for (let i = 1; i < words.length; i++) {
			if (GCLOUD_GROUPS.has(words.slice(0, i).join(" ")) &&
				["list", "describe", "get-iam-policy"].includes(words[i])) return "read";
		}
		return "confirm";
	}
	if (["get", "describe", "logs", "events", "api-resources", "api-versions", "version", "top", "explain"].includes(words[0])) return "read";
	if (words[0] === "config" && ["current-context", "get-contexts", "get-clusters", "get-users"].includes(words[1])) return "read";
	return "confirm";
}

function shellCommand(call: (string | undefined)[]): string | undefined {
	for (let i = 1; i < call.length; i++) {
		const option = call[i];
		if (!option || option === "--" || !/^[-+]/.test(option)) return;
		if (["-o", "+o", "-O", "+O", "--rcfile", "--init-file"].includes(option)) { i++; continue; }
		if (/^-[a-z]*c[a-z]*$/i.test(option)) return call[i + 1];
	}
}

function policyWord(word: string | undefined): string {
	if (word === undefined) return "<unresolved>";
	if (/^[\w./:=+,%@-]+$/.test(word)) return word;
	const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
	const option = word.match(/^(-[\w-]+=)([\s\S]*)$/);
	return option ? option[1] + quote(option[2]) : quote(word);
}

function policyCommand(words: (string | undefined)[]): string {
	const call = unwrap(words);
	return [call[0] ? basename(call[0]) : undefined, ...call.slice(1)].map(policyWord).join(" ");
}

function cloudDecision(command: string, normalized: string[]): Decision {
	const calls: (string | undefined)[][] = [];
	try {
		const parsed = parse(command);
		if (parsed.errors?.length) return CLOUD_TEXT.test(command) ? "confirm" : "none";
		commands(parsed.ast, calls, normalized);
	} catch {
		return CLOUD_TEXT.test(command) ? "confirm" : "none";
	}
	let decision: Decision = "none";
	for (const original of calls) {
		const call = unwrap(original);
		const cli = call[0] && basename(call[0]);
		// These strings are only policy inputs, never executable shell text.
		// Decoding literal words makes quoted/concatenated subcommands visible.
		normalized.push(policyCommand(call));
		const script = cli && ["bash", "sh", "zsh"].includes(cli) ? shellCommand(call) : undefined;
		if (script) {
			const nested = cloudDecision(script, normalized);
			if (nested === "secret") return "secret";
			if (nested !== "none") decision = "confirm";
		}
		if (!cli || !CLOUD.has(cli)) {
			// Opaque wrappers may execute shell text or pass through a CLI. Do
			// not mistake their arguments for a proven read-only invocation.
			if (cli && ["env", "command", "exec", "bash", "sh", "zsh", "eval", "xargs"].includes(cli) &&
				call.some((word) => word !== undefined && CLOUD_TEXT.test(word))) decision = "confirm";
			continue;
		}
		const next = classify(cli, call.slice(1).map((word) => word ?? "<unresolved>"));
		if (next === "secret") return "secret";
		if (call.some((word) => word === undefined)) { decision = "confirm"; continue; }
		if (next === "confirm" || decision === "none") decision = next;
	}
	return decision;
}

export function registerCommandGuards(pi: ExtensionAPI, isYolo: () => boolean, policy: PackagePolicy): void {
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;
		const normalized: string[] = [];
		const decision = cloudDecision(event.input.command, normalized);
		if (decision === "secret") {
			return { block: true, reason: "Cloud credential output is blocked, including in YOLO mode. Run the authenticated operation without exposing credentials." };
		}
		const raw = await policy.commandDecision(event.input.command);
		if (raw?.kind === "deny") return; // Preserve the package's denial events and termination behavior.
		let confirmation: string | undefined;
		for (const command of normalized) {
			const safety = await policy.commandDecision(command, event.input.command, true);
			if (safety?.kind === "deny") return { block: true, reason: safety.reason, ...(safety.terminate ? { terminate: true } : {}) };
			if (safety?.kind === "confirm") confirmation = safety.reason;
		}
		// Leave commands already recognized in raw form to the package's UI
		// and session grants. Only supplement the quoted forms it would miss.
		if (confirmation && raw?.kind !== "confirm") {
			if (!ctx.hasUI || !await ctx.ui.confirm(`Allow guarded command: ${confirmation}?`, event.input.command)) {
				return { block: true, reason: "Guarded command was not approved." };
			}
		}
		if (decision !== "confirm" || isYolo()) return;
		if (!ctx.hasUI) return { block: true, reason: "Cloud mutation or unrecognized operation requires interactive confirmation." };
		const approved = await ctx.ui.confirm("Allow cloud mutation or unrecognized operation?", event.input.command);
		if (!approved) return { block: true, reason: "Cloud command was not approved." };
	});
}
