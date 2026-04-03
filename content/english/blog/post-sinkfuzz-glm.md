---
title: "More CPUs Won't Find More Bugs: Lessons from LLM-Assisted Java Fuzzing"
meta_title: ""
description: "We built Gondar, an LLM-guided Java fuzzer that finds 5x as many vulnerabilities as state-of-the-art fuzzing, at lower cost. Here's what we learned."
date: 2026-03-27T11:00:00Z
image: "/images/blog/sinkfuzz-glm/cover.png"
categories: ["post-aixcc"]
authors: ["Fabian Fleischer", "Cen Zhang"]
tags: ["fuzzing", "java", "llm", "vulnerability discovery", "gondar"]
draft: false
---

As part of our winning entry in the DARPA AI Cyber Challenge, we built Gondar, a system that combines LLM agents with coverage-guided fuzzing to find security vulnerabilities in Java applications. Gondar served as part of the Java vulnerability discovery component of our CRS.

After AIxCC, we set out to evaluate Gondar rigorously under controlled, reproducible conditions. We wrote a [paper](https://arxiv.org/abs/2604.01645) about the results. This post covers the most interesting things we learned.

## Scaling Fuzzing Doesn't Solve the Problem

The conventional assumption in fuzzing is straightforward: more compute, more bugs. We tested this directly. We ran [Jazzer](https://github.com/CodeIntelligenceTesting/jazzer), the state-of-the-art coverage-guided Java fuzzer, on our benchmark in two configurations: a standard baseline with 3 cores and 12 hours per target, and a large-scale run with 50 cores and 24 hours per target (over 7.2 CPU-years of total computation).

**The benchmark.** No existing Java vulnerability benchmark suited our needs, so we built one: **54 vulnerabilities across 22 open-source Java projects**, spanning 12 CWE types. It draws from real CVEs (19), AIxCC challenges (20), and vulnerabilities we manually injected based on real-world patterns (15). Controlled access is being prepared to support reproducibility while mitigating model contamination.

The result: both configurations exploited exactly 8 vulnerabilities. Scaling compute by 17x and doubling the time budget found zero additional vulnerabilities. The large-scale run reached 3 more sinks (29 vs. 26), but couldn't convert any of them into a PoC confirming the vulnerability. The failures fell into two categories: 46% of vulnerabilities were never even *reached*, and another 39% were reached but not *exploited*, what we call the "last-mile" problem.

Why? Because these vulnerabilities require inputs with specific *structure and semantics* that are unlikely for random mutation to produce. Triggering a deserialization vulnerability means constructing a valid archive with correct internal structure. Exploiting a path traversal requires crafting paths that bypass sanitization logic. An XXE attack requires well-formed XML with specific entity definitions. Reaching a command injection sink might depend on satisfying a cryptographic check. Random mutation won't solve these; they require understanding what the code expects and why.

We found that half the targets reached 95% of their final coverage within 15 minutes (Figure 1). The remaining hours and cores contributed almost nothing. This isn't a resource gap. **It's a semantic gap.**

{{< finding >}}
Jazzer exploits only 8 of 54 vulnerabilities regardless of whether it runs on 3 cores for 12 hours or 50 cores for 24 hours. Coverage saturates in minutes: this is a semantic gap, not a resource gap.
{{< /finding >}}

{{< image src="images/blog/sinkfuzz-glm/coverage-saturation.png" position="center" class="img-fluid" >}}

*Figure 1: Jazzer's code coverage over time for three example projects. Each line is a fuzzing harness. Coverage flatlines early; the remaining hours contribute little new coverage.*

## Gondar: Breaking Through the Semantic Wall

Gondar is our response to this gap. Instead of throwing more CPUs at the problem, we combine LLM-based reasoning with fuzzing, targeting *sinks*: security-sensitive API calls like `Runtime.exec()`, `ProcessBuilder`, or SQL query methods where vulnerabilities actually manifest. We've [written about this sink-centered approach before](/blog/post-crs-java-overview) in the context of Atlantis-Java.
Figure 2 shows a system overview of Gondar.

Gondar first deploys **sink detection**, repurposing CodeQL as a sink *database* (rather than a scanner). Standard CodeQL queries are conservative: they only report sinks when taint flows from predefined sources, which misses sinks reachable through fuzzing harnesses. We bypass CodeQL's filtering logic and extract all sink call sites directly, then apply our own multi-stage filtering (constant-value removal, call graph reachability, LLM-based exploitability assessment) to bring thousands of candidates down to a manageable set (few hundreds).

Second, an **exploration agent** analyzes call paths from the program entry point to each sink, reads the source code along the path, and generates inputs designed to satisfy the constraints needed to reach it. Third, an [**exploitation agent**](/blog/post-crs-java-expkit) receives inputs that successfully reach sinks (we call these "beep seeds") and iteratively develops proof-of-concept exploits by reasoning about the vulnerability-specific conditions needed to trigger Jazzer's sanitizers.

Critically, these agents don't run in isolation. They operate concurrently with Jazzer and exchange artifacts in both directions: exploration seeds flow into the fuzzer's corpus for further mutation, while (fuzzer-)discovered beep seeds flow to the exploitation agent as concrete starting points. All exploitation outputs, even failed attempts, are fed back to the fuzzer, which may mutate a near-miss into a working exploit.

{{< image src="images/blog/sinkfuzz-glm/system-overview.png" position="center" class="img-fluid" >}}

*Figure 2: Gondar's architecture. LLM agents and the fuzzer run concurrently, exchanging artifacts bidirectionally. Exploration seeds enrich the fuzzer's corpus; discovered beep seeds ground the exploitation agent's reasoning.*

## Overall Results

Figure 3 shows vulnerabilities reached (x-axis) versus exploited (y-axis) across all 15 configurations: 7 Gondar model variants, 3 ablations, and 5 baselines. Upper-right is better.

<div class="narrow-fig">
{{< image src="images/blog/sinkfuzz-glm/tool-coords.png" position="center" class="img-fluid" >}}
</div>

*Figure 3: Vulnerabilities reached vs. exploited for all configurations. Gondar configurations (blue) cluster in the upper-right; baselines (gray) sit in the lower-left. Ablations (orange) show the impact of removing individual components.*

The headline: **Gondar exploits 41 of 54 vulnerabilities with its best configuration (Gemini-2.5-Pro), compared to Jazzer's 8**. That's over 5x as many on the same benchmark, at comparable or lower cost. Even the cheapest Gondar configuration (GPT-5-nano at <span>$</span>182 total) exploits 27 vulnerabilities, still over 3x the baseline.

The ablations tell a clear story too: removing the exploration agent (XO) drops reached vulnerabilities from 42 to 29; removing the exploitation agent (RO) drops exploited from 37 to 18. Both components are critical.

Our [paper](https://arxiv.org/abs/2604.01645) digs deeper into each stage: how sink filtering balances precision and recall, how iterative refinement drives exploitation success, and what happens when we compare against static analysis tools like CodeQL and SpotBugs. For example, Gondar exploits 35 of the 46 vulnerabilities that Jazzer misses entirely, by leveraging LLM reasoning to satisfy constraints that mutation alone cannot. But two takeaways stood out to us in particular.

## Takeaway 1: LLMs and Fuzzers Are Complementary, Not Interchangeable

It's tempting to think of LLMs as a replacement for fuzzers, or vice versa. Our results show the opposite: they have fundamentally different strengths, and the combination is greater than the sum of its parts.

LLMs excel at structure and intent. They can generate a well-formed ZIP archive containing a crafted payload, reason about path constraints from source code, or construct an XML document that satisfies a parser's type system. Fuzzers excel at fast mutation, exploring millions of input variations per second. Neither capability substitutes for the other.

The strongest evidence: **7 vulnerabilities** in our benchmark are **found *only* through the agent-fuzzer collaboration**. Neither the agents alone nor the fuzzer alone discovers them. Take a zip-slip vulnerability in Apache ZooKeeper: the exploitation agent understands the vulnerability pattern and generates archive inputs that are structurally close to a working exploit, but not quite right. Jazzer picks up these seeds and mutates them, eventually producing an input that triggers the sanitizer. The agent provides the semantic scaffolding; the fuzzer provides the last-mile refinement.

{{< finding >}}
7 vulnerabilities are discovered only through agent-fuzzer collaboration. Neither component finds them independently; the combination outperforms the sum of its parts.
{{< /finding >}}

## Takeaway 2: Open-Source Models Deliver Near-Flagship Performance

After validating Gondar's design with flagship models (GPT-5, Gemini-2.5-Pro, and Claude Sonnet 4.5, which exploit 37-41 vulnerabilities at ~<span>$</span>2,400-<span>$</span>3,100 total), we asked the natural follow-up: how much does the model actually matter?

We swapped in GLM-5, an open-source model, and the result surprised us. GLM-5 exploits 35 vulnerabilities at a total cost of just <span>$</span>392, or <span>$</span>11.21 per bug, compared to <span>$</span>66-<span>$</span>74 for flagship models. It achieves **85% of flagship performance at roughly 13-16% of the cost**.

Put differently: GLM-5 at <span>$</span>392 finds more vulnerabilities than large-scale fuzzing at <span>$</span>3,264, while costing less than one-ninth as much (Figure 4). The architecture amplifies the model. A well-designed system with a modest open-source model beats brute-force compute with no intelligence.

{{< finding >}}
GLM-5 (open-source) exploits 35 vulnerabilities at <span>$</span>392 total, more than large-scale fuzzing at <span>$</span>3,264, and 85% of flagship performance at 13-16% of the cost.
{{< /finding >}}

<style>.narrow-fig { margin: 0 auto; } @media (min-width: 768px) { .narrow-fig { max-width: 65%; } }</style>
<div class="narrow-fig">
{{< image src="images/blog/sinkfuzz-glm/cost-vs-bugs.png" position="center" class="img-fluid" >}}
</div>

*Figure 4: Cost versus vulnerabilities exploited across all configurations. GLM-5 sits in the sweet spot: near-flagship effectiveness at a fraction of the cost. Large-scale fuzzing (Baseline-LS) costs the most while finding the fewest vulnerabilities.*

## Closing Thoughts

These results come from our controlled benchmark, but Gondar has found real bugs too. During AIxCC, it discovered 3 zero-day vulnerabilities in real-world projects (Hertzbeat, Healthcare-Data-Harmonization, and PDFBox), all responsibly disclosed. It's now part of [OSS-CRS](https://github.com/ossf/oss-crs), an OpenSSF Sandbox Project for continuous open-source security protection, where it has already found another zero-day path traversal in a widely used Java database.

Turns out, you don't need flagship models or massive compute to get there. For the full methodology and evaluation details, see the [paper](https://arxiv.org/abs/2604.01645).

## References

- [Gondar paper](https://arxiv.org/abs/2604.01645) - Full paper with detailed methodology and evaluation
- [Jazzer](https://github.com/CodeIntelligenceTesting/jazzer) - Coverage-guided fuzzer for Java
- [CodeQL](https://codeql.github.com/) - Semantic code analysis engine
- [DARPA AIxCC](https://aicyberchallenge.com/) - AI Cyber Challenge competition
- [OSS-CRS](https://github.com/ossf/oss-crs) - Open-source Cyber Reasoning System platform
