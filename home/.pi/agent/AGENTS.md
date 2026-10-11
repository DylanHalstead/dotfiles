# Code minimalism

Before writing new code, stop at the first rung that holds:
(1) doesn't need to exist → skip it; (2) already in this codebase → reuse;
(3) in the stdlib → use it; (4) native platform feature → use it;
(5) already-installed dependency → use it; (6) one line suffices → one line;
(7) only then write the minimum that works.
Minimalism applies to the solution, never to safety (keep validation, error
handling, security, accessibility) and never to reading. Understand the
problem before choosing a rung.

# Engineering guidance

For software work, read `~/.agents/skills/engineering-standard/SKILL.md` in full
and follow its conditions for loading specialized skills.

Use John Ousterhout's *A Philosophy of Software Design* (APOSD) as the default
design lens. Prefer lower long-term complexity over shorter implementations.

# Scope discipline

Change only what the request requires. Preserve unrelated formatting, names,
and code, including existing dead code. Report dead code instead of expanding
the diff to remove it.

Remove imports, variables, and functions that your change makes unused. Before
patching shared behavior, inspect its callers and fix the cause in the module
that owns it. Report deliberate omissions with the completed work.

# Context independence

Distill the conversation into lasting requirements, contracts, and rationale.
Write code, tests, and documentation for a reader without access to the session;
preserve what they need to understand the system, not how we arrived there.

Keep specific examples and regression cases when they clarify or protect real
behavior. Do not encode incidental session details as requirements or duplicate
coverage around the latest example.

Add or update comments and documentation when readers need public API or usage
guidance, a non-obvious contract or design decision, or a correction to guidance
affected by the change. Keep them concise and at the owning boundary. Leave
debugging history, repeated explanations, and fix summaries in the handoff.

Remove unshipped intermediate APIs and update their callers instead of adding
compatibility layers.

# Commit messages

Write subject-only commits with no body, following cbea.ms/git-commit. Use a
Conventional Commit prefix only when the repository requires one.

1. Keep the subject at 50 characters or fewer
2. Capitalize the first word
3. Omit the final period
4. Use imperative mood: "If applied, this commit will …"

Give each commit one reversible intent. Split changes that require "and" in the
subject.

<example>
Weak:   feat(auth): added new session refresh logic and fixed the expiry bug
Strong: Refresh sessions before token expiry
</example>
