---
name: token-efficient
description: >-
  Minimize token use in Cursor agent sessions. Use when the user asks to save
  tokens, reduce context, or work efficiently on any project.
---

# Token-Efficient Agent Workflow

## Before acting

1. **Grep/targeted read** — never read whole repo; use path + line range
2. **Check project skills** — e.g. `.cursor/skills/pixelium/SKILL.md` for file map
3. **One package at a time** — monorepos: identify package first, then one file

## While editing

- Minimal diff — no drive-by refactors
- Reuse existing functions; don't duplicate
- Skip re-explaining architecture user already knows
- Don't read `node_modules/`, `dist/`, `*.json` audit logs unless debugging

## Tool choice

| Need | Use | Avoid |
|------|-----|-------|
| Find symbol | Grep | Task explore agent |
| File by name | Glob | Recursive list_dir |
| Run demos | Shell script | Manual step replay |
| Multi-file architecture | Read 1 skill file | Read 10 source files |

## Response style

- Short summary + paths, not full file dumps
- Code citations with line ranges, not entire files
- Link to `docs/` instead of repeating doc content

## Scripts over generation

Prefer existing npm scripts (`npm run demo:*`, `scripts/verify.ps1`) over rewriting test harnesses in chat.

## When stuck

1. Read ONE file from skill map
2. Grep error string
3. Only then broaden search
