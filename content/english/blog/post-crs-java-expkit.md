---
title: "ExpKit: Solving the Last Mile Challenge in Java Vulnerability Detection"
meta_title: ""
description: "Overview of Atlantis-Java"
date: 2025-08-29T23:00:00Z
image: "/images/blog/crs-java/expkit/icon.png"
categories: ["Atlantis-Java"]
author: "Cen Zhang"
tags: ["java"]
draft: true
---

## Motivation: The Last Mile Challenge

We discovered something puzzling during our large-scale fuzzing experiments. After running 42 Java vulnerability benchmarks for 8 hours each with over 100 CPU cores, we noticed that many fuzzers were reaching vulnerable code locations but failing to trigger actual exploits.

The numbers told a clear story:

| Total CPVs | Not Reached | Reached Only | Exploited |
|------------|-------------|--------------|-----------|
| 42 (100%)  | 11 (26.2%)  | 16 (38.1%)  | 15 (35.7%)|

Nearly three-quarters of vulnerabilities had their sinkpoints reached, yet only about half of those resulted in successful exploits. This 38.1% gap represents what we call the "last mile" challenge - the fuzzer gets tantalizingly close but can't cross the finish line.

Digging deeper into these 16 reached-but-unexploited cases, we found four main culprits:

**Seed explosion distraction (4/16)**: Fuzzers generated thousands of inputs reaching sinkpoints, but got overwhelmed trying to mutate all of them. Like having too many leads in a detective case, they lost focus on the promising ones.

**Missing instrumentation (2/16)**: Some vulnerable APIs weren't hooked by standard value profile instrumentation, leaving fuzzers flying blind even after reaching the target.

**Value profile limitations (1/16)**: Complex sanitizers needed longer input sequences than value profile feedback could effectively guide.

**Complex exploitation logic (9/16)**: The most common issue. These vulnerabilities required sophisticated reasoning - generating XML payloads with specific structures, bypassing multiple validation checks, or crafting inputs that satisfied complex type constraints. Traditional mutation strategies simply couldn't handle this level of semantic complexity.

This gap motivated us to build ExpKit: if fuzzers can get us to the door, maybe LLMs can help us pick the lock.

## Key Design

ExpKit operates as an exploitation specialist that takes over when fuzzers reach sinkpoints. Its design centers on three core ideas:

**Smart scheduling of beep seeds**: When a fuzzer reaches a sinkpoint, it produces what we call a "beep seed" - an input that made it to the vulnerable code. ExpKit groups these by their execution context (the complete stack trace) and implements fair scheduling across different paths. This prevents the system from getting stuck on one particular execution pattern while ignoring others.

**Rich context collection**: For each beep seed, ExpKit gathers everything an exploitation expert would want to know:
- The complete source code of all files in the stack trace
- Detailed sinkpoint information: which API was called, what vulnerability type we're dealing with
- The exact input that reached this point (as a hexdump)
- The full execution state at the moment of reaching the sink

**LLM-guided exploitation**: This context gets transformed into a structured prompt that guides an LLM through the exploitation reasoning process. The LLM generates exploit candidates directly as binary blobs, which then undergo additional fuzzing without coverage feedback (we already reached the sink, after all). Both successful and failed attempts get shared across all fuzzer instances.

The beauty is in the simplicity: ExpKit doesn't try to be a general-purpose exploitation framework. It focuses solely on that last mile - turning near-misses into hits.

## Effectiveness

The results exceeded our expectations. Of the 16 reached-but-unexploited vulnerabilities, ExpKit successfully generated exploits for 13 (81.3% success rate). Even more impressive: 6 of these were solved with a single LLM query using OpenAI's o1-preview model.

The successful cases spanned diverse vulnerability types - command injection, path traversal, deserialization flaws - demonstrating ExpKit's generality. The system particularly excelled at vulnerabilities requiring specific input formats or simple constraint satisfaction.

The three failures taught us valuable lessons. These cases required:
- Multi-round reasoning with intermediate debugging
- Access to specialized tools like debuggers or symbolic execution engines
- Complex script generation rather than direct blob creation

These limitations point to ExpKit's future evolution. While the current single-query design proves highly effective for straightforward cases, we're working on transforming it into a full-featured exploitation agent with tool access, multi-round reasoning, and diverse generation strategies.

ExpKit demonstrates that the semantic gap between reaching and exploiting vulnerabilities isn't insurmountable. By combining fuzzing's ability to explore execution paths with LLMs' capacity for reasoning about code semantics, we can finally solve many of those frustrating last-mile cases that previously remained just out of reach.

## Future Work

## Reference

- [Expkit Scheduler Part](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-java/crs/javacrs_modules/expkit.py)
- [Expkit Tool Part](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/expkit)
