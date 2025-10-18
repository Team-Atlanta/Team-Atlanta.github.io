---
title: "Every Patch Agent has its Own Story (2) - Multi-Retrieval: Iterative Augmented Retrieval for Codebase Exploration"
meta_title: ""
description: "Description of Multi-Retrieval Agent"
date: 2025-10-16T11:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Yunjae Choi", "Insu Yun"]
tags: ["patch", "patch-agent"]
draft: true
---

This post dives into our second patch agent, the *Multi-Retrieval Agent* — designed to help LLMs explore codebases effectively through **iterative augmented retrieval**.
The *Multi-Retrieval Agent* focuses on a practical problem: how do we give an LLM the right code at the right time when fixing bugs? Instead of dumping entire files or hoping the LLM can navigate codebases on its own, this agent implements **augmented code retrieval** — combining multiple search strategies and enriching retrieved code with contextual information that helps the LLM understand what it's looking at.

## The Core Problem: Context Matters

When an LLM needs to fix a bug, it faces an information problem. A crash log might point to a specific function, but fixing it requires understanding:
- The types and data structures involved
- Similar functions that might share logic
- Project-specific patterns and conventions
- Dependencies and imports

Thus, simply providing the crashing function isn't enough, but providing everything is too much — the LLM can't separate signal from noise. The Multi-Retrieval Agent attempts to address this through **iterative, augmented retrieval**; the LLM requests specific code multiple times, and each retrieval returns code enhanced with contextual information that makes it immediately useful.

## High-level Overview (TODO)
```
- TODO: Explain the high-level overview of the Multi-Retrieval Agent.
- TODO: Need to explain the high-level overview of the Multi-Retrieval Agent in a more concise way.
```

The agent operates through cycles of retrieval and analysis:

**1. Initial Analysis**

The LLM receives the bug report and analyzes what information it needs. The system prompt structures this analysis: identify possible root causes, list affected components, suggest different approaches. This isn't just free-form thinking — the prompt explicitly requires the LLM to articulate what it doesn't know yet.
```
- TODO: Explain this more clearly.
- TODO: Is this plan and execute phase?
```
**2. Structured Retrieval Requests**

Based on its analysis, the LLM requests code using structured queries. Two types are supported:
* Symbol queries use grep-style tags: request a function name, class name, type, or code pattern. The retrieval engine interprets these as "find definitions of this symbol."
* File queries request specific files or line ranges. When symbol-based retrieval isn't sufficient, the LLM can ask for broader file-level context.
The constraint: at least 3 queries, at most 5 per round. This forces focused exploration without overwhelming the context window.
```
- TODO: Explain this more clearly.
- TODO: Need to connect this with retrieval phase.
```

**3. Retrieved Code Delivery**

The system runs both retrievers, augments results, filters by priority, and formats the output. The LLM receives retrieved code in a structured format showing:
- The query that was run
- File path and line range for each result
- The code itself with line numbers
- For failed queries, explicit feedback that nothing was found

```
- TODO: Is this augmentation phase? if yes, need to connect this with retrieval phase.
```

This structured delivery helps the LLM understand not just the code, but *where* it came from and *what* was searched for.

**4. Iterate or Patch**

After reviewing retrieved code, the LLM decides: request more code, or generate a patch?
As the LLMs' performance improved, especially with the reasoning models, this decision making became more reliable and patch success rate increased.
When the LLM finally generates patches, it must provide them in a strict XML-like format specifying the original code, line ranges, and replacement code.

## Augmented Retrieval: More Than Text Search

### Dual Retrieval: Breadth and Precision
The retrieval system runs two retrievers in parallel whenever the LLM requests code: Ripgrep for fast text search, and AST-Grep for structural code understanding.
```
- TODO: Need better title for this section.
```

#### Ripgrep: Fast Text Matching

The first retriever uses ripgrep for fast text search across the repository. When searching for a symbol like `example_method`, it finds all occurrences and returns them with context — typically five lines before and after each match. This provides breadth; you see everywhere the symbol appears, with enough surrounding code to understand the usage context.

#### AST-Grep: Structural Understanding

The second retriever parses code into Abstract Syntax Trees and searches structurally. When the LLM asks for a function, AST-Grep specifically finds the function *definition*, not just any line containing that name.

* For C/C++, it distinguishes function definitions, type definitions, struct declarations, and preprocessor macros. It handles incomplete parses where the syntax tree has errors — common in complex codebases with heavy macro usage.

* For Java, it parses fully qualified names. A query for `com.example.ClassName.methodName` is split into package, class, and method components. The retriever validates whether the file path matches the package structure, searches from most specific to most general, and automatically includes relevant import statements.

These retrievers run in parallel. Ripgrep provides fast, broad results. AST-Grep provides precise, structured results. The system combines both.

### Context Augmentation: Making Code Self-Documenting

Simply providing raw code snippets is not enough. 
To enrich the code with contextual information, the Multi-Retrieval Agent adds the following information to the code:

* **Line Numbers:** Every retrieved snippet includes line numbers. When the LLM references specific lines in its analysis or patches, these numbers provide precise location information.
* **Automatic Imports:** For Java methods and classes, when AST-Grep retrieves a definition, it automatically includes the import statements from that file. This matters because understanding what types are available is crucial to understanding what the code does. Consecutive imports are grouped together rather than scattered.
* **Path Rebasing:** Crash logs often reference files using absolute paths from the build environment. The file retriever handles path mismatches by progressively stripping path components until it finds a file that exists in the repository. This makes queries from error logs work even when paths don't match exactly.

