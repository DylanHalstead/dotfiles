import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export type CommandDecision = { kind: "deny" | "confirm"; reason: string; terminate?: boolean } | undefined;

function invocationPatterns(patterns: { pattern: string; regex?: boolean }[]) {
	return patterns.map((pattern) => ({
		...pattern,
		regex: true,
		pattern: `^(?:${pattern.regex ? pattern.pattern : pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
	}));
}

// These internal APIs belong to the pinned package. Keep their use here so
// upgrades can be checked without maintaining another copy of its policies.
export async function loadPackagePolicy() {
	const root = join(getAgentDir(), "npm/node_modules/@aliou/pi-guardrails");
	const { configLoader } = await import(join(root, "src/shared/config/index.ts"));
	const { BLOCKED_TOOLS, compilePolicies, createPolicyRules } = await import(join(root, "extensions/guardrails/rules.ts"));
	const { createPermissionGateRule, matchCommandPattern, formatAutoDenyReason } = await import(join(root, "extensions/permission-gate/rules.ts"));
	const { isCommandAllowed } = await import(join(root, "extensions/permission-gate/grants.ts"));
	const { piDocumentationPaths } = await import(join(root, "extensions/path-access/dynamic-resources.ts"));
	const { targetsForTool } = await import(join(root, "extensions/path-access/targets.ts"));
	await configLoader.load();
	return {
		documentationPaths: piDocumentationPaths() as { kind: "file" | "directory"; path: string }[],
		async shellTargets(input: Record<string, unknown>, cwd: string, exec: ExtensionAPI["exec"]): Promise<string[]> {
			return targetsForTool("bash", input, cwd, exec);
		},
		async fileDenial(path: string, toolName: string, cwd: string): Promise<string | undefined> {
			const config = configLoader.getConfig();
			if (!config.enabled || !config.features.policies) return;
			const policies = compilePolicies(config.policies.rules).filter(
				(policy: { protection: string }) => BLOCKED_TOOLS[policy.protection].has(toolName),
			);
			for (const rule of createPolicyRules(policies, cwd)) {
				const result = await rule.check({ kind: "file", path, origin: toolName });
				if (result.kind === "match") return result.reason;
			}
		},
		async commandDecision(command: string, original = command, invocationOnly = false): Promise<CommandDecision> {
			const config = configLoader.getConfig();
			if (!config.enabled || !config.features.permissionGate || isCommandAllowed(original)) return;
			const gate = config.permissionGate;
			// Decoded argv must match at the executable, not inside printf/echo
			// arguments that happen to contain a command example.
			const denied = matchCommandPattern(command, invocationOnly ? invocationPatterns(gate.autoDenyPatterns) : gate.autoDenyPatterns);
			if (denied) return { kind: "deny", reason: formatAutoDenyReason(denied), ...(denied.terminate ? { terminate: true } : {}) };
			const result = await createPermissionGateRule({ patterns: invocationOnly ? invocationPatterns(gate.patterns) : gate.patterns, useBuiltinMatchers: gate.useBuiltinMatchers })
				.check({ kind: "command", command, origin: "bash" });
			if (result.kind === "match" && gate.requireConfirmation) return { kind: "confirm", reason: result.reason };
		},
	};
}

export type PackagePolicy = Awaited<ReturnType<typeof loadPackagePolicy>>;
