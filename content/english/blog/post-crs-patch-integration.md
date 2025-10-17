---
title: "Ensembles of Agents for Robust and Effective Automated Patching"
meta_title: ""
description: "Overview of Atlantis-Patching"
date: 2025-10-05T11:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Wonyoung Kim", "Insu Yun"]
tags: ["patch", "ensemble", "multi-agent"]
draft: false
---

## Why Ensemble for Patching?
In the AIxCC competition, finding vulnerabilities is only half the battle. Once a vulnerability is discovered, it must be patched to prevent exploitation. This is where the Atlantis-Patching system comes into play. As the AIxCC's ultimate mission is to make software secure, it awards more points for patching vulnerabilities than for finding them. In particular, the competition rewards **6 points** for patching a vulnerability, compared to just 2 points for discovering it. As a result, to win the competition, it is crucial to have a robust and efficient patching system that can quickly generate effective patches for discovered vulnerabilities. 

### Early Challenges with a Single Agent
In the early stages of development, we attempted to create a single all-encompassing agent that could handle all types of vulnerabilities. However, this approach proved to be impractical due to the diverse nature of vulnerabilities and the unpredictable behavior of LLMs. As AIxCC involves a wide variety of bugs and projects, we found that it is nearly impossible to create a one-size-fits-all solution to effectively address all scenarios. Our agent becomes too complex and brittle as we try to cover more cases, leading to maintenance difficulties and performance degradation. We could make one agent that works well for one type of vulnerability, but it often failed to generalize to others. 

### Our Solution: Ensemble of Specialized Agents
To address this, we adopted an ensemble approach, where multiple specialized agents work together to tackle the patching task. Each agent is designed to focus on a specific type of vulnerability or employ a particular patching strategy. This modular approach allows us to develop and maintain each agent independently, making it easier to adapt and improve them over time. 

Ensembling can be effective in patching thanks to its partial verifiability. Even though we cannot fully verify a patch's correctness, we can check its plausibility; that is, whether it compiles, passes tests, and successfully patches the vulnerability that it aims to fix. This property helps generate patches with consistent quality and allows direct evaluation of their validity. This is particularly helpful in patching, where we cannot use techniques like majority voting to combine outputs from multiple agents, as they can produce syntactically different yet semantically equivalent patches.

One of the biggest advantages of this strategy is **fault tolerance**. If one agent behaves unexpectedly, it doesn’t bring down the entire system. Since the competition does not allow any intervention after submission, this design helps to ensure that we can still generate patches even if one agent fails.

## System Architecture: Main–Sub Structure for Parallel Ensemble Execution

For ensemble patching, we built a distributed architecture that coordinates multiple agents to work on the same vulnerability simultaneously. The architecture consists of a **Main Node** and four **Sub Nodes**, as illustrated below:


```
                        ┌────────┐
                        │  Main  │
                        └───┬────┘
        ┌───────────────────+─────────────────────┐
        ▼                   ▼                     ▼
  ┌────────────┐       ┌────────────┐       ┌────────────┐
  │ Sub Node 1 │       │ Sub Node 2 │       │    ...     │
  └──────┬─────┘       └─────┬──────┘       └────────────┘
         ▼                   ▼
   Agent 1 → Agent 2    Agent 1 → Agent 2


``` 
The Main Node serves as the central controller of the system. When PoV is received, it distributes the task **in parallel** to multiple Sub Nodes, each operating as an independent execution unit that runs several agents simultaneously. Once a patch is returned, the Main Node validates it to ensure that it complies with policy requirements and that the vulnerability can no longer be triggered.

Each Sub Node, in contrast, processes its assigned vulnerability **sequentially**. It runs multiple agents one after another, with each agent attempting to generate a valid patch using different algorithms or heuristics. As soon as any agent successfully produces a working patch, that patch is immediately adopted, and the Sub Node stops further execution for that specific vulnerability.

### How to Choose and Order Agents for Each Sub Node?