### Priority-Based Filtering

When multiple code snippets match a query, returning all of them creates noise. The system assigns priorities to results:

- **High Priority:** Whole-word matches from AST-based retrieval. For Java, this specifically requires the file path to match the package structure in the query.
- **Medium Priority:** Partial-word matches from AST-based retrieval.
- **Low Priority:** Text search fallback results (when AST parsing doesn't work or find anything), and file retrievals.

```
- TODO: Priority sounds bad for me. But okay to leave it if we used this term in the implementation.
- TODO: Need connection between this and the previous section.
- TODO: Maybe with a simple example?
```

After both retrievers run, results are grouped by query. Within each query's results, only the highest-priority tier is kept. If high-priority results exist, medium and low are discarded. A limit of 16 results per query prevents even high-priority matches from overwhelming the context. This filtering implements a key principle: better to give the LLM less information that's highly relevant than more information that's noisy.


### Handling Retrieval Failures

Not every query succeeds. When a symbol isn't found, the system explicitly tells the LLM that the search failed. This prevents the LLM from repeatedly requesting code that doesn't exist, and guides it to refine queries or try different approaches.
```
- TODO: Why is it important to mention?
```


## Patch Extraction with Tolerance

When the LLM generates patches, the extraction process includes tolerance for common formatting issues:

* **Line Number Handling:** If the LLM includes line numbers in the patched code (a common behavior), the extractor automatically strips them. It detects whether line numbers are present by checking if every line contains a colon in a specific pattern.

* **Line Range Adjustment:** The most important tolerance mechanism is automatic line range correction. When the LLM specifies which lines to replace, the extractor:

  1. Reads what the LLM claimed was the original code
  ```
  - TODO: What is the step different from the next step?
  ```

  2. Opens the actual source file
  3. Searches within a window (typically ±3 lines) of the specified range
  4. Tries exact matches first, then matches with stripped whitespace
  5. Adjusts the line range to what actually matches

  This tolerates off-by-one errors and mistakes in line counting, which are common LLM failures.

* **Format Validation:** If patches don't follow the required XML structure, the system immediately prompts for correction.

## Feedback-Driven Iteration

When a patch fails validation, the failure feedback becomes input for the next iteration:

* **Compilation Failures:** The evaluator extracts just the compiler error messages, filtering out verbose output. For C/C++, it finds lines containing "error:" and provides context. For Java, it extracts Maven ERROR logs. Long outputs are truncated to stay within token limits.

* **Vulnerability Persistence:** If the bug still reproduces after patching, the crash log is filtered and provided. For Java timeout and stack overflow bugs — which often show only JVM internals — the system includes specialized analyzers that capture stack traces from the JVM *before*, showing the actual project code path.

* **Regression Failures:** When a patch breaks existing tests, the feedback emphasizes that the fix worked but changed behavior. This guides the LLM toward more conservative approaches.

The filtered feedback becomes the new issue for the next round. The LLM enters another analysis phase, now with richer information: the original bug, its previous attempt, why it failed, and all the code it has already explored.

## Language-Specific Retrieval Strategies

The retrieval and augmentation adapt to the programming language:

**For C/C++:**
- AST-Grep tries to retrieve complete function bodies, even when the syntax tree has errors using heuristics
- Type definitions include both the typedef and the underlying struct when they're separate
- Preprocessor definitions are treated as first-class retrievable entities

**For Java:**
- Qualified names are parsed to understand package.Class.method structure
- File paths are validated against package structure to prioritize correct matches
- Import statements are automatically retrieved with any class or method

These language-specific strategies ensure the augmented code includes what actually matters for understanding each language's semantics without iterating or retrieving too much.

## Why Augmented Retrieval Works

The Multi-Retrieval Agent's approach works because it addresses several key challenges:

* **Multiple retrieval strategies** provide both breadth (ripgrep finds everything) and precision (AST-Grep finds the right thing). Running them in parallel means you get both perspectives.

* **Context augmentation** makes retrieved code self-documenting. Line numbers, imports, and language-specific additions mean the LLM doesn't have to guess about details.

* **Priority filtering** ensures the LLM sees relevant code, not every possible match. This maintains focus.

* **Iterative exploration** allows the LLM to build understanding incrementally, requesting new code based on what it learned from previous retrievals.

* **Tolerance mechanisms** in patch extraction handle small LLM errors, making the system robust to imperfect formatting and line counting.

* **Structured feedback** from validation failures gives the LLM actionable information for the next attempt, completing the learning loop.
```
- TODO: Is it really needed to mention this?
```


## Conclusion

The Multi-Retrieval Agent demonstrates that effective automated patching requires careful attention to how information is retrieved and presented. By combining multiple retrieval strategies, augmenting retrieved code with contextual information, filtering results by priority, and supporting iterative exploration, the agent gives LLMs what they need to understand and fix bugs effectively.

The key insight is simple: retrieval isn't just about finding code, it's about finding the *right* code and presenting it in a way that's immediately useful. Augmented retrieval — enriching search results with line numbers, imports, language-specific context, and priority rankings — makes the difference between an LLM that stumbles through a codebase and one that navigates it productively.

In the Atlantis-Patch system, the Multi-Retrieval Agent handles cases where systematic code exploration is needed to understand and fix bugs. Its focus on augmented retrieval complements other agents in our ensemble, contributing to the overall robustness of our automated patching approach.
