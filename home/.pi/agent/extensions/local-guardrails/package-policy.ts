import { realpathSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join, resolve } from "node:path";

import type { SimpleCommand } from "@aliou/sh";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Node resolves dependencies from this filename, not its symlink target.
const root = realpathSync(join(getAgentDir(), "npm/node_modules/@aliou/pi-guardrails"));
const require = createRequire(join(root, "package.json"));
export const { parse: parseShell } = require("@aliou/sh") as typeof import("@aliou/sh");

export interface InspectionPath {
  readonly kind: "file" | "directory";
  readonly path: string;
}

export type CommandDecision =
  | { readonly kind: "upstream-denial" }
  | { readonly kind: "deny"; readonly reason: string; readonly terminate?: boolean }
  | { readonly kind: "confirm"; readonly reason: string };

export interface PackagePolicy {
  readonly documentationPaths: readonly InspectionPath[];
  shellTargets(input: Record<string, unknown>, cwd: string): Promise<string[]>;
  fileDenial(path: string, toolName: string, cwd: string): Promise<string | undefined>;
  /** Decoded invocations supplement raw policy without replacing upstream prompts or grants. */
  commandDecision(
    command: string,
    invocations: readonly string[],
  ): Promise<CommandDecision | undefined>;
}

interface CommandPattern {
  readonly pattern: string;
  readonly regex?: boolean;
}

function invocationPatterns(patterns: readonly CommandPattern[]) {
  return patterns.map((pattern) => {
    const source = pattern.regex
      ? pattern.pattern
      : pattern.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { ...pattern, regex: true, pattern: `^(?:${source})` };
  });
}

/** All internal APIs below belong to guardrails 0.23.0 and need review on upgrade. */
export async function loadPackagePolicy(exec: ExtensionAPI["exec"]): Promise<PackagePolicy> {
  const { configLoader } = await import(join(root, "src/shared/config/index.ts"));
  const { BLOCKED_TOOLS, compilePolicies, createPolicyRules } = await import(
    join(root, "extensions/guardrails/rules.ts")
  );
  const { createPermissionGateRule, matchCommandPattern, formatAutoDenyReason } = await import(
    join(root, "extensions/permission-gate/rules.ts")
  );
  const { isCommandAllowed } = await import(join(root, "extensions/permission-gate/grants.ts"));
  const { piDocumentationPaths } = await import(
    join(root, "extensions/path-access/dynamic-resources.ts")
  );
  const { targetsForTool } = await import(join(root, "extensions/path-access/targets.ts"));
  const { walkCommands, wordToString } = await import(join(root, "src/core/shell/ast.ts"));
  const { classifyCommandArgs } = await import(join(root, "src/core/shell/command-args.ts"));

  await configLoader.load();

  return {
    documentationPaths: piDocumentationPaths(),

    async shellTargets(input, cwd) {
      const targets = new Set<string>(await targetsForTool("bash", input, cwd, exec));
      const operands = new Set<string>();
      try {
        walkCommands(
          parseShell(String(input.command ?? "")).ast,
          (command: SimpleCommand | undefined) => {
            const [executable, ...args] = (command?.words ?? []).map((word): string =>
              wordToString(word),
            );
            if (!executable) return;
            for (const arg of classifyCommandArgs(executable, args)) {
              const token: string = arg.token;
              if (
                arg.programText ||
                arg.recurseShell ||
                token.startsWith("-") ||
                basename(token) !== token
              )
                continue;
              operands.add(resolve(cwd, token));
            }
          },
          { includeSubstitutions: true },
        );
      } catch {
        return [...targets]; // Retain upstream's fallback for incomplete shell text.
      }

      // Upstream omits bare names such as `cat config-link`, even when they are symlinks.
      for (const path of operands) {
        try {
          if ((await lstat(path)).isSymbolicLink()) targets.add(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      return [...targets];
    },

    async fileDenial(path, toolName, cwd) {
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

    async commandDecision(command, invocations) {
      const config = configLoader.getConfig();
      if (!config.enabled || !config.features.permissionGate || isCommandAllowed(command)) return;

      const gate = config.permissionGate;
      if (matchCommandPattern(command, gate.autoDenyPatterns)) {
        // Upstream emits the denial event and preserves its termination behavior.
        return { kind: "upstream-denial" };
      }

      const rawRule = createPermissionGateRule(gate);
      const raw = await rawRule.check({ kind: "command", command, origin: "bash" });
      const rawConfirmation = raw.kind === "match" && gate.requireConfirmation;

      // Anchoring prevents quoted examples in printf/echo from becoming invocations.
      const deniedPatterns = invocationPatterns(gate.autoDenyPatterns);
      const invocationRule = createPermissionGateRule({
        patterns: invocationPatterns(gate.patterns),
        useBuiltinMatchers: gate.useBuiltinMatchers,
      });
      let confirmation: string | undefined;

      for (const invocation of invocations) {
        const denied = matchCommandPattern(invocation, deniedPatterns);
        if (denied) {
          return {
            kind: "deny",
            reason: formatAutoDenyReason(denied),
            ...(denied.terminate ? { terminate: true } : {}),
          };
        }
        const result = await invocationRule.check({
          kind: "command",
          command: invocation,
          origin: "bash",
        });
        if (result.kind === "match" && gate.requireConfirmation) confirmation = result.reason;
      }

      if (confirmation && !rawConfirmation) return { kind: "confirm", reason: confirmation };
    },
  };
}
