/**
 * Model Guard
 *
 * Accidental-switch guard: whenever the model changes mid-session (via
 * `/model`, Ctrl+P/Ctrl+Shift+P cycling, or Ctrl+L), pi shows a footer
 * warning and, on the very next prompt you send, a confirmation dialog naming
 * both the new and previous model. Choosing "No" reverts to the previous model
 * instantly and restores your typed prompt to the editor instead of sending
 * it. This exists so an accidental model switch never silently sends a whole
 * session to the wrong (possibly expensive/slow) model.
 *
 * - Ctrl+Alt+M or `/model-undo` reverts to the previous model at any time.
 *
 * This extension used to add a favorites-first `/models` picker. That is now
 * the `enabledModels` setting in settings.json: pi's own `/model` selector
 * opens scoped to those models whenever any are configured (Tab toggles to the
 * full list), and they are also the Ctrl+P cycling set. One command, no
 * `/model` vs `/models` ambiguity.
 */

import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

function modelKey(m: Pick<Model<Api>, "provider" | "id">): string {
	return `${m.provider}/${m.id}`;
}

interface PendingSwitch {
	from: Model<Api>;
	to: Model<Api>;
}

export default function (pi: ExtensionAPI) {
	let pendingSwitch: PendingSwitch | undefined;
	let revertInProgress = false;
	// Only arm the guard once at least one turn has happened in this session.
	// Freely changing models before your very first prompt is not "accidental".
	let hasHadTurn = false;

	function updateStatus(ctx: ExtensionContext) {
		if (pendingSwitch) {
			ctx.ui.setStatus(
				"model-guard",
				ctx.ui.theme.fg(
					"warning",
					`⇄ model: ${modelKey(pendingSwitch.from)} → ${modelKey(pendingSwitch.to)} (ctrl+alt+m to revert)`,
				),
			);
		} else {
			ctx.ui.setStatus("model-guard", undefined);
		}
	}

	async function revertModel(ctx: ExtensionContext, notify = true): Promise<void> {
		if (!pendingSwitch) return;
		const target = pendingSwitch.from;
		revertInProgress = true;
		let ok = false;
		try {
			ok = await pi.setModel(target);
		} finally {
			revertInProgress = false;
		}
		pendingSwitch = undefined;
		updateStatus(ctx);
		if (notify) {
			ctx.ui.notify(
				ok ? `Reverted to ${modelKey(target)}` : `Could not revert to ${modelKey(target)} (no API key?)`,
				ok ? "info" : "error",
			);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		pendingSwitch = undefined;
		// A resumed/forked session that already has assistant replies has "had a
		// turn" as far as this guard cares; a brand-new session hasn't yet.
		hasHadTurn = ctx.sessionManager
			.getBranch()
			.some((e) => e.type === "message" && e.message.role === "assistant");
		updateStatus(ctx);
	});

	pi.on("turn_start", async () => {
		hasHadTurn = true;
	});

	pi.on("model_select", async (event, ctx) => {
		if (revertInProgress) return; // our own revert; don't re-arm
		if (event.source === "restore") return; // session load, not a live switch
		if (!event.previousModel) return; // first model selection this session
		// Not sent a prompt yet this session — switching freely is fine, no guard.
		if (!hasHadTurn) return;

		if (modelKey(event.previousModel) === modelKey(event.model)) return; // no-op

		// Selecting back to the model we'd revert to resolves the pending switch.
		if (pendingSwitch && modelKey(event.model) === modelKey(pendingSwitch.from)) {
			pendingSwitch = undefined;
			updateStatus(ctx);
			return;
		}

		// Keep the original "from" if a switch was already pending (chained switches).
		pendingSwitch = { from: pendingSwitch?.from ?? event.previousModel, to: event.model };
		updateStatus(ctx);
	});

	pi.registerShortcut("ctrl+alt+m", {
		description: "Revert to previous model (undo accidental model switch)",
		handler: async (ctx) => {
			if (!pendingSwitch) {
				ctx.ui.notify("No pending model switch to revert", "info");
				return;
			}
			await revertModel(ctx);
		},
	});

	pi.registerCommand("model-undo", {
		description: "Revert to the model that was active before the last switch",
		handler: async (_args, ctx) => {
			if (!pendingSwitch) {
				ctx.ui.notify("No pending model switch to revert", "info");
				return;
			}
			await revertModel(ctx);
		},
	});

	// Gate the first prompt sent after a live model switch.
	pi.on("input", async (event, ctx) => {
		if (event.source !== "interactive") return { action: "continue" };
		if (!pendingSwitch) return { action: "continue" };
		if (!event.text?.trim()) return { action: "continue" };

		const { from, to } = pendingSwitch;
		const proceed = await ctx.ui.confirm(
			"Model was just changed",
			`Send this prompt using ${modelKey(to)}?\n\nPrevious model: ${modelKey(from)}\n\nChoose No to revert to ${modelKey(from)} and keep your prompt in the editor.`,
		);

		if (proceed) {
			pendingSwitch = undefined;
			updateStatus(ctx);
			return { action: "continue" };
		}

		await revertModel(ctx, false);
		ctx.ui.setEditorText(event.text);
		ctx.ui.notify(`Reverted to ${modelKey(from)}. Your prompt was restored to the editor.`, "info");
		return { action: "handled" };
	});
}
