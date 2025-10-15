---
title: "Every Agent Has a Story: The Patch Way (1)"
meta_title: ""
description: "Description of patch agents"
date: 2025-10-15T00:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Insu Yun"]
tags: ["patch"]
draft: true
---

As we mentioned in our previous blog post, we enhanced the patching capabilities of Atlantis by ensembling multiple patch agents. In this series of blog posts, we will introduce each of our patch agents in detail and explain the rationale behind their designs. 

## Diversity for Good
To maximize the effectiveness of ensembling, it is crucial to have diverse agents. If all agents are similar, the ensemble will not perform significantly better than any individual agent. Therefore, we intentionally designed our patch agents to be diverse in their approaches, methodologies, and also models used. We newly developed six patch agents, each with its own unique architecture and motivation, as summarized in the table below.
```
+---------------+----------------+----------------------------------------------+------------------------------+
| Agent         | Architecture   | Motivation                                   | Used Models                  |
+---------------+----------------+----------------------------------------------+------------------------------+
| Martian       | Workflow       | Simple workflow yet complex tools            | o4-mini, claude-4-sonnet     |
| MultiRetrieval| Agent          | Iterative retrieval and patching             | claude-3.7-sonnet, o4-mini   |
| Prism         | Multi-agent    | Multi-agent system for long-context handling | o4-mini                      |
| Vincent       | Workflow       | Property-based approach for guided patching  | gemini-2.5-pro               |
| Claudelike    | Agent          | Patch generation inspired by Claude code     | claude-3.7-sonnet            |
| Eraser        | Workflow       | Use of custom model for specialized tasks    | Custom model                 |
+---------------+----------------+----------------------------------------------+------------------------------+

```

## Martian: Into the Unknown, Armed with Sophisticated Tools
We first introduce Martian, a patch agent that employs a straightforward workflow but leverages sophisticated tools. The name "Martian" reflects its approach of exploring the unknown, much like a Martian would, by utilizing advanced tools to navigate and understand unfamiliar terrain. 

### Simple Workflow
Martian's workflow is a bit straightforward. It consists of two main steps: fault localization and patch generation. The fault localization step identifies the root cause of the bug, while the patch generation step creates a patch to fix the identified issue. It also incorporates a feedback loop, allowing the agent to refine its understanding and improve the patch iteratively.

```
Bug Report  -->  [ Fault Localization ]  -->  [ Patch Generation ]  -->  Patch
                  ^                                                   |
                  |___________________________________________________|
                                   Feedback
```

- TODO:  What information will be delievered to each step?
- TODO:  What is the feedback?


### Sophisticated Tools
Martian becomes unique as it employs more sophisticated tools than other agents. In particular, we attempt to simulate how human developers debug and patch software. For that, we also provide Martian with various tools that human developers typically use during debugging and patching. In particular, we adopt LSP (Language Server Protocol) and ...

- TODO: Add more details about LSP
- TODO: Add more details about other tools