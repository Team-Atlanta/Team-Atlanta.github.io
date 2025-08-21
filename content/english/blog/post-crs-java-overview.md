---
title: "Atlantis-Java: A Sink-Centered Approach to Java Vulnerability Detection"
meta_title: ""
description: "Overview of Atlantis-Java"
date: 2025-08-19T10:00:00Z
image: "/images/blog/crs-java/overview/icon.png"
categories: ["Atlantis"]
author: "Cen Zhang"
tags: ["java"]
draft: false
---

Atlantis-Java is a specialized bug-finding subsystem within the [Atlantis CRS framework](https://team-atlanta.github.io/blog/post-atl-infra/), specifically designed for Java CPV detection in the AIxCC competition.
It integrates fuzzing, program analysis, and LLM capabilities, with a particular focus on security-sensitive APIs (also known as sinks).

## Many Java Vulnerabilities Are Sink-Centered

{{< figure src="images/blog/crs-java/overview/motivation-example.png" class="img-fluid text-center" width="80%" caption="Fig.1 Example CPV from AIxCC Semifinal Jenkins CP">}}

This vulnerability contains a backdoor that enables OS command injection when specific conditions are met.
The `ProcessBuilder` constructor serves as a [sink API](https://github.com/github/codeql/blob/963e02864515b3f09fbd1c53e04ab0c4499c0351/java/ql/lib/ext/java.lang.model.yml#L15), where an attacker-controllable first argument can lead to arbitrary command execution.
The sinkpoint (line 20) refers to the location in the target CP where this sink API is called.

From a sink-centered perspective, the detection process can be decomposed into two phases:

**1. Sink exploration** (lines 3-8, 12-19). To reach the sink, the input must satisfy:
- The presence of an `x-evil-backdoor` key in the HTTP request header
- The header value matching `DigestUtils.sha256("breakin the law")`
- Non-empty command line arguments: `cmd != null && cmd.trim().isEmpty()`

**2. Sink exploitation** (lines 20-23). The input must satisfy:
- Triggering the [Jazzer detection oracle](https://github.com/aixcc-finals/jazzer-aixcc/blob/43791565a765b854b537d878c9cab757ff1f2140/sanitizers/src/main/java/com/code_intelligence/jazzer/sanitizers/OsCommandInjection.java#L62): `cmds[0]` should equal to the canary string `jazze`

This two-phase process effectively captures the detection pattern for various types of Java vulnerabilities.
Security issues typically arise from the unsafe usage of sensitive API calls (sinks), such as file operations, deserialization, network access, and template rendering.

In practice, each vulnerability type presents unique exploration and exploitation challenges that go beyond simply executing the sink and setting the canary value.
For example, the CPVs in the [Apache Tika CP](https://aicyberchallenge.com/asc-challenge-project-development/) require a nested zip file to reach a sinkpoint and also demand reasoning to bypass normalization guard conditions.

However, existing fuzzers, mostly inherited from C/C++ fuzzers, are coverage-centered and leverage only limited sink knowledge to enhance exploration and exploitation.

## Overview of Atlantis-Java

{{< figure src="images/blog/crs-java/overview/overview.png" class="img-fluid text-center" width="80%" caption="Fig.2 Overview of Atlantis-Java" >}}

Rather than replacing traditional fuzzing approaches, Atlantis-Java augments them with sink knowledge to achieve more effective Java vulnerability detection by integrating LLM capabilities with dynamic and static analysis techniques.

At its foundation, Atlantis-Java maintains an ensemble fuzzing pipeline that serves as the foundational infrastructure.
Built upon this pipeline, it performs sink analysis on the target CP and applies multiple techniques to enhance both sink exploration and exploitation.
These techniques generate inputs and dictionaries that strengthen the fuzzing pipeline while simultaneously retrieving dynamic information from fuzzers to refine the analysis process.

The following paragraphs list the framework level designs and facilities in Atlantis-Java.

### 1. Sink-Aware Fuzzing Loop

```python
while not timeout:
    seed = pick from corpus
    mutated = mutate(seed)
    execute(program, mutated)
    
    if new_coverage:
        add mutated to corpus
    if reaches_sinkpoint:
        collect as beep_seed
        try_exploitation(beep_seed)
    if has_crash:
        save_crash(mutated)
```

The fuzzing loop in Atlantis-Java operates in a sink-aware manner.
Every input that reaches a sinkpoint (referred to as "beep seeds") is collected and elevated to a dedicated exploitation phase.
All contextual information from beep seeds, such as stack traces and sink API details, is preserved and shared within Atlantis-Java for further exploitation.
This functionality is implemented through a [custom Java instrumentation pass](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-java/crs/fuzzers/atl-jazzer/src/main/java/com/code_intelligence/jazzer/instrumentor/CodeMarkerInstrumentor.kt) integrated into all our Jazzer instances.

### 2. Ensemble Fuzzing

The ensemble fuzzing infrastructure collects, deduplicates, and dispatches corpus data among all fuzzer instances, serving as both a corpus synchronization layer and a metadata propagation channel.
This ensures that all components benefit from collective discoveries.

- Corpus Synchronization: Collects and distributes corpus data among different fuzzer instances while performing deduplication based on coverage metrics
- Input Integration: Incorporates inputs from non-fuzzing components such as Path-Based PoV Generator, Concolic Executor, and ExpKit
- Metadata Propagation: Synchronizes sinkpoint dynamic information, including sinkpoint reach/exploit status, beep seeds and their contexts

### 3. Sink Management

Sinkpoints are first-class citizens in Atlantis-Java.
Their management encompasses identification, deduplication, filtering, metadata synchronization, and scheduling.

- Sinkpoint Identification:
Static analysis locates all calls to security-sensitive APIs.
Beyond Jazzer's built-in API list, we expanded detection by collecting APIs from vulnerability benchmarks, research papers, and competition tools.
Additionally, for diff code in delta mode, we identify code areas potentially causing infinite loops as custom sinkpoints.

- Task Transformation:
All competition tasks are converted into concrete sinkpoint targets:
  - Full Mode → All sinkpoints in the CP
  - Delta Mode → Sinkpoints contained in or reachable by code changes
  - SARIF Challenge → Sinkpoints specified in reports

- Metadata Management:
Sinkpoint information is collected and synchronized both within and across Atlantis-Java instances to prevent duplicate exploration/exploitation efforts and ensure proper prioritization.
This includes sinkpoint basics (API, potential vulnerability type, coordinates), runtime status tracking (unreached/reached/exploited/unexploitable), and associated beep seeds and crashes.

- Scheduling:
The scheduler prioritizes unreachable sinkpoints over reachable ones during the exploration phase to maximize coverage, while exploited sinkpoints are excluded from the exploitation phase to avoid redundant efforts.
Additionally, sinkpoints related to delta mode and SARIF challenges receive higher priority to align with competition objectives.

### 4. Distributed Design

Atlantis-Java incorporates lightweight distributed designs optimized for Kubernetes deployment and competition tasks.

- Full Mode:
Each CP harness operates on a dedicated Kubernetes node, working independently until timeout.
NFS and Redis services provide persistent caching infrastructure that enables progress recovery when components or the system restart.

- Diff Mode:
A one-time node rescheduling occurs either at timeout (set to 2 hours in the final competition) or upon completion of unified reachability analysis from all static analyzers.
This rescheduling allocates additional computing resources to diff-reachable harnesses.
Following rescheduling, Atlantis-Java synchronizes all cached sinkpoint metadata from Redis, avoiding redundant efforts.

### Components in Atlantis-Java 

The framework integrates multiple specialized tools for sinkpoint exploration and exploitation:

- Exploration-focused components
  - [Directed-Jazzer](https://team-atlanta.github.io/blog/post-crs-java-directed-jazzer/): Guides fuzzing toward potentially reachable sinkpoints
  - [LibAFL-Jazzer](https://team-atlanta.github.io/blog/post-crs-java-libafl-jazzer/): Leveraging libAFL mutators for more diverse input mutations
  - DeepGen: LLM-based input generation script generator
  - DictGen: LLM-based fuzzing dictionary generation

- Exploitation-focused components
  - ExpKit: LLM-based exploitation tool, start exploitation from beep seed

- Dual-purpose components:
  - Path-Based PoV Generator: LLM-based PoV generator towards sinkpoints
  - Concolic Executor: Graal VM based concolic executor

## How Does Atlantis-Java Perform?

While we don't have full log for post-mortem analysis, the recovered logs have recorded 107 deduplicated PoV submissions (122 in total, 15 submission logs were lost..) from Atlantis to organizers.
Among them, 23 submissions are of Java CPs and Atlantis-Java submitted 15 of them, which is a strong indicator for its effectiveness.

## What's Next

- Individual blog posts detailing each component
- Application to open-source projects
- Comprehensive technical report with in-depth analysis
- Extended post-mortem analysis as more data becomes available

## Reference

- [Atlantis-Java Code Repository](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java)
- Technical Report (forthcoming)
