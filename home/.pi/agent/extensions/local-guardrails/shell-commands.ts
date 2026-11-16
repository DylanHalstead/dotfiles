import { basename } from "node:path";

import type { Statement, Word, WordPart } from "@aliou/sh";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { parseShell, type PackagePolicy } from "./package-policy.ts";

const SHELLS = new Set(["bash", "sh", "zsh"]);
const COMMAND_WRAPPERS = new Set(["env", "command", "exec"]);
const OPAQUE_WRAPPERS = new Set([...COMMAND_WRAPPERS, ...SHELLS, "eval", "xargs"]);
const VALUE_OPTIONS = new Set([
  "--profile",
  "--region",
  "--output",
  "-o",
  "--query",
  "--endpoint-url",
  "--cli-connect-timeout",
  "--cli-read-timeout",
  "--ca-bundle",
  "--project",
  "--account",
  "--configuration",
  "--billing-project",
  "--impersonate-service-account",
  "--format",
  "--verbosity",
  "--context",
  "--namespace",
  "-n",
  "--cluster",
  "--user",
  "--server",
  "--request-timeout",
  "--as",
  "--as-group",
  "--kubeconfig",
  "--zone",
  "--filter",
  "--limit",
  "--sort-by",
  "--page-size",
  "--max-items",
  "--starting-token",
]);
const BOOLEAN_OPTIONS = new Set([
  "--no-cli-pager",
  "--no-paginate",
  "--debug",
  "--quiet",
  "--all-namespaces",
  "-A",
  "--show-labels",
  "--no-headers",
  "--help",
  "-h",
  "--version",
]);
const GCLOUD_GROUPS = new Set([
  "projects",
  "auth",
  "compute instances",
  "compute disks",
  "compute networks",
  "compute firewall-rules",
  "container clusters",
  "sql instances",
  "iam service-accounts",
  "storage buckets",
  "storage objects",
  "run services",
  "functions",
  "config configurations",
]);

type CloudDecision = "none" | "read" | "confirm" | "secret";
type Invocation = readonly (string | undefined)[];

interface ShellAnalysis {
  readonly cloud: CloudDecision;
  readonly invocations: readonly string[];
}

interface CloudPolicy {
  readonly credentialPatterns: readonly RegExp[];
  isInspection(operands: readonly string[]): boolean;
}

const cloudPolicies = new Map<string, CloudPolicy>([
  [
    "aws",
    {
      credentialPatterns: [
        ...[
          "get-secret-value",
          "batch-get-secret-value",
          "get-parameter",
          "get-parameters",
          "get-parameters-by-path",
          "get-session-token",
          "get-federation-token",
          "assume-role",
          "get-login-password",
          "get-authorization-token",
          "export-credentials",
        ].map((operation) => new RegExp(`\\b${operation}\\b`)),
        /\bconfigure\b[\s\S]*\bget\b[\s\S]*\baws_(?:access_key_id|secret_access_key|session_token)\b/,
      ],
      isInspection([service, operation]) {
        if (service === "s3" && operation === "ls") return true;
        if (service === "sts" && operation === "get-caller-identity") return true;
        return operation !== undefined && /^(?:list|describe|head)-/.test(operation);
      },
    },
  ],
  [
    "gcloud",
    {
      credentialPatterns: [
        /\bprint-(?:access|identity)-token\b/,
        /\bsecrets\b[\s\S]*\bversions\b[\s\S]*\baccess\b/,
      ],
      isInspection(words) {
        for (const [index, operation] of words.entries()) {
          if (index === 0) continue;
          const group = words.slice(0, index).join(" ");
          if (
            GCLOUD_GROUPS.has(group) &&
            ["list", "describe", "get-iam-policy"].includes(operation)
          ) {
            return true;
          }
        }
        return false;
      },
    },
  ],
  [
    "kubectl",
    {
      credentialPatterns: [
        /(?:^|[\s,])secrets?(?:[\s,/.]|$)/i,
        /\bconfig\b[\s\S]*\bview\b/,
        /(?:^|\s)--raw(?:=|\s|$)/,
      ],
      isInspection([operation, subcommand]) {
        if (
          operation !== undefined &&
          [
            "get",
            "describe",
            "logs",
            "events",
            "api-resources",
            "api-versions",
            "version",
            "top",
            "explain",
          ].includes(operation)
        ) {
          return true;
        }
        return (
          operation === "config" &&
          subcommand !== undefined &&
          ["current-context", "get-contexts", "get-clusters", "get-users"].includes(subcommand)
        );
      },
    },
  ],
]);
const CLOUD_TEXT = new RegExp(`\\b(?:${[...cloudPolicies.keys()].join("|")})\\b`);

