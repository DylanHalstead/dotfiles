/**
 * YOLO mode
 *
 * A per-session "auto-approve everything" switch: toggle shortcut, startup
 * flag, status badge, session-scoped persistence that survives /resume.
 *
 * Your permissions are enforced by the `pi-permission-system` package, which
 * has a built-in YOLO mode: when on, any action that would normally stop and
 * ask "allow this?" (permission state `ask`) is auto-approved. Explicitly
 * *denied* rules still block.
 *
 * The trusted-development policy already allows routine work. This switch is
 * retained for sessions that also want to auto-approve the remaining permission
 * prompts. `guardrails.ts` still blocks secrets and confirms pushes and cloud
 * mutations independently, and an explicitly enabled sandbox still applies.
 *
 *   /yolo          Toggle YOLO for this session (press again to turn off)
 *   /yolo on|off   Set it explicitly
 *   Alt+Shift+Y    Same toggle as a shortcut
 *   --yolo         Start the session in YOLO mode
 *
 * (Alt = Option on macOS. Remap via keybindings if your terminal eats these.)
 * State is session-scoped: once on, it stays on for the rest of the session —
 * across cancelled prompts, finished turns, and /resume — until you toggle it
 * off. A fresh session starts clean unless you pass --yolo. It never leaks
 * into other sessions, and nothing is written outside the session file.
 *
 * Staying on takes active work: the permission package resets its in-memory
 * flag on every agent start, so we re-assert it at the decision point. See the
 * comment above the tool_call handler for why that event and not another.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface YoloModeControlOptions {
	persist?: boolean;
	source?: string;
}

interface YoloModeControlResult {
	yoloMode: boolean;
	changed: boolean;
	persisted: boolean;
	error?: string;
}

interface PiPermissionSystemRuntimeApi {
	getYoloMode(): boolean;
	setYoloMode(enabled: boolean, options?: YoloModeControlOptions): YoloModeControlResult;
	toggleYoloMode(options?: YoloModeControlOptions): YoloModeControlResult;
}

interface YoloState {
	enabled: boolean;
}

function getApi(): PiPermissionSystemRuntimeApi | null {
	return (globalThis as { __piPermissionSystem?: PiPermissionSystemRuntimeApi }).__piPermissionSystem ?? null;
}

export default function yoloExtension(pi: ExtensionAPI): void {
	let enabled = false;

	function updateStatus(ctx: ExtensionContext): void {
		ctx.ui.setStatus("yolo", enabled ? ctx.ui.theme.fg("error", "⚡ YOLO") : undefined);
	}

	function persistState(): void {
		pi.appendEntry("yolo", { enabled } satisfies YoloState);
	}

	/**
	 * Push the desired state into the permission package. persist:false keeps the
	 * change session-only at the package level; our own session entry is what
	 * restores it on /resume. Returns whether the API accepted it.
	 */
	function applyToApi(ctx: ExtensionContext, target: boolean, notifyMissing: boolean): boolean {
		const api = getApi();
		if (!api) {
			if (notifyMissing) {
				ctx.ui.notify(
					"YOLO unavailable: pi-permission-system runtime API not found. Is the permission package enabled?",
					"error",
				);
			}
			return false;
		}
		const result = api.setYoloMode(target, { persist: false, source: "yolo-extension" });
		if (result.error) {
			if (notifyMissing) ctx.ui.notify(`YOLO change failed: ${result.error}`, "error");
			return false;
		}
		return true;
	}

	function setYolo(next: boolean, ctx: ExtensionContext): void {
		// The footer badge is the only status signal (no terminal notify), matching
		// the request to keep YOLO purely in the footer.
		if (!applyToApi(ctx, next, true)) return;
		enabled = next;
		updateStatus(ctx);
		persistState();
	}

	/** Toggle helper: the command and the shortcut both flip on/off. */
	function toggleYolo(ctx: ExtensionContext): void {
		setYolo(!enabled, ctx);
	}

	// -----------------------------------------------------------------------
	// Command, flag, and shortcut
	// -----------------------------------------------------------------------

	pi.registerFlag("yolo", {
		description: "Start the session in YOLO mode (auto-approve all permissions)",
		type: "boolean",
		default: false,
	});

	pi.registerCommand("yolo", {
		description: "Toggle YOLO mode (auto-approve all permissions) this session; 'on'/'off' to set explicitly",
		getArgumentCompletions: (prefix) => {
			const opts = ["on", "off"].filter((o) => o.startsWith(prefix));
			return opts.length > 0 ? opts.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const trimmed = args?.trim().toLowerCase();
			if (trimmed === "on") return setYolo(true, ctx);
			if (trimmed === "off") return setYolo(false, ctx);
			return toggleYolo(ctx);
		},
	});

	pi.registerShortcut("alt+shift+y", {
		description: "Toggle YOLO mode (auto-approve all permissions this session)",
		handler: async (ctx) => toggleYolo(ctx),
	});

	// -----------------------------------------------------------------------
	// Re-apply at the decision point.
	//
	// The permission package reloads its config from disk on every
	// `before_agent_start`, which clears the in-memory yolo flag we set with
	// persist:false. We cannot simply re-assert on the same event: pi loads
	// project-local, then global, then package extensions, so this file's
	// handlers register *before* the package's and therefore run before its
	// reload — anything set there is wiped a moment later.
	//
	// `tool_call` is where the package actually decides, and the same ordering
	// that breaks the re-assert on `before_agent_start` is what makes it work
	// here: our handler runs first, so the flag is already true by the time the
	// package evaluates the request.
	// -----------------------------------------------------------------------

	pi.on("tool_call", async (_event, ctx) => {
		if (!enabled) return undefined;
		const api = getApi();
		// Only write when the reload has actually drifted the flag, so the
		// common case costs one comparison per tool call.
		if (api && !api.getYoloMode()) applyToApi(ctx, true, false);
		return undefined;
	});

	// -----------------------------------------------------------------------
	// Restore state on session start / resume
	// -----------------------------------------------------------------------

	pi.on("session_start", async (_event, ctx) => {
		// A --yolo flag is explicit user intent and wins over persisted state.
		if (pi.getFlag("yolo") === true) {
			setYolo(true, ctx);
			return;
		}

		const entries = ctx.sessionManager.getEntries();
		const stateEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "yolo")
			.pop() as { data?: YoloState } | undefined;

		enabled = stateEntry?.data?.enabled ?? false;
		if (enabled) applyToApi(ctx, true, false);
		updateStatus(ctx);
	});
}
