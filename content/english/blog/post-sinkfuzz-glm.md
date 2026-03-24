---
title: "More CPUs Won't Find More Bugs: Lessons from LLM-Assisted Java Fuzzing"
meta_title: ""
description: "We built Gondar, an LLM-guided Java fuzzer that finds 5x as many vulnerabilities as state-of-the-art fuzzing, at lower cost. Here's what we learned."
date: 2026-03-27T11:00:00Z
image: "/images/blog/sinkfuzz-glm/cover.png"
categories: ["post-aixcc"]
authors: ["Fabian Fleischer", "Cen Zhang"]
tags: ["fuzzing", "java", "llm", "vulnerability discovery", "gondar"]
draft: true
---

As part of [Team Atlanta's](https://team-atlanta.github.io/) winning entry in the DARPA AIxCC competition, we built Gondar, a system that combines LLM agents with coverage-guided fuzzing to find security vulnerabilities in Java applications. Gondar served as part of the Java vulnerability discovery component of our Cyber Reasoning System (CRS). We wrote a [paper](https://example.com/TODO-preprint-link) about Gondar. This post isn't a summary of that paper. Instead, we want to share the three most surprising things we learned along the way.

## Scaling Fuzzing Doesn't Solve the Problem

The conventional assumption in fuzzing is straightforward: more compute, more bugs. We tested this directly. We ran [Jazzer](https://github.com/CodeIntelligenceTesting/jazzer), the state-of-the-art coverage-guided Java fuzzer, on 54 known vulnerabilities across 22 open-source Java projects in two configurations: a standard baseline with 3 cores and 12 hours per target, and a large-scale run with 50 cores and 24 hours per target (over 7.2 CPU-years of total computation).

The result: both configurations exploited exactly 8 vulnerabilities. Scaling compute by 17x and doubling the time budget produced zero additional exploits. The large-scale run reached 3 more sinks (29 vs. 26), but couldn't convert any of them into working exploits. The failures fell into two categories: 46% of vulnerabilities were never even *reached*, and another 39% were reached but not *exploited*, what we call the "last-mile" problem.

Why? Because the vulnerabilities that matter require semantic understanding, not random mutation. Triggering a deserialization vulnerability means constructing a valid archive with specific internal structure. Exploiting a path traversal requires crafting paths that bypass sanitization logic. Reaching a command injection sink might depend on satisfying a cryptographic check, like an HTTP header whose SHA-256 hash matches a specific value. No amount of bit-flipping will produce that.

Half the targets reached 95% of their final coverage within 15 minutes. The remaining hours and cores contributed almost nothing. This isn't a resource gap. **It's a semantic gap.**

{{< finding >}}
Jazzer exploits only 8 of 54 vulnerabilities regardless of whether it runs on 3 cores for 12 hours or 50 cores for 24 hours. Coverage saturates in minutes: this is a semantic gap, not a resource gap.
{{< /finding >}}

{{< image src="images/blog/sinkfuzz-glm/coverage-saturation.png" position="center" class="img-fluid" >}}

*Jazzer's code coverage over time for three example projects. Each line is a fuzzing harness. Coverage flatlines early; the remaining hours contribute little new coverage.*

## Gondar: Breaking Through the Semantic Wall

Gondar is our response to this gap. Instead of throwing more CPUs at the problem, we combine LLM-based reasoning with fuzzing, targeting *sinks*: security-sensitive API calls like `Runtime.exec()`, `ProcessBuilder`, or SQL query methods where vulnerabilities actually manifest.

The system has three stages. First, **sink detection** identifies high-potential sinks in the target project by extracting candidates from CodeQL's sink database and filtering them through call graph analysis and LLM-based exploitability assessment, taking thousands of candidates down to a manageable set. Second, an **exploration agent** analyzes call paths from the program entry point to each sink, reads the source code along the path, and generates inputs designed to satisfy the constraints needed to reach it. Third, an **exploitation agent** receives inputs that successfully reach sinks (we call these "beep seeds") and iteratively develops proof-of-concept exploits by reasoning about the vulnerability-specific conditions needed to trigger Jazzer's sanitizers.

Critically, these agents don't run in isolation. They operate concurrently with Jazzer and exchange artifacts in both directions: exploration seeds flow into the fuzzer's corpus for further mutation, while (fuzzer-)discovered beep seeds flow to the exploitation agent as concrete starting points. All exploitation outputs, even failed attempts, are fed back to the fuzzer, which may mutate a near-miss into a working exploit.

{{< image src="images/blog/sinkfuzz-glm/system-overview.png" position="center" class="img-fluid" >}}

*Gondar's architecture. LLM agents and the fuzzer run concurrently, exchanging artifacts bidirectionally. Exploration seeds enrich the fuzzer's corpus; fuzzer-discovered beep seeds ground the exploitation agent's reasoning.*

The result: **Gondar exploits 41 of 54 vulnerabilities, compared to Jazzer's 8**. That's over 5x as many on the same benchmark, at comparable or lower cost. Let's look into *why* this works.

## LLMs and Fuzzers Are Complementary, Not Interchangeable

It's tempting to think of LLMs as a replacement for fuzzers, or vice versa. Our results show the opposite: they have fundamentally different strengths, and the combination is greater than the sum of its parts.

LLMs excel at structure and intent. They can generate a well-formed ZIP archive containing a crafted payload, reason about path constraints from source code, or construct an XML document that satisfies a parser's type system. Fuzzers excel at fast mutation. They can mutate a seed input millions of times per second, exploring many cases quickly, which would take a human or LLM a long time to think about. Neither capability substitutes for the other.

The strongest evidence: **9 vulnerabilities** in our benchmark are **found *only* through the agent-fuzzer collaboration**. Neither the agents alone nor the fuzzer alone discovers them. Take a zip-slip vulnerability in Apache ZooKeeper: the exploitation agent understands the vulnerability pattern and generates archive inputs that are structurally close to a working exploit, but not quite right. Jazzer picks up these seeds and mutates them, eventually producing an input that triggers the sanitizer. The agent provides the semantic scaffolding; the fuzzer provides the last-mile refinement.

{{< finding >}}
9 vulnerabilities are discovered only through agent-fuzzer collaboration. Neither component finds them independently; the combination outperforms the sum of its parts.
{{< /finding >}}

## You Don't Need a Flagship Model

After validating Gondar's design with flagship models (GPT-5, Gemini-2.5-Pro, and Claude Sonnet 4.5, which exploit 37-41 vulnerabilities at <span>$</span>2,400-<span>$</span>3,000 total), we asked the natural follow-up: how much does the model actually matter?

We swapped in GLM-5, an open-source model, and the result surprised us. GLM-5 exploits 35 vulnerabilities at a total cost of just <span>$</span>373, or <span>$</span>10.66 per bug, compared to <span>$</span>53-<span>$</span>74 for flagship models. It achieves **85% of flagship performance at roughly 12-15% of the cost**.

Put differently: GLM-5 at <span>$</span>373 finds more vulnerabilities than large-scale fuzzing at <span>$</span>3,264, while costing less than one-ninth as much. The architecture amplifies the model. A well-designed system with a modest open-source model beats brute-force compute with no intelligence.

{{< finding >}}
GLM-5 (open-source) exploits 35 vulnerabilities at <span>$</span>373 total, more than large-scale fuzzing at <span>$</span>3,264, and 85% of flagship performance at 12-15% of the cost.
{{< /finding >}}

<style>.narrow-fig { margin: 0 auto; } @media (min-width: 768px) { .narrow-fig { max-width: 65%; } }</style>
<div class="narrow-fig">
{{< image src="images/blog/sinkfuzz-glm/cost-vs-bugs.png" position="center" class="img-fluid" >}}
</div>

*Cost versus vulnerabilities exploited across all configurations. GLM-5 sits in the sweet spot: near-flagship effectiveness at a fraction of the cost. Large-scale fuzzing (Baseline-LS) costs the most while finding the fewest vulnerabilities.*

## What This Means

These results go beyond our benchmark. Static analysis tools like CodeQL and SpotBugs miss 63-74% of the vulnerabilities we tested, not because they're bad tools, but because they're solving a different problem. And during AIxCC, Gondar discovered 7 zero days in real-world projects, which were disclosed to the software maintainers.

What stuck with us: a well-designed system with a cheap model consistently beats an expensive brute-force approach with no intelligence. We're now working to make this available more broadly: Gondar is being integrated into [OSS-CRS](https://github.com/ossf/oss-crs), an OpenSSF Sandbox Project, for continuous open-source security protection. The [paper](https://example.com/TODO-preprint-link) has the full methodology, and the implementation will be available in OSS-CRS soon.

## References

- [Gondar paper](https://example.com/TODO-preprint-link) - Full paper with detailed methodology and evaluation
- [Jazzer](https://github.com/CodeIntelligenceTesting/jazzer) - Coverage-guided fuzzer for Java
- [CodeQL](https://codeql.github.com/) - Semantic code analysis engine
- [DARPA AIxCC](https://aicyberchallenge.com/) - AI Cyber Challenge competition
- [OSS-CRS](https://github.com/ossf/oss-crs) - Open-source Cyber Reasoning System platform
