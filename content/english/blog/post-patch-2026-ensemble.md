---
title: "Patching Vulnerabilities with Coding Agents in 2026"
meta_title: ""
description: "Evaluating ten coding agent configurations across four agent frameworks and five frontier models on 63 vulnerabilities from DARPA AIxCC final competition."
date: 2026-03-11T11:00:00Z
image: "/images/blog/patch-2026-ensemble/patch-semantic-correctness.png"
categories: ["post-aixcc"]
authors: ["Cen Zhang", "Andrew Chin", "Brian Lee", "Dongkwan Kim", "Fabian Fleischer", "Youngjoon Kim", "Jiho Kim", "Taesoo Kim"]
tags: ["patch", "semantic correctness", "ensemble", "evaluation"]
draft: true
---

LLM-based patch generation has become a practical approach to fixing software vulnerabilities. Tools like Codex, Claude Code, and Gemini can read code, reason about bugs, and produce patches — often in seconds. But how well do they actually perform, in 2026?

To find out, we ([Team Atlanta folks at Georgia Tech](#contributors)) tested 10 agent configurations — combining four agent frameworks with five frontier models — on 63 real crashes from the DARPA AIxCC final competition.

## Experiment Setup

### Evaluation Task

Given a code repository (with oss-fuzz build tooling), a crash-triggering input, and the corresponding crash log, each agent must produce a patch that fixes the underlying vulnerability. The agents run with their default settings — no custom prompts, no task-specific tuning. They are free to explore the codebase, read files, and use any default tools available in their framework. Each agent framework (Claude Code, Codex CLI, Copilot, Gemini CLI) provides its own agentic workflow for code retrieval, reasoning, and tool orchestration, while the underlying LLM model handles the core patch reasoning.

Each agent gets up to **three attempts** per crash. After each attempt, the patch is automatically validated: applied, compiled, tested against the project's existing test suite, and replayed against the crash-triggering input. If any step fails, the error output is returned to the agent for another try.

### Dataset

Our benchmark consists of **63 crashes** across **24 open-source projects** (14 C and 10 Java), based on synthetic vulnerabilities from the [DARPA AIxCC final competition](https://archive.aicyberchallenge.com/challenges/) (in public release procedure).

### Agent Frameworks

We evaluate **10 agent configurations** spanning four agent frameworks and five frontier models, all using their latest versions as of February 2026. Each framework pairs with one or more models. Among them, Copilot supports multiple model backends, which allows us to test the same framework across different models. When a framework runs its own vendor's model (e.g., Claude Code with Opus, Codex CLI with GPT), we call it a **native** configuration; when Copilot runs another vendor's model, we call it **non-native**.

| Framework | Opus 4.5 | Opus 4.6 | GPT-5.2 Codex | GPT-5.3 Codex | Gemini 3 Pro |
| --------- | -------- | -------- | ------------- | ------------- | ------------ |
| Claude Code v2.1.25 | yes | yes | — | — | — |
| Codex CLI v0.98.0 | — | — | yes | yes | — |
| Gemini CLI v0.28.2 | — | — | — | — | yes |
| Copilot v0.0.406 | yes | yes | yes | yes* | yes* |

*\* Copilot was updated to v0.0.409 during evaluation.*

### Classification

All patches passing automated validation are then manually reviewed (yes, we went through all 630 generated patches by hand, and cross-validated 456 of them :D). A patch is classified as **semantically incorrect** if it suppresses the crash but introduces a new bug or unexpectedly alters program functionality. In total, we classify each outcome into three categories:

| Outcome | Description |
| ------- | ----------- |
| **Valid** | The patch correctly fixes the vulnerability. |
| **Invalid** | The patch fails compilation, tests, or crash replay. |
| **Semantically Incorrect** | The patch passes all automated checks but does not correctly fix the vulnerability. |

Due to this manual effort, each configuration was run only once — our goal is not a fully rigorous experiment controlling for randomness and repetition, but rather to understand the latest trends in agent patching capability while keeping the evaluation effort manageable.

## Q1: How Well Do Today's Agents Patch Zero-Day Vulnerabilities?

{{< image src="images/blog/patch-2026-ensemble/agent-model-overall-performance.png" position="center" class="img-fluid" >}}

*\* Claude Code with Sonnet 3.7 data (the bottom-left one) is from the [AIxCC SoK paper](https://arxiv.org/abs/2602.07666).*

### Steady Progress from '25 to '26

The SoK study on AIxCC evaluated Claude Code v1.0.88 with Claude 3.7 Sonnet on the same 63 vulnerabilities, producing semantically correct patches for **33 out of 63 crashes (~52%)** with a semantic correctness rate of **~62%**. We kept the same evaluation setting in this blog, making this a direct 2025 baseline.

Fast forward to early 2026: the best configurations now reach **~45 out of 63 (~71%)** in correctness and **~80%** in semantic correctness rate, while even the weakest covers **~36 (~57%)** with **~60%** reliability. This reflects the continued and rapid improvement in LLM/agent capabilities from 2025 to 2026, which is amazingly fast and as stable as we've seen in the past years.

It's worth noting that this benchmark is designed around coverage of diverse, real-world open-source projects and vulnerability types, rather than a collection of intentionally difficult patch scenarios. Higher correctness here means the agents can handle a broader range of real-world vulnerability scenarios. We do not dive into individual patch cases or AIxCC challenge details here; for per-vulnerability analysis, refer to the paper's Section 7.

### Model Choice Outweighs Framework Choice

Across our ten 2026 configurations (distinguished by shape for framework and color for native vs. non-native), the choice of model has a larger impact than the choice of agent framework. The most notable model-level difference is from Opus 4.5 to 4.6, which shows a clear jump in both correctness and reliability. Other model gaps are smaller — GPT 5.2 and 5.3 are close overall, and Gemini 3 Pro lands in a similar range with a tendency toward higher reliability.

The choice of agent framework also shows some interesting patterns. Since Copilot supports multiple model backends, we can directly compare it against each model's native agent (Claude Code, Codex CLI, Gemini CLI). In the figure, blue dots mark native framework configurations and orange dots mark non-native ones (i.e., Copilot with another vendor's model). A native framework often does not lead to better performance — the orange dots frequently land above or to the right of their blue counterparts. For example, Copilot + GPT 5.3 outperforms Codex CLI + GPT 5.3, and Copilot + Opus 4.6 outperforms Claude Code + Opus 4.6, in both correctness and semantic correctness rate. However, the framework-level differences are generally smaller than the model-level ones, typically within just a few patches. This is expected for our evaluation scenario — agentic code search followed by patch reasoning — where the model's core reasoning capability dominates, and other framework strengths (broader tool capabilities, usability, developer experience) play a lesser role.

### The 20–40% Semantic Incorrectness Gap

Even the best configuration has ~20% of its patches be semantically incorrect — they pass all automated validation but are actually wrong. This is the most dangerous failure mode: invisible to automation, and only catchable by manual review.

To understand *why* patches fail semantically, we manually analyzed all 145 semantically incorrect patches across 34 vulnerabilities and identified several recurring patterns (a single patch can fall into more than one):

- **Functionality altered or broken** (55 entries) — The most common issue. The patch fixes the bug but changes normal program behavior in unintended ways. For example, in Little CMS, several agents correctly added a null check but also inserted an early return that skips subsequent processing, altering the function's semantics.
- **Patch the symptom instead of root cause** (38 entries) — The patch suppresses the crash without fixing the underlying defect. In libexif, agents patched the crash site while the buggy macro remained unchanged — the vulnerability is still there, just harder to trigger. We also see many defensive patches that address symptoms rather than causes — for example, enlarging a buffer to prevent an overflow when the actual root cause is an off-by-one miscalculation.
- **Incomplete or insufficient fix** (28 entries) — The patch targets the right location but the guard is too weak. In PDFBox, some agents added a `buffer.remaining()` check to prevent oversized allocations, but the check was not strict enough — huge allocations were still possible.
- **Wrong API or type usage** (15 entries) — The patch uses a function or type with subtly different semantics. In Wireshark, agents replaced `tvb_get_uint8` with `tvb_captured_length` or `tvb_reported_length`, which are APIs providing values controlled by users.
- **Wrong security policy** (9 entries) — The security mitigation strategy itself is wrong. For Log4j2, many agents that produced a passing patch chose to whitelist the `java:` protocol for JNDI lookups, when the correct fix is to disable JNDI lookup entirely.
- **Wrong mitigation strategy** (6 entries) — The patch applies an inappropriate fix technique. In Tika, agents imposed hardcoded input size limits instead of fixing the flawed algorithm, changing the accepted input range without addressing the root cause.
- **Controversial** (4 entries) — Reviewers disagreed on whether the patch is semantically correct. These are cases where the patch is reasonable but imperfect — not clearly wrong, but not clearly right either. Different developers may verdict it differently.

## Q2: Can We Improve Semantic Correctness?

Semantic incorrectness is hard to eliminate at the single-agent level — even the best model still produces a meaningful number of semantically incorrect patches. So we asked: if we generate patches from multiple agents, can we pick a better one?

### Approach: Ensemble by Selection

The idea is simple: run multiple agent/model combinations on the same vulnerability, collect all patches that pass automated validation, and select the best one. The selector has no additional guidance — it only knows that these patches passed automated tests and may still have issues like semantic incorrectness or incomplete fixes. It must pick the one most likely to be correct, purely from the candidates themselves. A nice property of this setup is that we can evaluate it directly against our existing manual validation — no new manual review is needed, since we already know which patches are semantically correct. We use Copilot v0.0.409 with GPT-5.3 Codex for all ensemble experiments.

### Results

<div style="display: flex; gap: 1rem; justify-content: center; align-items: center;">
<div style="flex: 1;">
{{< image src="images/blog/patch-2026-ensemble/ensemble-n.png" class="img-fluid" >}}
</div>
<div style="flex: 1;">
{{< image src="images/blog/patch-2026-ensemble/ensemble-n-vs-best-of-n.png" class="img-fluid" >}}
</div>
</div>

The left figure focuses on vulnerabilities with at least one semantically incorrect patch — the cases where selection actually matters. For each N (3–10), it compares the number of valid patches from individual agents (blue) versus the ensemble (red). Since different N values require different numbers of candidates, the set of eligible vulnerabilities varies. **For almost all values of N, the ensemble outperforms every single agent** — only a couple of cases (N=7, 8) tie with the best individual.

The right figure includes all vulnerabilities (not just those with semantically incorrect patches) and compares the total ensemble result (across multiple trials) against the best single component. The ensemble consistently matches or outperforms the best component, confirming that selection helps on the hard cases without hurting the easy ones. On average, **N=3 delivers the best ensemble performance** — one trial at N=8 edges ahead by a single patch, but adding more candidates beyond 3 doesn't reliably help, while the computational cost scales linearly. This makes N=3 the practical sweet spot.

### Why Does It Work?

Intuitively, when multiple agents produce different patches for the same vulnerability, **the contrast between them is informative**. A correct patch might fix the root cause cleanly, while an incorrect one only suppresses the crash or over-engineers the fix — adding redundant checks, touching unrelated code, or taking a convoluted path where a simpler alternative exists. When the selector sees these candidates side by side, the better patch tends to stand out.

## OSS-CRS Integration

Beyond this evaluation, we have also implemented all the patch agents and the ensemble selector as open-source components in the [OSS-CRS](https://github.com/sslab-gatech/oss-crs/blob/main/registry) platform (see [References](#references) for links to individual repos). These are clean reimplementations built for the OSS-CRS architecture, not direct ports of the code used in this evaluation. As coding agents continue to improve, we plan to keep these components up to date — interested readers can try them out directly, and we hope they benefit the broader open-source security community.

> **Note:** The detailed benchmark data and per-vulnerability results are currently in the process of being made public, as they involve AIxCC final competition challenge details. We will update this post with full data once the release is complete.

## References

- [SoK: DARPA's AI Cyber Challenge (AIxCC)](https://arxiv.org/abs/2602.07666) — Systematic analysis of AIxCC competition design, CRS architectures, and results
- [OSS-CRS](https://github.com/sslab-gatech/oss-crs) — Open-source platform for orchestrating bug finding and patch agents
- [crs-claude-code](https://github.com/Team-Atlanta/crs-claude-code) — Claude Code-based patch agent
- [crs-codex](https://github.com/Team-Atlanta/crs-codex) — Codex-based patch agent
- [crs-copilot-cli](https://github.com/Team-Atlanta/crs-copilot-cli) — Copilot CLI-based patch agent
- [crs-gemini-cli](https://github.com/Team-Atlanta/crs-gemini-cli) — Gemini CLI-based patch agent
- [crs-patch-ensemble](https://github.com/Team-Atlanta/crs-patch-ensemble) — Ensemble selection for patch candidates

## Contributors

This work is a joint effort by Team Atlanta members at Georgia Tech.

- **Experiment design:** Taesoo Kim, Cen Zhang
- **Experiment implementation & execution:** Cen Zhang, Andrew Chin, Youngjoon Kim, Dongkwan Kim, Brian Lee
- **Manual & cross validation:** Andrew Chin, Fabian Fleischer, Brian Lee, Jiho Kim, Cen Zhang, Dongkwan Kim, Youngjoon Kim
- **Analysis & writing:** Cen Zhang
- **OSS-CRS integration:** Dongkwan Kim, Cen Zhang, Andrew Chin
