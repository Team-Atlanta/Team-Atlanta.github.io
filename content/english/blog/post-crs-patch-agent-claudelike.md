---
title: "ClaudeLike: How to Apply a Tool-Based Agent to Patch Generation"
meta_title: ""
description: "Overview of ClaudeLike's development background and key features"
date: 2025-10-10T11:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Hyeon Heo"]
tags: ["patch", "AI agent"]
draft: false
---

Claude Code is an LLM agent specialized in general-purpose programming tasks and remains one of the most powerful LLM agents to date. Inspired by Claude Code's strategy, we developed ClaudeLike, an agent dedicated to patch generation. In this post, we introduce the motivation and key features behind the development of ClaudeLike.

## Motivation: Applying a SOTA LLM Agent to Patch Generation

### Why Did We Need to Develop a New Agent?

When Claude Code was released, we experimented to see whether it could generate patches effectively, as we had previously done with tools like Aider and SWE-Agent. We found that Claude Code performed reasonably well when provided with contextual information such as crash logs. However, we determined that directly integrating Claude Code into Crete would be difficult.

The main reason is that Claude Code's internals cannot be modified, which would limit our ability to add or customize tools in the future. Additionally, some of Claude Code's built-in tools—such as Bash or WebFetchTool—were unnecessary for our use case and could lead to unpredictable behavior.

### Core Strategy

Instead of integrating Claude Code directly into Crete, we decided to build a new agent that adopts its core strategies. Through an in-depth analysis of Claude Code, we found that two design aspects have a significant impact on its performance:

- A well-designed file editor tools that enables efficient analysis and modification of project structures and files.
- The use of a sub-agent to perform smaller, multi-step tasks, thereby reducing the context burden on the main agent.

With these two strategies as the foundation, we developed ClaudeLike.

## Implementation: File Editor Tools and AgentTool

ClaudeLike generates patches through the following three steps:

1. It constructs a prompt from the PoC and SARIF report, then passes it to the ClaudeLike coder.
1. The ClaudeLike coder locates and fixes the buggy code within the project, producing a patch diff.
1. The agent evaluates whether the generated patch diff is sound. If not, it provides feedback to the coder to regenerate a new patch.

The overall structure is similar to that of other simple patch-generating agents. The coder plays the role analogous to Claude Code, and its structure is as follows:

{{< figure src="images/blog/crs-patch/claudelike_coder_overview.png" class="img-fluid text-center" width="70%" caption="Fig.1 High-level overview of *Martian Agent*" >}}

The ClaudeLike coder's main agent is composed of file editor tools and an AgentTool. The main agent interacts with the project by invoking file editor tools and can also spawn a sub-agent to perform specific tasks.

### File Editor Tools: Enabling Agent–Project Interaction

ClaudeLike analyzes and modifies projects using six file editor tools inspired by Claude Code:

- **EditTool(file_path, old_string, new_string)**: Replaces the old_string from the file in file_path into new_string. The old_string must exist in the file and be uniquely matched in the file.
- **GlobTool(pattern, path)**: Returns the list of files in the path directory whose filenames match the glob pattern.
- **GrepTool(pattern, path, include)**: Returns the list of files in the path directory whose content match the given regex expression pattern. The result only includes files whose filenames match the glob pattern include.
- **LSTool(path)**: Returns the list of files in the path directory.
- **ReplaceTool(file_path, content)**: Replaces the content of file file_path into given content. If the file file_path does not exist, ReplaceTool creates it and sets the content of the file as content.
- **ViewTool(file_path, offset, limit)**: Returns the maximum limit lines of the file file_path starts from line number offset

Each tool's description explicitly defines when it should be used, its constraints, and the valid argument types. By referencing these descriptions, the agent can select and use the appropriate tools to accomplish its tasks effectively.

### AgentTool: Helping the Agent Stay Focused

To analyze a file's role or locate files related to specific functionality, the agent often needs to read multiple files or repeatedly traverse directories. Such operations are frequent in patch generation and result in numerous tool calls, which lengthen the context and may distract the agent from its primary objective—patching.

To address this, ClaudeLike adopts AgentTool, similar to Claude Code.
The main agent can invoke the AgentTool to delegate specific tasks to a sub-agent. Sub-agent operates independently of the main agent, makes its own tool calls, and returns results to the main agent.
This design allows the main agent to offload repetitive or verbose tasks (e.g., identifying file functionality or searching for files), thus keeping its context concise and focused on generating patches.

To prevent uncontrolled recursion, a sub-agent is not allowed to use AgentTool itself. Additionally, to avoid unintended code modifications, a sub-agent is restricted from using EditTool and ReplaceTool.

## Conclusion

In this post, we discussed ClaudeLike, an agent inspired by Claude Code's design principles.
Evaluation results show that ClaudeLike successfully generates sound patches for most cases in the Round 3 dataset. Furthermore, through repeated benchmarking, we observed that performance varied significantly depending on the clarity and specificity of tool descriptions and whether AgentTool was enabled.

These findings suggest that strategies used in general-purpose software engineering agents can also be effectively applied to security patch generation. In particular, providing well-defined tools with precise instructions and enabling the agent to maintain focus by reducing context size are proven to be effective strategies for tool-based agents performing patch generation.
