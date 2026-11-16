import { basename } from "node:path";

import type { Statement, Word, WordPart } from "@aliou/sh";
import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { parseShell, type PackagePolicy } from "./package-policy.ts";

const SHELLS = new Set(["bash", "sh", "zsh"]);
const COMMAND_WRAPPERS = new Set(["env", "command", "exec"]);
const EXECUTION_WRAPPERS = new Set(["timeout", "gtimeout", "mise", "direnv", "uv"]);
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
          "get-role-credentials",
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
    "aws-vault",
    {
      credentialPatterns: [
        /(?:^|\s)export(?:\s|$)/,
        /\bexec\b[\s\S]*?(?:\s)(?:--json(?:=true)?|-j)(?=\s|$)/,
      ],
      isInspection([operation]) {
        return operation === "list" || operation === "version";
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

    if (cli && EXECUTION_WRAPPERS.has(cli)) {
      const wrapped = executionCommand(cli, call);
      if (wrapped) {
        calls.push(wrapped);
      } else if (call.some((word) => word !== undefined && CLOUD_TEXT.test(word))) {
        if (containsCredentialCommand(call)) return { cloud: "secret", invocations };
        cloud = "confirm";
      }
      continue;
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

    if (cli === "aws-vault") {
      const separator = call.indexOf("--");
      const vaultArgs = call.slice(1, separator < 0 ? undefined : separator);
      if (classifyCloudCommand(cli, vaultArgs.map((word) => word ?? "<unresolved>")) === "secret") {
        return { cloud: "secret", invocations };
      }
      const wrapped = vaultCommand(call);
      // Even unrecognized vault options must not hide known AWS credential output.
      const aws = call.findIndex(
        (word, index) => index > 0 && word !== undefined && basename(word) === "aws",
      );
      if (
        aws >= 0 &&
        classifyCloudCommand(
          "aws",
          call.slice(aws + 1).map((word) => word ?? "<unresolved>"),
        ) === "secret"
      ) {
        return { cloud: "secret", invocations };
      }
      if (wrapped) {
        const executable = unwrapCommand(wrapped)[0];
        if (!executable || !cloudPolicies.has(basename(executable))) cloud = "confirm";
        calls.push(wrapped);
        continue;
      }
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

function containsCredentialCommand(call: Invocation): boolean {
  for (const [index, word] of call.entries()) {
    if (!word) continue;
    const cli = basename(word);
    if (
      cloudPolicies.has(cli) &&
      classifyCloudCommand(
        cli,
        call.slice(index + 1).map((arg) => arg ?? "<unresolved>"),
      ) === "secret"
    ) {
      return true;
    }
    if (/\s/.test(word) && CLOUD_TEXT.test(word) && analyzeShell(word).cloud === "secret") {
      return true;
    }
  }
  return false;
}

function executionCommand(cli: string, call: Invocation): Invocation | undefined {
  if (cli === "uv") {
    if (call[1] !== "run") return;
    const index = call[2] === "--" ? 3 : 2;
    return call[index] && !call[index]!.startsWith("-") ? call.slice(index) : undefined;
  }
  if (cli === "direnv") {
    return call[1] === "exec" && call[2] && call[3] ? call.slice(3) : undefined;
  }
  if (cli === "timeout" || cli === "gtimeout") {
    let index = 1;
    while (call[index]?.startsWith("-")) {
      const option = call[index]!;
      if (option === "--") {
        index++;
        break;
      }
      if (["-f", "--foreground", "-p", "--preserve-status", "-v", "--verbose"].includes(option)) {
        index++;
      } else if (["-k", "--kill-after", "-s", "--signal"].includes(option) && call[index + 1]) {
        index += 2;
      } else if (/^--(?:kill-after|signal)=.+/.test(option) || /^-[ks].+/.test(option)) {
        index++;
      } else return;
    }
    if (!call[index] || !/^(?:\d+(?:\.\d*)?|\.\d+)[smhd]?$/.test(call[index]!)) return;
    return call[index + 1] ? call.slice(index + 1) : undefined;
  }
  if (cli !== "mise") return;
  let index = 1;
  let exec = false;
  while (index < call.length) {
    const word = call[index];
    if (!word) return;
    if (word === "--") return exec && call[index + 1] ? call.slice(index + 1) : undefined;
    if (word === "-c" || word === "--command") {
      return exec && call[index + 1] ? ["sh", "-c", call[index + 1]] : undefined;
    }
    if (word.startsWith("--command=")) return exec ? ["sh", "-c", word.slice(10)] : undefined;
    if ([
      "-C", "--cd", "-E", "--env", "-j", "--jobs", "--allow-env", "--allow-net",
      "--allow-read", "--allow-write", "--secrets",
    ].includes(word)) {
      if (!call[index + 1]) return;
      index += 2;
    } else if (/^--(?:cd|env|jobs|allow-env|allow-net|allow-read|allow-write|secrets)=.+/.test(word)) {
      index++;
    } else if ([
      "-q", "--quiet", "-v", "--verbose", "-y", "--yes", "--locked", "--silent",
      "--deny-all", "--deny-env", "--deny-net", "--deny-read", "--deny-write",
      "--fresh-env", "--no-deps", "--raw", "--secrets-all",
    ].includes(word)) {
      index++;
    } else if (!exec && (word === "exec" || word === "x")) {
      exec = true;
      index++;
    } else if (exec && /^[\w.+:/-]+@[^\s]+$/.test(word)) {
      index++;
    } else return;
  }
  return;
}

function vaultCommand(call: Invocation): Invocation | undefined {
  let index = 1;
  let exec = false;
  const valueOptions = new Set([
    "--backend", "--session-backend", "--prompt", "--keychain", "--session-keychain",
    "--duration", "-d", "--region", "--mfa-token", "-t", "--browser",
  ]);
  const booleanOptions = new Set([
    "--debug", "-v", "--no-session", "-n", "--server", "-s", "--ec2-server",
    "--ecs-server", "--lazy", "--stdout", "--device-code", "--profile-env",
  ]);
  while (index < call.length) {
    const word = call[index];
    if (word === undefined) return;
    if (word === "--") {
      index++;
      break;
    }
    if (!word.startsWith("-")) {
      if (!exec) {
        if (word !== "exec") return;
        exec = true;
        index++;
        continue;
      }
      break;
    }
    const [option, ...value] = word.split("=");
    if (booleanOptions.has(option) && value.length === 0) index++;
    else if (valueOptions.has(option)) index += value.length ? 1 : 2;
    else return;
  }
  if (!exec || !call[index] || !call[index + 1]) return;
  index++; // The profile precedes the command.
  if (call[index] === "--") index++;
  return call[index] ? call.slice(index) : undefined;
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
