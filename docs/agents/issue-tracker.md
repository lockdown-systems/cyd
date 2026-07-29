# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

Every issue, pull request, or comment written by an agent must end with this exact authorship disclosure:

```md
_(This was written by an LLM.)_
```

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply/remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When enabled, use the corresponding `gh pr` commands. A bare GitHub number may be an issue or PR; resolve it with `gh pr view` and fall back to `gh issue view`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Use a `wayfinder:map` issue with linked child issues. Use GitHub issue dependencies where available, claim work by assigning it, and resolve children by commenting and closing them.
