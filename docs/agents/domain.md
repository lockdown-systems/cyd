# Domain Docs

## Before exploring, read these

- `CONTEXT.md` at the repository root
- `CONTEXT-MAP.md`, if it exists
- Relevant ADRs under `docs/adr/`

If these files do not exist, proceed silently. Domain-modeling workflows create them lazily when terms or decisions are resolved.

## File structure

This repository uses the single-context layout:

    /
    ├── CONTEXT.md
    ├── docs/adr/
    └── src/

## Use the glossary's vocabulary

Use domain terms as defined in `CONTEXT.md`. Note genuine vocabulary gaps for domain modeling.

## Flag ADR conflicts

Explicitly surface output that contradicts an existing ADR rather than silently overriding it.