export function registerCommandGuards(
  pi: ExtensionAPI,
  isYolo: () => boolean,
  policy: PackagePolicy,
): void {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    const analysis = analyzeShell(command);
    if (analysis.cloud === "secret") {
      return {
        block: true,
        reason:
          "Cloud credential output is blocked, including in YOLO mode. Run the authenticated operation without exposing credentials.",
      };
    }

    const decision = await policy.commandDecision(command, analysis.invocations);
    if (decision?.kind === "upstream-denial") return;
    if (decision?.kind === "deny") {
      return {
        block: true,
        reason: decision.reason,
        ...(decision.terminate ? { terminate: true } : {}),
      };
    }
    if (decision?.kind === "confirm") {
      if (
        !ctx.hasUI ||
        !(await ctx.ui.confirm(`Allow guarded command: ${decision.reason}?`, command))
      ) {
        return { block: true, reason: "Guarded command was not approved." };
      }
    }

    if (analysis.cloud !== "confirm" || isYolo()) return;
    if (!ctx.hasUI) {
      return {
        block: true,
        reason: "Cloud mutation or unrecognized operation requires interactive confirmation.",
      };
    }
    if (!(await ctx.ui.confirm("Allow cloud mutation or unrecognized operation?", command))) {
      return { block: true, reason: "Cloud command was not approved." };
    }
  });
}

function classifyCloudCommand(cli: string, args: readonly string[]): CloudDecision {
  const policy = cloudPolicies.get(cli);
  if (!policy) return "none";

  // Credential output stays blocked even when an unknown option prevents classification.
  const text = args.join(" ");
  if (policy.credentialPatterns.some((pattern) => pattern.test(text))) return "secret";

  const operands = commandOperands(args);
  if (!operands) return "confirm";
  return policy.isInspection(operands) ? "read" : "confirm";
}

function commandOperands(args: readonly string[]): string[] | undefined {
  const operands: string[] = [];
  const words = args.values();
  for (const arg of words) {
    if (!arg.startsWith("-")) {
      operands.push(arg);
      continue;
    }
    if (BOOLEAN_OPTIONS.has(arg)) continue;

    const separator = arg.indexOf("=");
    const option = separator < 0 ? arg : arg.slice(0, separator);
    if (!VALUE_OPTIONS.has(option)) return;
    if (separator >= 0) continue;

    const value = words.next().value;
    if (value === undefined || value.startsWith("-")) return;
  }
  return operands;
}

function analyzeShell(command: string): ShellAnalysis {
  const calls: Invocation[] = [];
  const invocations: string[] = [];
  const fallback: ShellAnalysis = {
    cloud: CLOUD_TEXT.test(command) ? "confirm" : "none",
    invocations,
  };
  try {
    const parsed = parseShell(command);
    if (parsed.errors?.length) return fallback;
    collectShellCalls(parsed.ast, calls, invocations);
  } catch {
    return fallback;
  }

  let cloud: CloudDecision = "none";
  for (const original of calls) {
    const call = unwrapCommand(original);
    const cli = call[0] && basename(call[0]);
    invocations.push(policyCommand(call));

    const script = cli && SHELLS.has(cli) ? shellScript(call) : undefined;
    if (script) {
      const nested = analyzeShell(script);
      invocations.push(...nested.invocations);
      if (nested.cloud === "secret") return { cloud: "secret", invocations };
      if (nested.cloud !== "none") cloud = "confirm";
    }

    if (!cli || !cloudPolicies.has(cli)) {
      // A wrapper's cloud-related arguments do not prove what it executes.
      if (
        cli &&
        OPAQUE_WRAPPERS.has(cli) &&
        call.some((word) => word !== undefined && CLOUD_TEXT.test(word))
      ) {
        cloud = "confirm";
      }
      continue;
    }

    const decision = classifyCloudCommand(
      cli,
      call.slice(1).map((word) => word ?? "<unresolved>"),
    );
    if (decision === "secret") return { cloud: "secret", invocations };
    if (call.some((word) => word === undefined)) {
      cloud = "confirm";
      continue;
    }
    if (decision === "confirm" || cloud === "none") cloud = decision;
  }
  return { cloud, invocations };
}