In the AIxCC final round, we built an ensemble of ten instances using eight agents — two open-source and six internally developed ones. Among these agents, we use two instances of `multi_retrieval` (based on `claude 3.7` and `o4-mini`) and two instances of `aider` (based on `gemini 2.5 pro` and `gpt-4o`). The full configuration details can be found in [configs.json](https://github.com/Team-Atlanta/crete/blob/main/packages/crs_patch/configs.json).

It is also important to decide how to order agents within each Sub Node. Through our empirical testing, we order them based on three creteria:

- **LLM resource:** We placed agents that use LLMs from the same provider (e.g., Anthropic) in the same Sub Node to minimize the risk of hitting rate limits or throughput constraints. In particular, we experienced that with Anthropic models, running several agents simultaneously can easily hit TPM limits, leading to delays or failures. By being aware of these limits, the system avoids overloading the model and maintains stable throughput.

- **High-Performance Agents First**: We also attempted to place agents that have historically performed well in our internal benchmark. In the AIxCC final round, we can get a higher score if we can generate a valid patch quickly. So, it is reasonable to prioritize agents that are more likely to produce a valid patch early in the sequence. Moreover, one of the biggest risks is producing plausible but incorrect patches. During our internal testing, we observed that some agents occasionally produced incorrect patches even though they are classified as plausible. Thus, we placed agents that are less likely to produce such patches earlier to minimize these risks.

- **Execution time:** We arranged agents based on their expected execution time, placing fast agents with slow ones to balance the overall execution time of each Sub Node. This helps to minimize the total time taken for patching, making the system more efficient.

### Deduplicate PoVs and Patches
In patching, we need two types of deduplication: **PoV deduplication** and **patch deduplication**.
First of all, we need to deduplicate PoVs for efficient resource usage. If we process the same PoV multiple times, it wastes computational resources and time that could be better spent on unique vulnerabilities. Even though AIxCC organizers attempt to filter out duplicate PoVs, we still observed many duplicates. This is understandable as PoV deduplication is inherently challenging. For that, we implemented a simple patch-based deduplication mechanism. When a PoV is received, we check if previously submitted patches have already addressed the same vulnerability. If then, we skip that PoV to avoid redundant work.

Second, we also need to deduplicate patches. In the ensemble approach, multiple agents may generate the (semantically) same patch for a given vulnerability. To avoid submitting duplicate patches, we implemented a patch deduplication mechanism. When a patch is generated, we check whether another patch has already been submitted for that vulnerability. If it has, we discard the duplicate patch and only keep unique ones. 

### Mitigate Plausible but Incorrect Patches
One of the biggest challenges in automated patching is dealing with **plausible but incorrect patches**. This is particularly problematic in the AIxCC competition, where submitting an incorrect patch can lead to penalties. To mitigate this risk, we use the following strategies:

- **Prompt Engineering**: We carefully designed prompts to encourage agents to generate accurate and reliable patches. This includes providing clear instructions, examples of correct patches, and emphasizing the importance of correctness over plausibility. We also included specific guidelines about common pitfalls. In the following, we provide an example prompt used in the `multi_retrieval` agent:

```python
# packages/crete/framework/agent/services/multi_retrieval/nodes/patchers/system_guided_patcher.py
...
        ## Important Notes for Patching
        - Try to provide all the patches needed to patch from the initial codebase.
        - The harness code is not the root cause and it serves as an entry point for the fuzzer to test the codebase.
        - The fuzzing can be done by some APIs which are not the root cause of the issue. It is just a way to trigger the issue in the codebase.
        - Do NOT fix fuzzing logic or harness code related files, functions, definitions, macros, or flags to bypass the issue. (Usually include words like "fuzz", "harness", "test", etc.)
        - If additional issue is reported only in the harness code, this means that the last patch attempt did not resolve the issue correctly.
        - Modifying the fuzzing logic or harness code is strictly prohibited. They are the tests to be passed by fixing the codebase.
        - Do NOT modify or fix any test codes. The patched code must not break the existing tests and functionalities.
        - Do not remove a functionality to bypass the issue. Removal only patch is only allowed for mallicious code.
        - Do NOT modify error handling code to catch too broad exceptions.
        """
```

- **Re-validation**: After a patch is generated, we also re-validate it in the Main Node to ensure that it effectively resolves the vulnerability. Unlike the prompt engineering approach, this validation step is more reliable as it uses systematic testing to confirm the patch's validity. In particular, we checked whether patches can be successfully applied and whether the vulnerability can still be triggered after applying the patch. Unlike the agen's validation, which uses diverse optimizations to quickly validate patches, [the Main Node's validation](https://github.com/Team-Atlanta/crete/blob/main/packages/crs_patch/services/patch_checker.py) is more conservative. That is, we used scripts provided by the AIxCC organizers and just run them without any modifications. By doing so, we can mitigate the risk of making mistakes during maintaining multiple agents and ensure that only correct patches are submitted.

## Crete, the Patching Island

If we attempt to maximize the effectiveness of our ensemble approach, we need to build diverse agents that can complement each other. This requires a development framework that allows us to rapidly prototype and test new agents. To this end, we built **Crete**, a custom development framework for efficient agent development. Crete provides a set of tools and abstractions that simplify the process of building, testing, and deploying agents. This makes contributors focus only on the core logic of their agents, rather than dealing with boilerplate code or infrastructure.

These are some of the key features that Crete offers:

- **OSS-Fuzz Integration:** Crete supports a unified interface that wraps OSS-Fuzz, allowing agents to interact with it without needing to know its internal details. It provides simple APIs for applying patches, building the target, and checking whether the patch succeeds, making integration straightforward for each agent.

- **Repository Code Search:** Crete also includes built-in code search capabilities. As patching often requires understanding the context of the codebase, Crete provides tools to quickly search and navigate repository code, helping developers locate vulnerable areas and apply patches more effectively.

- **Context Extraction:** Crete also offers utilities for automatically extracting relevant information to be included in prompts. This includes collecting crash logs, debugging traces, and commit history, among other data sources. By standardizing how this information is gathered and formatted, agents can focus on reasoning and patch generation rather than data wrangling.

- **Optimizations:** Crete incorporates several optimizations to enhance performance. For instance, it caches build artifacts to avoid redundant compilations, which can be time-consuming. It also provides caching mechanisms for frequently accessed data (e.g., crash logs) to reduce latency. These optimizations help to speed up the patching process, allowing agents to iterate more quickly and efficiently.

## Conclusion
In this blog post, we discussed the challenges of automated patching in the AIxCC competition and how we addressed them using an ensemble of specialized agents. By adopting this approach, we were able to build a robust and effective patching system that can handle a wide variety of vulnerabilities. 

In upcoming posts, we’ll dive deeper into individual agents---how each was designed, what types of vulnerabilities they target, and how they complement each other within the ensemble. Stay tuned for more insights into our patching strategies and techniques!
