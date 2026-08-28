/**
 * Guardrails
 *
 * Two policies that must hold even when every other gate is open, and which
 * neither of the other two layers can express:
 *
 *   1. pi-sandbox (srt) contains the *process*: it decides which paths and
 *      domains exist for a subprocess. It cannot tell `git fetch` from
 *      `git push` — same binary, same host, both inside the network allowlist.
 *   2. pi-permission-system gates *intent*, but `/yolo` auto-approves every
 *      `ask` rule, so nothing routed through "ask" survives YOLO.
 *
 * `tool_call` fires regardless of YOLO and regardless of the sandbox, so this
 * is the only place the two rules below can be guaranteed:
 *
 *   - Secrets are unreadable. Blocks `read` and `bash` that touch credential
 *     files, with a reason that names the alternative (defense in depth with
 *     the sandbox's `denyRead` — this one also covers in-process tool calls
 *     and workspace-local `.env` files that live inside an allowed path).
 *   - `git push` always asks, in every form; `--force` is refused outright.
 *
 * Pattern follows pi's bundled `examples/extensions/protected-paths.ts` and
 * `confirm-destructive.ts`.
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Secret paths, as regexes over the whole path string. Kept as regexes rather
 * than globs because these are matched against both a `read` path argument and
 * raw bash command text, where no path-glob matcher applies.
 */
const SECRET_PATTERNS: RegExp[] = [
	// .env and .env.<anything>, but not the checked-in .env.example / .env.sample
	/(^|[\s"'`=/])\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?(?=$|[\s"'`:,)])/,
	/\.zsh_secrets\b/,
	/\.ssh\//,
	/\.gnupg\//,
	/\.aws\//,
	/\.config\/gcloud\//,
	/\.kube\//,
	/\bcredentials[\w.-]*\.json\b/,
	/\.netrc\b/,
	/\bid_(rsa|ecdsa|ed25519)\b/,
	/\.pi\/agent\/auth\.json\b/,
];

const SECRETS_REASON =
	"Secrets are off-limits. Read the committed example file (.env.example) or " +
	"ask the user for the value you need — do not read credential files.";

/** True when the text names a path this extension refuses to expose. */
function touchesSecret(text: string): boolean {
	return SECRET_PATTERNS.some((p) => p.test(text));
}

/**
 * True when the command runs `git push` in any form, including chained,
 * quoted, or preceded by git's global flags (`-C dir`, `-c k=v`, `--git-dir=`).
 * `push` must be the git subcommand, so `git commit -m "push it"` stays quiet.
 */
function isGitPush(command: string): boolean {
	return /(^|[^\w-])git(\s+(-C\s+\S+|-c\s+\S+|--[\w-]+(=\S+)?))*\s+push(?![\w-])/.test(command);
}

/** True when a push carries a force flag (`--force`, `--force-with-lease`, `-f`). */
function isForcePush(command: string): boolean {
	return /(^|\s)(--force(-with-lease)?(=\S*)?|-f)(\s|$)/.test(command);
}

export default function guardrailsExtension(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event, ctx) => {
		// --- secrets: never readable, whichever tool asks -------------------
		if (isToolCallEventType("read", event)) {
			const path = resolve(event.input.path.replace(/^~(?=$|\/)/, homedir()));
			if (touchesSecret(path)) {
				if (ctx.hasUI) ctx.ui.notify(`Blocked read of secret path: ${event.input.path}`, "warning");
				return { block: true, reason: SECRETS_REASON };
			}
			return undefined;
		}

		if (!isToolCallEventType("bash", event)) return undefined;
		const command = event.input.command;

		if (touchesSecret(command)) {
			if (ctx.hasUI) ctx.ui.notify("Blocked command touching a secret path", "warning");
			return { block: true, reason: SECRETS_REASON };
		}

		// --- pushes: force refused, everything else confirmed ---------------
		if (!isGitPush(command)) return undefined;

		if (isForcePush(command)) {
			if (ctx.hasUI) ctx.ui.notify("Force push refused", "error");
			return {
				block: true,
				reason: "Force pushing is not allowed. Push normally, or ask the user to force push themselves.",
			};
		}

		// Without a UI there is nobody to consent, so the safe answer is no.
		if (!ctx.hasUI) {
			return { block: true, reason: "git push needs interactive confirmation; none available here." };
		}

		const approved = await ctx.ui.confirm("Push to remote?", command);
		if (!approved) {
			ctx.ui.notify("Push cancelled", "info");
			return { block: true, reason: "The user declined the push." };
		}

		return undefined;
	});
}