function literalWord(node: Word | WordPart): string | undefined {
  switch (node.type) {
    case "Literal":
    case "SglQuoted":
      return node.value;
    case "Word":
    case "DblQuoted": {
      const parts = node.parts.map(literalWord);
      return parts.every((part) => part !== undefined) ? parts.join("") : undefined;
    }
    default:
      return undefined;
  }
}

function collectShellCalls(node: object, calls: Invocation[], invocations: string[]): void {
  // The parser owns these node shapes. Traversal also visits positions and other metadata.
  const value = node as { type?: string; words?: Word[]; commands?: Statement[] };
  if (value.type === "SimpleCommand") calls.push((value.words ?? []).map(literalWord));
  if (value.type === "Pipeline") {
    const stages = value.commands ?? [];
    const commands = stages
      .map((stage) => stage.command)
      .filter((command) => command.type === "SimpleCommand");
    if (commands.length === stages.length) {
      const pipeline = commands.map((command) =>
        policyCommand((command.words ?? []).map(literalWord)),
      );
      // Anchored download rules must see pipelines that start after an earlier stage.
      for (let first = 0; first < pipeline.length - 1; first++) {
        invocations.push(pipeline.slice(first).join(" | "));
      }
    }
  }
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") collectShellCalls(item, calls, invocations);
      }
    } else if (child && typeof child === "object") {
      collectShellCalls(child, calls, invocations);
    }
  }
}

function unwrapCommand(words: Invocation): Invocation {
  let call = words;
  while (call[0] && COMMAND_WRAPPERS.has(basename(call[0]))) {
    const wrapper = basename(call[0]);
    let index = 1;
    while (index < call.length) {
      const word = call[index];
      if (word === undefined) return call;
      if (word === "--") {
        index++;
        break;
      }
      if (wrapper === "env" && /^[A-Za-z_][\w]*=/.test(word)) {
        index++;
        continue;
      }
      if (["-i", "--ignore-environment", "-p"].includes(word)) {
        index++;
        continue;
      }
      if (["-u", "--unset", "-C", "--chdir", "-a"].includes(word)) {
        index += 2;
        continue;
      }
      if (wrapper === "env" && /^(?:--(?:unset|chdir)=|-[uC].)/.test(word)) {
        index++;
        continue;
      }
      if (word.startsWith("-")) return call;
      break;
    }
    call = call.slice(index);
  }
  return call;
}

function shellScript(call: Invocation): string | undefined {
  for (let index = 1; index < call.length; index++) {
    const option = call[index];
    if (!option || option === "--" || !/^[-+]/.test(option)) return;
    if (["-o", "+o", "-O", "+O", "--rcfile", "--init-file"].includes(option)) {
      index++;
      continue;
    }
    if (/^-[a-z]*c[a-z]*$/i.test(option)) return call[index + 1];
  }
}

// These strings are policy inputs, never executable shell text.
function policyCommand(words: Invocation): string {
  const call = unwrapCommand(words);
  const executable = call[0] ? basename(call[0]) : undefined;
  return [executable, ...call.slice(1)].map(policyWord).join(" ");
}

function policyWord(word: string | undefined): string {
  if (word === undefined) return "<unresolved>";
  if (/^[\w./:=+,%@-]+$/.test(word)) return word;

  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const option = word.match(/^-[\w-]+=/)?.[0];
  return option ? option + quote(word.slice(option.length)) : quote(word);
}
