---
title: "Prism: Specialization with Multi-agent Teams"
meta_title: ""
description: "How Prism extends the multi-retrieval approach with specialized teams."
date: 2025-10-13T11:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Yunjae Choi"]
tags: ["patch", "multi-agent"]
draft: true
---

Building on the **Multi-Retrieval Agent**, we developed **Prism** to address two specific challenges: specializing different phases of the patching process and compressing context between patch attempts to stay within token limits.

## Motivation: Token Limits and Specialization

The Multi-Retrieval Agent worked well for many bugs, but we noticed issues when patches required multiple attempts:

**Context Accumulation**: After several failed attempts, the conversation history grew large. The agent carried the original bug report, previous patch attempts, compilation errors, test failures, and all retrieved code. This consumed many tokens for hard cases which needed multiple explorations and attempts to find the root cause.

**Mixed Objectives**: A single agent handled bug analysis, codebase exploration, patch generation, and self-review. Each task could benefit from different prompting strategies and context organization.

Prism addresses these issues through specialization and structured context compression.

## Specialization Through Teams

Prism splits the patching workflow into three specialized teams:

**Evaluation Team**: Processes crash logs, runs tests, and produces feedback reports. It filters logs to extract relevant information like compilation errors or test failures.

**Analysis Team**: Explores the codebase and builds a structured "notebook" of relevant code with explanations. Uses retrieval strategies similar to Multi-Retrieval but organizes findings into cells.

**Patch Team**: Generates and reviews patches based on the analysis notebook rather than raw code retrievals.

A **Supervisor** routes between teams, managing the iteration cycle until a sound patch emerges or the iteration limit is reached.

## How It Works: Initial Cycle

**1. Evaluation**: Processes the bug report, capturing runtime stack traces for Java timeout/stackoverflow bugs and formatting SARIF reports into structured observations.

**2. Analysis**: The Analysis Team has two sub-agents that run sequentially:

   - **Code Context Provider** explores the codebase:
     - Generates an exploration plan based on the evaluation report
     - Retrieves code using grep and file queries (similar to Multi-Retrieval)
     - Creates notebook cells with code line ranges + analysis
     - Iterates until it has sufficient context

   - **Fix Strategy Generator** synthesizes a high-level fix strategy:
     - Analyzes all notebook cells in relation to the evaluation report
     - Generates a strategy (not code yet): "Based on cells 3 and 5, follow the pattern of..."
     - Can request additional files if needed during synthesis
     - Adds those code ranges as new cells if used in the strategy

**3. Patch Generation**: The Patch Team creates and validates patches:
   - **Patch Generator** creates line-range replacements following the strategy
   - **Patch Reviewer** validates them (correct replacement? addresses issue? follows strategy? no syntax errors?)
   - If validation fails, generator receives feedback and tries again (up to a limit)

The supervisor sends the final patch to the Evaluation Team for testing.

## Context Compression Between Cycles

When a patch fails testing, the key question is: what context carries forward to the next cycle?

**Without compression**:
- Original bug report
- All code retrieved in attempt 1
- Patch attempt 1
- Compilation errors from attempt 1
- All code retrieved in attempt 2
- Patch attempt 2
- Test failures from attempt 2
- ... (tokens grow linearly with attempts)

**With Prism's notebook compression**:
- Evaluation report (filtered error messages from latest failure)
- Analysis notebook (5-8 cells with code ranges + insights)
- Previous patch attempt (for reference)

The notebook serves as a compressed representation. A patch attempt that involved exploring 20 files might compress into 5-8 cells with targeted insights. The Analysis Team can add new cells based on the failure, but the bulk of previous explorations is already distilled.

## The Feedback Loop

When a patch fails, the supervisor cycles back through all three teams: Evaluation → Analysis → Patch.

**Evaluation** produces a new report explaining the failure.

**Analysis** explores with new focus while keeping existing notebook.

The Code Context Provider can:
- Add new cells based on the failure
- Reference existing cells when the Fix Strategy Generator builds the strategy
- Skip re-exploring code that's already in the notebook

**Patch** generates a new attempt using the updated analysis.

This continues until a sound patch emerges or the iteration limit (typically 5-6 evaluation cycles) is reached.

## Practical Benefits

**Token Efficiency**: The notebook compresses many code retrievals into a few cells with targeted analysis. Exploring 20 files might result in 5-8 notebook cells.

**Focused Context**: Each team gets only the context it needs. The Patch Generator works from the distilled strategy, not raw error logs.

**Incremental Building**: Failed attempts inform what to explore next. The notebook grows based on actual needs revealed by testing.

**Specialization**: Different teams use different prompting strategies. The Evaluation Team focuses on log parsing; the Analysis Team focuses on code exploration; the Patch Team focuses on code generation.

## Trade-offs

The multi-team approach has costs:

**More LLM Calls**: Each cycle involves multiple team invocations. For complex bugs this is worthwhile; for simple bugs it's overhead.

**Latency**: Building a notebook takes time. When the fix is obvious from the crash log, this extra structure slows things down.

## Conclusion

Prism extends Multi-Retrieval's approach by adding specialization and context compression. It uses the augmented retrieval the Multi-Retrieval Agent uses, but it organizes the retrieved code into a notebook with a focused analysis.

The specialized teams allow focused prompting for each phase. The analysis notebook provides a compressed representation of learned context that scales across multiple patch attempts.

These improvements make Prism suitable for complex bugs that require iterative refinement, complementing the faster but less accurate agents in our ensemble.
