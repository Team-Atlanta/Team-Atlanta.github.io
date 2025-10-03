---
title: "Patch Team: Ensembling Multiple Agents for Efficient Automated Patching"
meta_title: ""
description: "A deep dive into the Patch Team's architecture: how multiple agents are orchestrated through a Main–Sub ensemble system, supported by a custom development framework and performance optimizations to automatically patch vulnerabilities."
date: 2025-10-05T11:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Wonyoung Kim", "Insu Yun"]
tags: ["patch", "ensemble", "multi-agent"]
draft: true
---

## Ensemble Patching with Multiple Agents

The Patch Team designed an **ensemble system** that leverages multiple agents simultaneously to patch vulnerabilities.  
Instead of relying on a single algorithm, the system distributes each vulnerability to several independently operating agents, each using a different strategy. The system only needs one of the agents to succeed, which allows it to maximize both accuracy and speed. 

## Why Ensemble Matters

Early in development, we experimented with building and testing multiple agents, aiming to find a single "winner" agent that could handle all scenarios. In practice, this turned out to be extremely difficult.
AIxCC involves a wide variety of bugs, and as we added more features to cover different cases, maintaining a single, all-powerful agent became increasingly impractical.

Prompt engineering limitations played a big role in this. Extending prompts to support more functionality made the context longer and heavier, which degraded model performance. Adding new logic to handle one case often caused previously working cases to fail, making prompt tuning increasingly fragile and time-consuming.

To address this, we chose to develop separate agents, each focused on different functionalities, rather than endlessly extending a single agent. This approach gave us better development flexibility and performance, while avoiding the complexity of maintaining one massive, brittle prompt.

One of the biggest advantages of this strategy is fault tolerance. If one agent behaves unexpectedly, it doesn’t bring down the entire system. Since the competition didn’t allow modifications after submission, this reliability was a major benefit in practice.

By combining multiple specialized agents under a common architecture, the ensemble approach gave us broader coverage, higher stability, and simpler development, without relying on a single point of failure.


## System Architecture: Main–Sub Structure for Parallel Ensemble Execution

From a **deployment perspective**, the Patch Team built a distributed architecture that coordinates multiple agents to work on the same vulnerability simultaneously.


```
              ┌────────┐
              │  Main  │
              └───┬────┘
         ┌────────┴──────────┐
         ▼                   ▼
  ┌────────────┐       ┌────────────┐
  │ Sub Node 1 │       │ Sub Node 2 │
  └──────┬─────┘       └─────┬──────┘
         ▼                   ▼
 Agent 1 → Agent 2    Agent 1 → Agent 2

``` 


- **Main Node**  
When a PoV is received, the Main Node distributes it to multiple Sub Nodes, each functioning as an independent execution unit that runs multiple agents. Once a patch is returned, the Main Node validates it to ensure it complies with policy and that the vulnerability is no longer triggerable.

- **Sub Node**  
For each vulnerability, the Sub Node **runs several agents sequentially**, each trying to produce a valid patch. Agents may use different algorithms or heuristics. Once any agent succeeds, its patch is immediately adopted, and execution for that vulnerability stops.

This architecture enables a **ensemble approach**: different agents attack the same problem from different angles, dramatically improving patch success rates and reducing turnaround time.


## Performance Optimization: Scaling the Ensemble

Running multiple agents concurrently requires careful system-level optimization to avoid redundant work and bottlenecks. We carefully considered both time constraints and LLM resource limits when deciding how to schedule agents on each Sub Node.

- **Build Caching**  
We optimized how builds and agent executions were scheduled to reduce overall turnaround time. Since multiple agents often work on the same target, intermediate build artifacts are cached and reused instead of rebuilding from scratch. In addition, we grouped long-running agents with faster ones, balancing execution time and resource usage across Sub Nodes to avoid unnecessary delays.

- **LLM Resource-Aware Scheduling**  
Sub Nodes schedule agent execution based on available LLM throughput (e.g., Tokens Per Minute, TPM). For example, with Anthropic models, running several agents simultaneously can easily hit TPM limits, leading to delays or failures. By being aware of these limits, the system avoids overloading the model and maintains stable throughput.

These optimizations are essential for transforming the ensemble structure from a concept into a performant, production-ready system.


## Development Framework: A Design Layer for Efficient Agent Development

While the system architecture handles deployment and orchestration, **agent development efficiency** was equally critical.  
To support fast, scalable agent development, the team built a **custom development framework** that abstracts away environmental complexity and focuses on agent logic.

The framework includes:

- **OSS-Fuzz Integration**  
A unified interface that wraps OSS-Fuzz, allowing agents to interact with it without needing to know its internal details. It provides simple APIs for applying patches, building the target, and checking whether the patch succeeds, making integration straightforward for each agent.

- **Repository Code Search**  
Tools to quickly search and navigate repository code, helping developers locate vulnerable areas and apply patches more effectively.

- **Prompt Context Extraction**
Utilities for automatically extracting relevant information to be included in prompts. This includes collecting crash logs, debugging traces, and commit history, among other data sources. By standardizing how this information is gathered and formatted, agents can focus on reasoning and patch generation rather than data wrangling.

This development-focused design enabled contributors to **concentrate on agent strategies**, not boilerplate setup or tooling. As a result, diverse agents could be implemented rapidly, each targeting different vulnerability patterns or patching techniques.

## Conclusion

The Patch Team combined multiple specialized agents within a Main–Sub ensemble architecture, supported by a custom development framework and performance optimizations. This approach proved to be highly effective.

In the ensemble approach, multiple valid patches may be generated for the same vulnerability, which raises the question of how to select the best one. We experimented with a few simple strategies for selecting among them, but their impact was limited. This remains an interesting area for future exploration.

In upcoming posts, we’ll dive deeper into individual agents—how each was designed, what types of vulnerabilities they target, and how they complement each other within the ensemble.