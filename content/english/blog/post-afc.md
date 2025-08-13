---
title: "AIxCC Final and Team Atlanta"
meta_title: ""
description: "Atlantis in CTF competitions"
date: 2025-08-12T12:15:00Z
image: "/images/blog/afc/afc-team.jpeg"
categories: ["Milestone"]
author: "Taesoo Kim"
tags: ["ASC"]
draft: false
---

Two years after its first announcement at [DEF CON 31](https://aicyberchallenge.com/), 
our team stood on stage as the winners of the AIxCC Final—a moment we had been working toward 
since the competition began.

Yet when we heard we placed 1st, relief overshadowed excitement. 
Why? While competing head-to-head with world-class teams like [Theori](https://theori.io/blog/aixcc-and-roboduck-63447) 
was a privilege, the real-time, long-running nature of this competition 
demanded extreme engineering reliability alongside novel approaches to succeed.

Balancing innovation with stability under time pressure 
proved our greatest challenge. 
We simply hoped our Cyber Reasoning System (CRS) would run as intended—
but it exceeded expectations, outperforming other teams 
in most categories by significant margins.

In this post, I'll answer the most common questions we received from the DEF CON audience 
and share the story behind our victory.

{{< image src="images/blog/afc/announcement.jpg" width="1000" position="center" class="img-fluid" >}}

<div style="display: flex; justify-content: center; gap: 10px;">
<iframe width="1000" height="562" src="https://www.youtube.com/embed/21Zrj632Y1I?si=D4tQ1bvsnbNRD7Zm" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

Why were we so anxious despite our confidence?
In this competition, a single bug can be fatal.
One line of code nearly destroyed our chances.

We discovered this critical bug, which almost ended everything,
during integration testing—
just hours after submitting our final version,
and mere hours before the deadline.
The problematic code was designed to **skip** patch generation 
for fuzzing harnesses.
In all previous challenge projects and our benchmarks,
fuzzing harness source files contained "fuzz" in their paths
(e.g., "fuzz/" or "http_request_fuzzer.cc" in nginx)—
a simple but effective heuristic to avoid false positives.

The problem? During our final integration test,
we discovered the organizers had prefixed all OSS-Fuzz projects
with "ossfuzz" (e.g., "r3-ossfuzz-sqlite3").
The irony wasn't lost on us—here we were,
building an *autonomous* CRS powered by state-of-the-art AI,
nearly defeated by a string matching bug.

{{< image src="images/blog/afc/patch-crs-bug.png" width="1000" position="center" class="img-fluid" >}}

## L0. System Robustness is Priority #1

As our near-miss demonstrated, a single bug can kill a CRS entirely. 
The system is that brittle.
So how did we balance engineering for robustness 
with novel research needed to win?

Our answer: **N-version programming with orthogonal approaches**.

Atlantis isn't a single CRS—it's a group of *multiple* independent CRSs,
each designed by specialized teams (C, Java, Multilang, Patch, and SARIF).
These teams deliberately pursued orthogonal strategies
to maximize both coverage and fault tolerance.

For bug finding alone, we deployed three distinct CRSs:
- **Atlantis-Multilang**: Built for robustness and language-agnostic bug finding
- **Atlantis-C**: Optimized specifically for C/C++ vulnerabilities
- **Atlantis-Java**: Tailored for Java-specific bug patterns

{{< image src="images/blog/afc/design-overview.png" width="1000" position="center" class="img-fluid" 
    caption="Design Overview of Atlantis (stay tuned for our Technical Report)." >}}

These CRSs deliberately made orthogonal approaches;
Atlantis-Multilang took conservative paths (no instrumentation)
while Atlantis-C took risky approaches 
requiring heavy build-time instrumentation:

1. **Atlantis-C CRS**:
  - ↑ instrumentation: libafl-based, instrument-based directed fuzzer
  - ↓ LLM usage: seed generation, input mutation
  - Time-based resource allocation

2. **Atlantis-Multilang CRS**:
  - ↓ instrumentation: libfuzzer-based, simple seed-based directed fuzzer
  - ↑ LLM: seed/blob generation, input format reverser, callgraph, dictgen, etc
  - Space-based resource allocation

By maintaining minimal sharing between CRSs and intentionally making 
orthogonal design decisions, we ensured that a failure in one component
wouldn't cascade through the entire system.
When one approach failed, others continued operating—
true fault tolerance through diversity.

## L1. Don't Give Up on Traditional Program Analysis

Unlike DARPA's Cyber Grand Challenge, 
where CRSs dealt with an artificial architecture limited to 7 system calls,
AIxCC evaluates CRSs against real-world, complex open source software—
the foundation of today's cyber infrastructure.

This shift changes everything.
Traditional program analysis tools that can't scale 
to handle real-world complexity would doom any CRS.

We initially hoped to stand on the shoulders of giants,
evaluating most commodity solutions to save development time.
Unfortunately, even state-of-the-art tools like
[SWAT](https://github.com/SWAT-project/SWAT) and [SymCC](https://github.com/eurecom-s3/symcc)
weren't ready for large-scale software analysis.
Each required substantial engineering to become competition-ready.

Ultimately, we invested heavily in extending traditional tools.
For both C and Java, we developed three categories:

- **Ensemble fuzzers**: LibAFL for [Java](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/fuzzers/jazzer-libafl)/[C](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-userspace/microservices/prebuilt-binaries/LibAFL), libFuzzer, [AFL++](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-userspace/microservices/prebuilt-binaries/AFLplusplus), [custom Jazzer](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/jazzer-llm-augmented), [custom format fuzzers](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-userspace/microservices/custom_fuzzer)
- **Concolic executors**: [Extended SymCC for C](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/uniafl/src/concolic), [custom implementation for Java](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/concolic)
- **Directed fuzzers**: Custom implementations for [C](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-userspace/microservices/directed_fuzzing) and [Java](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/fuzzers/atl-jazzer)

Each tool required non-trivial engineering efforts to be effective.
The lesson: AI alone isn't enough—traditional program analysis remains essential,
but it must be extensively adapted for real-world scale.

## L2. Ensembling to Promote Diversity

Ensembling in fuzzing outperforms a single fuzzing campaign
with the same amount of computing resource,
as shown in [autofz](https://www.usenix.org/conference/usenixsecurity23/presentation/fu-yu-fu).
In Atlantis,
we adopt the design principle of "ensembling" everywhere:
coverage-guided fuzzers, directed fuzzers, concolic executors, and even patching agents.
In particular,
patching, a process of generating code that fixes a given proof-of-vulnerability (PoV), 
takes advantages of the diversity of LLMs -- 
a.k.a., hallucination in the ML community,
non-determinism in systems community,
or "creativity" in other contexts.
Atlantis is designed to fully utilize 
such non-deterministic characteristics of LLMs
by ensembling multiple agents 
taking orthogonal approaches.
This ensembling works effectively
only when ***oracles*** exist as a judge.
For example, in fuzzing, 
segmentation faults 
such as invalid access to unmapped memory region
can be raised effectively 
with negligible performance overheads 
thanks to page tables enforced by the hardware.
More effectively, SW-based sanitizers
such as address (ASAN), undefined behavior (UBSAN), memory leaks (MSAN), etc
have been playing essential roles 
in regonizing erroneous conditions
way before segmentation fault like symptom appears.
In patching,
PoV plays as an oracle
telling the suggseted patch is likely correct
by simply reruning PoV with the patched program.
It is said "likely" because
there exists a chance to prevent PoV via *mitigation*
or via functionally unintended
(i.e., developers think it is not deseriable 
as Atlantis can fully recognize that developers want or its specification).
For example, 
simply recompiling C projects with recent MTE or PAX enabled on AArch8 
can suppress such PoV 
or simply wrapping around a main entrance code of Java with a `catch` statement 
with `Exception`.
These are undesirable patches in our competition, of course, 
so cautiously avoided by our patching agents.
However, functional or semantic correctness 
can be very subjective. 
Accordingly, in AIxCC, `test.sh` is optionally provided in each CP,
serving as an oracle to the patching agents.

{{< image src="images/blog/afc/overview-patching.png" width="1000" position="center" class="img-fluid" 
    caption="Design of Patching Agents." >}}

During preperation, 
our team recognized that 
it is hard to build a universally powerful agents
but it is feasible to build a single agent 
to tackle a simple task well, 
similar in concept to [AlphaEvolve](https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) or [AlphaCode](https://alphacode.deepmind.com/).
One interesting observation we made, 
a similar model like `o4-mini` outperforms other bigger foundational or even reasoning models.
Our speculation is that 
8 billion parameters of `o4-mini` 
abstracts the coding task nicely 
with the amount of source code data 
used during training?

In our patching CRS, we could not scale the number of agents and approaches 
unlike AlphaCode,
as its oracle -- building and validating PoV -- is too slow 
in a large scale software (e.g., 10 min in nginx).
Accordingly,
Atlantis-Patching 
limits the number of agents to six
and aims also to create a high quality code fixes 
given PoV.
Another team, [Theori](https://theori.io/blog/aixcc-and-roboduck-63447), 
on the other hand,
took a purely static approach:
producing three correct patches ***without** PoVs!
This well shows hidden potential of LLMs 
in understanding the semantics of the code
without causing too high false positives.
In the scoringboard (see below),
you can see how Theori's accuracy score (44.4%)
got impacted by Accuracy Modifier (AM), which is decreased to $1 - (1 - 0.4444)^4 = 0.9044$
vs. our AM is near perfect, $1 - (1 - 0.9127)^4 = 0.9999$.

In fact, our patching CRS can produce patching and validate it without PoV.
However, this was purely decided
as part of our game plan. 
We discussed this design decision nuermously
and simulated the situation with our [internal benchmark](https://github.com/Team-Atlanta/aixcc-afc-benchmark).
As the competition ends,
we will also explore the feasibility of generating patches without PoV!

{{< image src="images/blog/afc/ensemble-table.png" width="1000" position="center" class="img-fluid" >}}

## L3. LLM 101. How to Babysiting Jack Jack?

{{< image src="images/blog/afc/llm-babysitting.png" width="1000" position="center" class="img-fluid" >}}

## L4. LLM-Augmented, LLM-Opinionated, and LLM-Driven

## How Did Atlantis Perform?

{{< image src="images/blog/afc/scoreboard.png" width="1000" position="center" class="img-fluid" >}}

{{< image src="images/blog/afc/0day.jpg" width="1000" position="center" class="img-fluid" >}}

## What's Next?

Our interview at [CTFRadio](https://ctfradi.ooo/2025/07/22/01D-team-atlantas-aixcc-final-submission.html)
summarized many of our lessons pretty in depth.

<div style="display: flex; justify-content: center; gap: 10px;">
<iframe width="1000" height="562" src="https://www.youtube.com/embed/w-HZtwUXByg?si=a6xtZvCwfh4bw_vZ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

- open source
   - local version
   - enabling human in-the-loop
   - runing against open source projects
- technical report
- series of blog postings
