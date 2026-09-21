# Code minimalism

Before writing new code, stop at the first rung that holds:
(1) doesn't need to exist → skip it; (2) already in this codebase → reuse;
(3) in the stdlib → use it; (4) native platform feature → use it;
(5) already-installed dependency → use it; (6) one line suffices → one line;
(7) only then write the minimum that works.
Minimalism applies to the solution, never to safety (keep validation, error
handling, security, accessibility) and never to reading. Understand the
problem before choosing a rung.

# Software design

Apply John Ousterhout's *A Philosophy of Software Design* (APOSD) as the
default lens across design, implementation, and review. Optimize for lower
long-term complexity, measured as change amplification, cognitive load, and
unknown unknowns.

Prefer deep modules: simple interfaces that hide substantial implementation
complexity. Keep each design decision in one place, pull complexity down into
the module that owns it, and avoid layers that only forward calls. Design for
reading and change. Treat implementation length as secondary. The guidance is
enough for local changes. For substantial feature work, structural refactors,
or changes to modules, APIs, abstractions, or architecture, read
`~/.pi/agent/skills/software-design-philosophy/SKILL.md` in full.

# Scope discipline

Change only what the request requires. Preserve unrelated formatting, names,
and code, including existing dead code. Report dead code instead of expanding
the diff to remove it.

Remove imports, variables, and functions that your change makes unused. Before
patching shared behavior, inspect its callers and fix the cause in the module
that owns it. Report deliberate omissions with the completed work.

# Context independence

Write code and durable artifacts for a reader who has no access to the prompt,
plan, conversation, or review. Use names and comments for lasting domain
rationale rather than edit history. Remove unshipped intermediate APIs and
update their callers instead of adding compatibility layers.

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
