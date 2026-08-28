/**
 * Phase shortcuts
 *
 * The workflow phases are prompt templates in `~/.pi/agent/prompts/`, invoked
 * as `/brainstorm`, `/plan`, `/implement`, `/review`, `/refactor`. Templates
 * cannot register their own keybindings, so this maps one keystroke per phase
 * to pre-filling the editor with the command and a trailing space — leaving
 * the cursor exactly where the target goes.
 *
 * Pre-fill rather than submit: every phase takes an object ("plan *this doc*",
 * "review *this branch*"), so the useful shortcut is the one that starts the
 * line, not the one that runs it.
 *
 * Alt+Shift, not plain Alt: pi binds plain alt+letter to editor motions
 * (alt+b/alt+f are word-left/word-right, alt+d deletes a word, alt+y yanks),
 * and shadowing those costs more while typing than these shortcuts save. No
 * built-in uses alt+shift, and `yolo.ts` already sits there.
 *
 * (Alt = Option on macOS. Remap via keybindings if your terminal eats these.)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PHASES = [
	{ key: "alt+shift+b", command: "brainstorm" },
	{ key: "alt+shift+p", command: "plan" },
	{ key: "alt+shift+i", command: "implement" },
	{ key: "alt+shift+r", command: "review" },
	{ key: "alt+shift+f", command: "refactor" },
] as const;

export default function phaseShortcutsExtension(pi: ExtensionAPI): void {
	for (const { key, command } of PHASES) {
		pi.registerShortcut(key, {
			description: `Compose /${command}`,
			handler: async (ctx) => ctx.ui.setEditorText(`/${command} `),
		});
	}
}
