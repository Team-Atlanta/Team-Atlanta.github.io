---
title: "Atlantis-C: A " # TODO
meta_title: ""
description: "Overview of Atlantis-C"
date: 2025-08-19T10:00:00Z
image: "/images/blog/crs-c/icon.png"
categories: ["Atlantis"]
author: "Gyejin Lee"
tags: ["c", "c++"]
draft: true
---

**Atlantis-C** is a vulnerability detection subsystem developed as a part of the [Atlantis CRS framework](https://team-atlanta.github.io/blog/post-atl-infra/), focusing on finding bugs in C/C++ programs.
Rather than limiting itself to the libFuzzer based toolset provided by the [AIxCC competition infrastructure](https://github.com/aixcc-finals/oss-fuzz-aixcc/),
it integrates multiple fuzzing engines (LibAFL, AFL++, libFuzzer, and other custom components).
**Atlantis-C** aimed to crank up its capability by adding independent modules
that can seamlessly orchestrate, synchronize, and enhance
multiple fuzzing instances running different fuzzing engines.

## Overview of **Atlantis-C**

{{< figure src="images/blog/crs-c/overview/overview.png" class="img-fluid text-center" width="80%" caption="Fig.1 Overview of Atlantis-C" >}}

**Atlantis-C** is consisted of multiple microservices that communicate via Kafka.
The microservices can be grouped into two modules, the controller and worker modules.
For each challenge project, one instance of the controller module and multiple instances of the worker module
are deployed across the Kubernetes nodes allocated to **Atlantis-C**.

### An Orchestra of Fuzzers

The controller manages multiple fuzzing tasks distributed among the workers using epoch-based scheduling.
Every 20 minutes, it redistributes workload based on performance and priorities.
A "fuzzing task" is a specific combination of a harness (the entry point to test)
and a fuzzer (LibAFL, AFL++, or libFuzzer).
For example, if a project has 5 harnesses and we use 3 different fuzzers, that creates 15 potential fuzzing tasks.
Since we typically have fewer nodes than tasks, intelligent scheduling becomes critical.

The system maintains a priority-weighted task queue, where high-priority tasks get scheduled more frequently.
This makes two interesting features possible:

1. **Atlantis-C** can ensure that computational resources flow to the more "promising" tasks.
These would be the tasks that are connected to the "hints"
(SARIF vulnerability reports or diffs provided in delta mode) provided during the competition.

2. It can selectively run the most performant fuzzer for each harness.
If LibAFL performs poorly on a certain harness, the system seamlessly falls back to AFL++, then to libFuzzer if needed.

### Seed Synchronization Across Space and Time

Seeds (test inputs that trigger interesting behaviors) need to flow efficiently between all-related components.
**Atlantis-C** implements a pipeline to ensure discoveries by any component benefits the entire system.

- *Seeds Collector* continuously monitors seed sources—fuzzers, directed fuzzers, custom format fuzzers. 
It relays these new seeds to *Ensembler*.
It also creates periodic snapshots of fuzzer progress,
allowing newly scheduled tasks to instantly inherit collective discoveries.

- *Crash Collector* is a similar component that only relays seeds that were reported to cause crashes.

- *Ensembler* maintains a master corpus using libFuzzer's merge capability.
It tests all incoming seeds, keeping only those that expand coverage.
Additionally, if any of the incoming seeds trigger a crash,
it will verify, deduplicate and submit the seed as a POV (Proof-of-Vulnerability).

Together, these components ensure seeds flow between fuzzers (spatial) and persist across runs (temporal),
creating collective progress beyond any individual fuzzer's reach.

### Fuzzers on LLM Steroids

**Atlantis-C** augments traditional fuzzing with three LLM-powered components.
All components can work along with any of the three types of fuzzers.

- *Corpus Selector* matches our 400+ project seed collection with specific targets.
The LLM analyzes each harness and selects relevant seed categories,
ensuring fuzzers start with high-quality inputs.

- *Deep Generator Agent* analyzes harnesses, reads the project source code and then generates Python scripts
that produce semantically valid test cases.
*Deep Generator Engine* will execute these scripts and feed the resulting seeds into the fuzzers with extremely high throughput.

- *LLM-Augmented Mutator* helps when fuzzers get stuck.
If a fuzzer fails to generate new seeds for two minutes, it kicks in to "unblock" the fuzzer.

This layer does not replace coverage-guided fuzzing—it accelerates it,
providing shortcuts through complex validation that could take millions of random attempts.

## Other Components in **Atlantis-C**

This blog post briefly introduces the core pipeline of **Atlantis-C**.
Each of the microservices shown in [Fig. 1](#overview-of-atlantis-c)
like the *Bullseye Directed Fuzzer*, *Deep Generator*, *Ensembler* have interesting stories behind them worth sharing.
We will try to cover these in future blog posts.

## How Did **Atlantis-C** Perform?

From the telemetry logs provided by the organizers,
**Atlantis-C** contributed by submitting 18 of the 84 submissions made for the C/C++ challenge projects;
the submissions include 16 unique discoveries.
More detailed analysis will be available once we are done with the post-mortem analysis.

## What's Next

- **More Blog Posts**: Exciting, insightful blog posts on the way.

- **Technical Report**: Complete implementation details, evaluation results, and more!

- **Post-Mortem Analysis**: In-depth analysis of how Atlantis dominated AIxCC.

- **Open Source Release**: Making key components available and usable(!) to anyone in the community.

## Join the Conversation

We're excited to share more about Atlantis and learn from the community's experiences.
Have questions or ideas? Want to collaborate?
Reach out to [us](https://www.linkedin.com/company/team-atlanta/) directly!

## Reference

- [Atlantis-C Code Repository](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-userspace)

- Technical Report (forthcoming)

---

*This post is the first of our series on Atlantis-C. More blog posts will follow.*
