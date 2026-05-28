# GitMind

GitMind is an AI-powered Git debugging assistant that lives in your VS Code sidebar. It scans your repository structure and history, identifies breaking commits, explains merge conflicts, and summarizes changes through natural language queries.

## Features

- **Repository Context Scanner**: Silently analyzes repo folder structure, manifest files (`package.json`, `Cargo.toml`, etc.), and recent commits. Generates and uses `.gitmind/project-context.md` for AI prompt enhancements.
- **Breaking Commit Detector**: Scans your git history and diffs to identify which commits likely broke things, assigning high, medium, or low risk.
- **Merge Conflict Explainer**: Explains conflict markers (`<<<<<<<`), describes what each branch was attempting, and offers recommendations on which lines to keep.
- **Git Change Summarizer Chat**: Chat panel to query changes in plain English (e.g. "What did the last 5 commits do?").
- **API Key & Model Setup**: Setup OpenRouter key and switch between various free/paid AI models directly from the sidebar.

## Setup

1. Install the extension.
2. If you don't have an OpenRouter API key, get a free one at [openrouter.ai](https://openrouter.ai/).
3. GitMind will show a welcome page prompting you for the API key. Paste the key and click **Save Key & Get Started**.
4. To modify or reset your key later, use the `GitMind: Set OpenRouter API Key` command from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

## Supported Models

Choose from recommended free and paid models in the sidebar dropdown:
- `google/gemma-3-12b-it:free` (Default, Fast, Free)
- `google/gemma-3-27b-it:free` (Smarter, Free)
- `deepseek/deepseek-r1:free` (Reasoning, Free)
- `meta-llama/llama-4-scout:free` (Balanced, Free)
- `qwen/qwen3-235b-a22b:free` (Most capable, Free)
- `anthropic/claude-3.5-haiku` (Fast, Paid)
- `openai/gpt-4o-mini` (Reliable, Paid)
