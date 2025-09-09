---
title: "Atlantis–SARIF: Reliable Validation for Static Analysis Reports"
meta_title: "Atlantis–SARIF: Reliable Validation for Static Analysis Reports"
description: "How Atlantis validates SARIF with reachability analysis and LLM-based matching"
date: 2025-12-31T12:15:00Z
image: "/images/blog/crs-sarif/atlantis-sarif.png"
categories: ["Atlantis-SARIF"]
author: "Youngjoon Kim"
tags: ["SARIF", "static-analysis", "reachability", "llm-based validation"]
draft: true
---

## 💥 Escaping the Hell of False Positives

When it comes to bug-finding approaches, the field can be broadly divided into two categories: **dynamic analysis** and **static analysis**.

**Dynamic analysis**—most notably fuzzing—has already become an indispensable tool for security engineers, and it was also a core component of our [Atlantis](https://team-atlanta.github.io/blog/post-crs-multilang/), where multiple fuzzing techniques were actively employed throughout the competition.

**Static analysis**, however, still struggles to gain trust. The main reason is simple—*too many false positives* [^1][^2].

[^1]: Johnson, Brittany, et al. "Why don't software developers use static analysis tools to find bugs?." 2013 35th International Conference on Software Engineering (ICSE). IEEE, 2013.
[^2]: Wadhams, Zachary Douglas, Clemente Izurieta, and Ann Marie Reinhold. "Barriers to using static application security testing (SAST) tools: A literature review." Proceedings of the 39th IEEE/ACM International Conference on Automated Software Engineering Workshops. 2024.

### 🤔 Why So Many False Positives?

Why does static analysis produce so many false positives?

Dynamic analysis only reports bugs that occur along actual execution paths, meaning it flags only problems that truly manifest at runtime.

Static analysis, in contrast, explores all possible paths, regardless of whether they are realistically reachable or not.
This often leads to warnings for paths that could never be taken in practice.
The issue is compounded by the difficulty of modeling function call contexts, conditional branches, or complex features like libraries, pointers, and dynamic memory.
Inevitably, this simplification results in warnings detached from reality.

### 🔒 No Escape: Living with the Hell of False Positives

One might ask, *“Why not simply avoid static analysis and rely solely on dynamic analysis to escape the false positive problem?”*

The answer is clear: *that’s not an option*.

Dynamic analysis benefits from strong oracles, such as sanitizers, which keep false positives at bay.
Yet it faces limitations of its own.
Building a suitable execution environment can be challenging, and even with powerful testing frameworks, reaching deeply nested code behind complex path constraints remains difficult.

For these reasons, static analysis cannot be abandoned, and overcoming the false positive challenge must be accepted as an unavoidable step.

### ✨ LLMs as a Breakthrough: The AFC Journey

This leads to the question: can **large language models (LLMs)** offer a breakthrough?
Having already shown remarkable potential in bug finding and patch generation, LLMs spark hope that they might also help mitigate the false positive problem in static analysis.
In fact, to explore this possibility, the AIxCC organizers introduced the SARIF task into the AFC.

This blog post details the journey of Team Atlanta in tackling the SARIF validation problem and the insights gained along the way.


## 📄 What is SARIF?

SARIF (Static Analysis Results Interchange Format) is an open standard designed to represent the outputs of static analysis tools in a consistent, JSON-based structure.

By adopting SARIF, results from different tools can be easily integrated across platforms such as IDEs, CI/CD pipelines, and security dashboards.

The format also supports rich metadata—including tool details, rules, results, code locations, execution flows, and fingerprints—that improves both accuracy and readability of reports.

As an OASIS standard, SARIF has gained wide adoption, with major developer tools like GitHub, Visual Studio, and VS Code providing native support for visualization and automated processing.


## 🧪 SARIF Assessment in AFC

Although the AIxCC Semi-final and Final competitions saw many rule changes, the most significant was the introduction of the new SARIF task, announced rather suddenly in December of last year.

The organizers never fully explained why they added it so abruptly, but the reasoning seems clear: as discussed earlier, the false positive problem in static analysis has long been a barrier to practical adoption, and addressing it aligned with both real-world utility and community demand.

According to the AFC rules, the SARIF task carried a lower base score than bug finding or patch generation, and the total number of SARIF tasks never exceeded thirty.

On the surface, this made it look like a minor component.

But once bundling scores were factored in, the story changed.

If a CRS successfully connected its SARIF assessments with the correct PoV or patch, it earned valuable **bonus points—up to three per match**.

Done incorrectly, however, it could even cost points.

This made SARIF a **strategically important task**, capable of swinging the overall competition results despite its modest standalone value.

Technically, the task worked as follows: when a SARIF broadcast was released, each CRS could submit assessments marking whether the reported issue at a given file, line, and CWE type was correct or incorrect.

Each assessment had to include the SARIF ID, a binary verdict, and a justification.

Correct judgments were scored as \(1 \times \tau_{\text{assessment}}\), where \(\tau_{\text{assessment}}\) decayed from 1 to 0.5 over time.

Incorrect or outdated submissions not only earned no points but also lowered accuracy, and only the final submission per broadcast was graded.

Beyond its scoring weight, SARIF was technically and academically impactful.

The task challenged teams to combine static analysis with reachability analysis and LLM-based matching to reduce false positives—a central open problem in the field.

Recognizing its importance, Team Atlanta staffed a dedicated six-person unit, forming an independent sub-CRS known as Atlantis-SARIF, to focus exclusively on this challenge.

## 🛡️ Atlantis-SARIF: Conservative Validation based on PoV
{{< image src="images/blog/crs-sarif/overview.png" position="center" class="img-fluid" >}}

SARIF reports are notorious for containing many false positives, and the same was true for the SARIF assessment tasks provided by the competition.

Submitting an incorrect assessment carried penalties, so we adopted a **conservative strategy** that emphasized accuracy above all else.

The only rigorous oracle for determining whether a SARIF report was valid was whether a **Proof of Vulnerability (PoV)** could actually be triggered at the reported code location.

For this reason, Atlantis-SARIF based its validation squarely on PoVs discovered by our bug-finding CRSs.

When Atlantis-Patch successfully generated a corresponding fix, both the PoV and the patch were used to strengthen validation.

As illustrated in our system diagram, Atlantis-SARIF communicated closely with other CRSs through a shared database.

Its design rested on two main pillars: **reachability analysis**, which filtered out unreachable code regions, and **LLM-based validation**, which refined assessments.

This conservative approach not only minimized the risk of penalties but also proved strategically effective:
by maximizing assessment accuracy, it boosted our overall accuracy multiplier, ensuring that smaller point gains in SARIF tasks translated into a decisive competitive advantage in the final scoreboard.

## 🧭 Reachability Analysis

Because SARIF assessment ultimately depends on matching issues to PoVs, accurately determining whether a PoV can reach a given SARIF location is critical.

To specialize in this task, Atlantis-SARIF placed **reachability analysis** at the center of its design.

If the target code region was unreachable from the harness, we filtered it out, preventing other bug-finding CRSs from wasting resources.

If it was reachable, we amplified the effectiveness of their targeted techniques—such as directed fuzzers or LLM-based PoV generation.

Reachability analysis was also applied in *diff mode*, where identifying reachable changes was equally valuable, and the results were shared across CRSs.

### 🕸️ Call Graph Generation

The first step was to construct a call graph using static analysis.

- **Static call graph generation.** Given a challenge project (CP), we generated an initial graph through multiple tools: CodeQL for baseline static graphs, SVF for Andersen-style points-to analysis in C, and SootUp for Java (CHA and RTA).
  The outputs of these analyses were unified into a single call graph.
- **Dynamic call graph refinement.** Purely static analysis proved insufficient, so we refined the graph by executing fuzzing corpora and collecting function traces.
  Our tracer was built on DynamoRIO for C and extended Jazzer for Java.
  The call graph was continuously updated with these runtime traces.
- **Node and edge information.** Each function node included detailed metadata—file name, start and end line, signature, and method descriptor—so that it could be matched precisely to both source and binaries.
  Edges were annotated not just as direct or indirect calls but also as **strong** or **weak** depending on their confidence level.
  For instance, edges derived from the function tracer were always considered strong.

### 📈 Output of Reachability Analysis

Reachability analysis itself was imperfect, subject to false positives and false negatives.
To guide decision-making in other CRSs, we introduced a **three-level confidence metric**:

- **Certain** → a path exists using only strong edges
- **Possible** → a path exists but includes weak or indirect edges
- **Unlikely** → no path exists

In addition, we exported concrete call paths from harness entry points to reachable functions, allowing bug-finding CRSs to target them more effectively.

### 🧱 Robustness of Reachability Analysis

For Team Atlanta, **system robustness** was a top priority.
Call graph construction, especially pointer analysis, could be prohibitively expensive for large projects.
To mitigate this, we enforced **strict timeouts** and applied **fallback strategies**:

1. Whole-program points-to analysis when feasible
2. Restricting analysis to functions reachable from organizer-provided harnesses
3. Skipping pointer analysis entirely and extracting only direct calls

This staged fallback approach maximized robustness and ensured that failures in reachability analysis did not cascade into other components.

### 🧩 Edge Cases

Certain projects required additional handling.

SQLite3, with its amalgamated codebase, demanded fuzzy similarity checks for accurate function matching.

Variants of curl, where multiple harnesses shared identical paths, required **linking target analysis** to properly distinguish entry points.

These edge cases highlighted the practical challenges of deploying reachability analysis at scale.

## 🤖 LLM-based SARIF Validation

While our conservative strategy began with PoV and patch information as the core oracle for validation, the simplest way to connect them with SARIF reports was through **direct matching**.

We first measured how much the PoV’s stack trace overlapped with the SARIF-reported code location, and compared the lines modified by patches against the SARIF-referenced lines.

### ⚠️ Limitations of Simple Matching

This approach was fast and straightforward, but its shortcomings quickly became apparent.

Utility code frequently appeared across multiple bugs, creating spurious matches.

Small patches or vulnerabilities buried deep in the call graph often showed little overlap, causing us to miss valid connections.

Thresholds had to be tuned differently for each codebase, and complex cases like multi-harness projects were left entirely unsupported.

### 🚀 Enter the LLM Agent

To reduce false positives and improve robustness, we introduced an **LLM-based validation agent** in the final stage.

The agent was given:

- The full SARIF report
- PoV crash logs
- Patch diffs (when available)
- Relevant code snippets, retrieved automatically, with the LLM reasoning over which parts to use

The agent’s role was threefold:

1. Identify the *root cause* and trigger conditions of the PoV
2. Evaluate the *logical consistency* between SARIF findings and PoV/patch evidence
3. Produce a *final verdict*: *Matched*, *Not Matched*, or *Uncertain*

### 📊 Evaluation Results

We evaluated this LLM-based module against our internal benchmark.

Compared to naive overlap-based matching, the LLM agent delivered **substantially higher accuracy** and more stable performance across diverse projects.

The results are presented as confusion matrices, capturing the decisions (Matched / Not Matched / Uncertain) under three scenarios—Crash-only, Patch-only, and Crash+Patch.

The detailed outcomes are summarized in the following table.


<table border="1" cellspacing="0" cellpadding="5" style="border-collapse: collapse; width: 100%;">
  <thead style="background-color: rgb(44, 62, 80); text-align: center;">
    <tr>
      <th rowspan="2" style="text-align: center;">Decision</th>
      <th colspan="2" style="text-align: center;">Crash-only</th>
      <th colspan="2" style="text-align: center;">Patch-only</th>
      <th colspan="2" style="text-align: center;">Crash+Patch</th>
    </tr>
    <tr>
      <th style="text-align: center;">Matched</th>
      <th style="text-align: center;">Not Matched</th>
      <th style="text-align: center;">Matched</th>
      <th style="text-align: center;">Not Matched</th>
      <th style="text-align: center;">Matched</th>
      <th style="text-align: center;">Not Matched</th>
    </tr>
  </thead>
  <tbody style="text-align: center;">
    <tr>
      <td><b>Matched</b></td>
      <td>50</td><td>5</td>
      <td>51</td><td>2</td>
      <td>53</td><td>4</td>
    </tr>
    <tr>
      <td><b>Uncertain</b></td>
      <td>3</td><td>20</td>
      <td>7</td><td>6</td>
      <td>0</td><td>0</td>
    </tr>
    <tr>
      <td><b>Not Matched</b></td>
      <td>5</td><td>209</td>
      <td>0</td><td>226</td>
      <td>5</td><td>230</td>
    </tr>
  </tbody>
</table>


##  🔭 Future Work

Our current SARIF validation pipeline relies heavily on PoVs discovered through dynamic analysis.

This dependency means that in environments where dynamic execution is infeasible—such as when a project cannot be compiled or an execution environment is difficult to set up—our approach cannot be applied, and the cycle of false positives inevitably returns.

Breaking this dependency requires a validation method that **works without PoVs**.

In fact, we prototyped an LLM-agentic validation module capable of assessing SARIF reports directly, but we chose not to deploy it during the competition in order to uphold our conservative validation principle.

Nevertheless, our internal evaluations showed that with the latest LLMs, this approach produced promising results.

Looking ahead, we see strong potential in advancing PoV-free SARIF validation—an effort that could significantly broaden applicability and further reduce false positives in static analysis.

## 🏊 Deep Dive

-  Atlantis-SARIF code: https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-sarif