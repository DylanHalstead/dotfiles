/**
 * Custom footer (Claude-Code-style status line):
 *
 *   Opus 5 - medium | $5.28, [██░░░░░░░░░░░░░░] 113k/1000k (11%) | ⎇ main (+177,-26)
 *     ~/dotfiles
 *
 * Git branch comes from footerData.getGitBranch() (cheap, already tracked by pi).
 * Git diff +/- stats require shelling out, so they're refreshed on an interval
 * instead of on every render to avoid spawning `git` on every keystroke.
 *
 * Cost is accumulated incrementally via turn_end (O(1) per turn) rather than
 * re-walked from the full session history on every render frame. For resumed
 * sessions the branch is walked once at session_start to seed the total.
 */

import { exec } from "node:child_process";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

const BAR_WIDTH = 16;
const DIFF_REFRESH_MS = 3000;

function fmtK(n: number): string {
	if (n < 1000) return `${Math.round(n)}`;
	return `${Math.round(n / 1000)}k`;
}

export default function (pi: ExtensionAPI) {
	// Cumulative cost of all assistant turns this session. Seeded from history
	// on session_start (for resumed sessions) then incremented O(1) per turn.
	let sessionCost = 0;

	// Update cost once per turn, not once per render frame.
	pi.on("turn_end", (event) => {
		const msg = event.message as AssistantMessage | undefined;
		if (msg?.usage?.cost?.total != null) {
			sessionCost += msg.usage.cost.total;
		}
	});

	pi.on("session_start", (_event, ctx) => {
		// Only the interactive TUI renders a footer; skip setup entirely in
		// print/json/rpc modes so we don't spawn timers in one-shot processes.
		if (ctx.mode !== "tui") return;

		// Seed cost from any prior assistant messages (resumed / forked sessions).
		sessionCost = 0;
		for (const e of ctx.sessionManager.getBranch()) {
			if (e.type === "message" && e.message.role === "assistant") {
				sessionCost += (e.message as AssistantMessage).usage.cost.total;
			}
		}

		let diffAdded = 0;
		let diffRemoved = 0;

		const refreshDiff = () => {
			exec("git diff --shortstat HEAD", { cwd: process.cwd() }, (err, stdout) => {
				if (err || !stdout) {
					diffAdded = 0;
					diffRemoved = 0;
					return;
				}
				const addedMatch = stdout.match(/(\d+) insertion/);
				const removedMatch = stdout.match(/(\d+) deletion/);
				diffAdded = addedMatch ? Number(addedMatch[1]) : 0;
				diffRemoved = removedMatch ? Number(removedMatch[1]) : 0;
			});
		};

		refreshDiff();
		const interval = setInterval(refreshDiff, DIFF_REFRESH_MS);
		// Belt-and-suspenders: never let this timer keep the process alive.
		interval.unref?.();

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: () => {
					clearInterval(interval);
					unsub();
				},
				invalidate() {},
				render(width: number): string[] {
					const usage = ctx.getContextUsage();
					const tokens = usage?.tokens ?? 0;
					const contextWindow = ctx.model?.contextWindow ?? 0;
					const pct = contextWindow > 0 ? Math.round((tokens / contextWindow) * 100) : 0;
					const clampedFilled = contextWindow > 0
						? Math.min(BAR_WIDTH, Math.max(0, Math.round((pct / 100) * BAR_WIDTH)))
						: 0;
					const bar =
						theme.fg("accent", "█".repeat(clampedFilled)) +
						theme.fg("dim", "░".repeat(BAR_WIDTH - clampedFilled));

					const modelLabel = ctx.model?.name || ctx.model?.id || "no-model";
					const thinking = ctx.thinkingLevel ?? "off";

					const branch = footerData.getGitBranch();
					const diffParts: string[] = [];
					if (diffAdded > 0) diffParts.push(theme.fg("success", `+${diffAdded}`));
					if (diffRemoved > 0) diffParts.push(theme.fg("error", `-${diffRemoved}`));
					const diffStr = diffParts.length > 0 ? ` (${diffParts.join(",")})` : "";
					const branchStr = branch ? `⎇ ${branch}${diffStr}` : "";

					const extStatuses = footerData.getExtensionStatuses();
					const yoloStatus = extStatuses.get("yolo");

					const line1Parts = [
						theme.fg("accent", modelLabel) + theme.fg("dim", ` - ${thinking}`),
						yoloStatus,
						theme.fg("dim", `$${sessionCost.toFixed(2)}, `) +
							`[${bar}]` +
							theme.fg("dim", ` ${fmtK(tokens)}/${fmtK(contextWindow)} (${pct}%)`),
						branchStr,
					].filter(Boolean);
					const line1 = truncateToWidth(line1Parts.join(theme.fg("dim", " | ")), width);

					const line2 = truncateToWidth(theme.fg("dim", `  ${process.cwd()}`), width);

					return [line1, line2];
				},
			};
		});
	});
}
