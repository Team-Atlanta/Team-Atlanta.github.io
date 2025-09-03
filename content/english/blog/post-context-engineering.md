---
title: "Context Engineering: How BGA Teaches LLMs to Write Exploits"
meta_title: ""
description: "Deep dive into the context engineering techniques that make BGA's AI agents effective at vulnerability exploitation - from XML structuring to coverage feedback loops"
date: 2025-09-02T10:00:00Z
image: "/images/blog/mlla/context_engineering.png"
categories: ["Atlantis-Multilang"]
author: "Dongkwan Kim"
tags: ["mlla", "llm", "exploit-generation", "context-engineering", "prompt-engineering", "coverage-feedback", "bga"]
draft: false
---

## The Problem with Teaching AI to Hack

Teaching an LLM to write working exploits is surprisingly tricky. Unlike most AI tasks where "close enough" gets you there, vulnerability exploitation is an all-or-nothing game. You can't approximate your way to success.

Take this Java reflective call injection vulnerability:

```java
String className = request.getParameter("class");
Class.forName(className); // BUG: arbitrary class loading
```

Looks straightforward, right? But here's the catch: to exploit this vulnerability, the LLM must load the exact class name [`"jaz.Zer"`](https://github.com/CodeIntelligenceTesting/jazzer/blob/527fe858f700382f9207cf7c7bc6b95cf59de936/sanitizers/src/main/java/com/code_intelligence/jazzer/sanitizers/Utils.kt#L25) to trigger [Jazzer](https://github.com/CodeIntelligenceTesting/jazzer)'s detection. Not `"jaz.Zero"`, not `"java.Zer"`, not `"jaz.zer"`. One wrong character and the whole exploit fails.

This precision challenge led us to develop what we call **context engineering** – a way to structure information that transforms LLMs from educated guessers into reliable exploit generators. These techniques became the backbone of our [BGA framework](https://team-atlanta.github.io/blog/post-mlla-bga/) and delivered [impressive results](#proof-of-impact) during the AIxCC competition.

**Here's what we learned**: LLMs don't need smarter algorithms – they need smarter information delivery. This post shows you exactly how we cracked this puzzle, with real examples from our work.

## Four Foundational Principles

After studying prompt engineering research ([OpenAI](https://platform.openai.com/docs/guides/prompt-engineering), [Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)), we had a realization: talking to LLMs effectively is a lot like explaining complex topics to humans. What makes sense to a human usually makes sense to an LLM too.

Think about it – when you're overwhelmed with information, you lose focus. LLMs do the same thing. That's why we design focused prompts that clearly establish what needs to be done.

This human-centered approach led us to four core principles that guide everything we do:

### 1. Top-Down Guidance
**Give the big picture first, then zoom in.** Just like explaining a complex topic to a colleague, you start with the overall goal before diving into specifics. We always begin with role definition, then expertise areas, then objectives, and finally the detailed steps.

### 2. Structure & Clarity  
**Organize information logically and eliminate ambiguity.** We use hierarchical XML structures, clear section boundaries, and explicit relationships between concepts. In vulnerability exploitation, vague instructions lead to failed exploits.

### 3. Concise Yet Comprehensive
**Include everything needed, but cut the fluff.** Every piece of information should serve a purpose. We provide complete vulnerability context while filtering out irrelevant details that might confuse the LLM.

### 4. Avoid Overcomplication
**Simple and clear beats clever and complex.** If we can't easily explain how something works, it's probably too complicated for consistent LLM performance. We stick to patterns that work reliably.

These principles treat LLMs as intelligent partners that need well-structured information, not magic boxes that somehow "just know" what to do. As you'll see in our [results](#proof-of-impact), this approach made a huge difference.

## Four Core Techniques

Building our LLM-based security tools taught us something important: basic prompting doesn't cut it for complex vulnerability exploitation. LLMs need a systematic way to understand vulnerabilities, parse complicated code relationships, and generate precise exploits.

Our context engineering approach solves this through four key techniques that delivered [solid improvements](#proof-of-impact) across different vulnerability types:

1. **XML-Structured Context Design** – Hierarchical organization for reliable LLM parsing
2. **Source Code Annotation Systems** – Precision markers that focus attention on critical code  
3. **Coverage-Driven Iterative Refinement** – Execution feedback loops that eliminate guesswork
4. **Domain Knowledge Integration** – Selective injection of vulnerability-specific expertise

### How They Work Together

These techniques work as a team, with each one strengthening the others:

- **XML structures** provide the foundation - a reliable way to organize complex vulnerability information that LLMs can consistently parse, following our "big picture first" approach

- **Annotation systems** add precision through markers like `@VISITED`, `@BUG_HERE`, and `@KEY_CONDITION`, helping LLMs focus on what actually matters in massive codebases

- **Coverage feedback** turns guesswork into systematic problem-solving by showing the LLM exactly what conditions it has reached and what still needs to be satisfied

- **Domain knowledge** fills in the gaps - providing vulnerability patterns, data structure handling, and exploitation techniques that generic LLMs don't naturally know

Put it all together, and you get LLMs that can reliably generate working exploits instead of just making educated guesses. Let's dive into how each technique works.

## Technique 1: XML-Structured Context Design
*Implements: Structure & Clarity*

### Why XML Works for Technical Context

Our approach employs XML organization to implement our **Structure & Clarity** principle, emphasizing hierarchical structure, context-before-complexity, annotation clarity, and clear organization. This approach aligns with [Anthropic's recommendations for using XML with Claude](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags), which highlights XML's advantages: **Clarity**, **Accuracy**, **Flexibility**, and **Parseability**.

XML excels at representing data hierarchy and relationships. The verbose tags provide unambiguous boundaries and semantic sections that help LLMs understand not just the data, but its purpose and nested structure:

```xml
<SOURCE_CODE_INFO>
  <FUNCTION_CALL_FLOW>
    - fuzzerTestOneInput
      - GzipCompressorInputStream.<init>
        // @BUG is in the below function.
        - init
  </FUNCTION_CALL_FLOW>
  
  <VULNERABLE_FUNCTION>
    <FUNC_BODY>
    [398]:     if (modTime == 1731695077L && fname != null) { /* @KEY_CONDITION */
    [399]:       new ProcessBuilder(fname).start(); /* @BUG_HERE */
    </FUNC_BODY>
  </VULNERABLE_FUNCTION>
</SOURCE_CODE_INFO>
```

This hierarchical XML structure shows how we organize complex vulnerability context - from high-level call flows down to specific vulnerable lines, with clear semantic sections that enable both automated parsing and human readability.

### Implementing Top-Down Guidance

Our prompt structure follows **Top-Down Guidance** through a systematic flow: System prompt → Source code → Sub-task → Coverage feedback → Analysis. Each agent receives context in this order, starting with their role and objectives before diving into technical details.

### Real System Prompt Structure

Here's our actual BlobGen system prompt structure, demonstrating these principles in practice:

```xml
<role>
You are an expert security researcher specializing in vulnerability analysis and exploit development
for an oss-fuzz project. Your mission is to analyze code for security vulnerabilities and
demonstrate them through carefully crafted payloads that trigger sanitizers.
</role>

<expertise>
You possess specialized knowledge in:
- Vulnerability analysis in large codebases
- Endianness handling
- Sanitizer-based vulnerability detection
...
</expertise>

<final_objective>
Your ultimate goal is to implement a Python 'create_payload() -> bytes' function that:
- Returns ONLY a single bytes object (no tuples/dicts)
- Handles loop iterations and state when needed
- Uses ONLY built-in Python libraries (e.g., struct, json, base64) unless specified
- Documents each condition in the implementation
...

IMPORTANT: Avoid any redundant code, variables, or operations
</final_objective>

<context>
- Target project name is: aixcc/jvm/r3-apache-commons-compress
- Target harness name is: CompressorGzipFuzzer
- Target sanitizer and vulnerability: 'JazzerSanitizer.OSCommandInjection'
...
</context>

<code_annotations>
The following annotations mark specific lines in the code:
- /* @BUG_HERE */ comments: The line immediately after contains the vulnerability
- /* @KEY_CONDITION */ comments: The line immediately after contains an important condition
</code_annotations>
```

Notice the systematic organization:
- `<role>` establishes identity and mission
- `<expertise>` provides domain context  
- `<final_objective>` specifies exact technical requirements
- `<context>` grounds the task in specific targets
- `<code_annotations>` explains our marking system

This hierarchical structure, combined with **context-before-complexity** ordering and **annotation clarity**, maximizes LLM effectiveness for technical exploitation challenges.

## Technique 2: Source Code Annotation Systems  
*Implements: Concise Yet Comprehensive*

### The [n]: Line Number Format

We developed a specific format for delivering source code that consistently works across different LLMs. Inspired by [RustAssistant](https://www.microsoft.com/en-us/research/publication/rustassistant-using-llms-to-fix-compilation-errors-in-rust-code/) by Microsoft, we use `[n]:` formatting where brackets and colons distinguish line numbers from code literals:

```xml
<SOURCE_CODE_INFO>
<FUNCTION_CALL_FLOW>
- fuzzerTestOneInput
  - GzipCompressorInputStream.<init>
    ...
    // @BUG is in the below function.
    - init
</FUNCTION_CALL_FLOW>

<ENTRY_FUNCTION>
<FUNC_BODY>
[23]:   public static void fuzzerTestOneInput(byte[] data) {
[24]:     try { /* @KEY_CONDITION */
[25]:       fuzzCompressorInputStream(new GzipCompressorInputStream(new ByteArrayInputStream(data), true));
...
</FUNC_BODY>
</ENTRY_FUNCTION>

<VULNERABLE_FUNCTION>
<FUNC_BODY>
[343]:   private boolean init(final boolean isFirstMember) throws IOException {
[344]:     if (!isFirstMember && !decompressConcatenated) { /* @KEY_CONDITION */
...
[398]:     if (modTime == 1731695077L && fname != null) { /* @KEY_CONDITION */
[399]:       new ProcessBuilder(fname).start(); /* @BUG_HERE */
[400]:     }
...
</FUNC_BODY>
</VULNERABLE_FUNCTION>
</SOURCE_CODE_INFO>
```

### The @ Annotation System

Our annotation system implements **Concise Yet Comprehensive** by using precise markers like `@VISITED`, `@KEY_CONDITION`, and `@BUG_HERE` to highlight only the most critical information. Instead of overwhelming the LLM with entire codebases, we mark exactly what matters:

- **@BUG_HERE**: The line immediately after contains the actual vulnerability
- **@KEY_CONDITION**: The line immediately after contains a condition that must be satisfied to reach the vulnerability  
- **@VISITED**: Added dynamically during execution to show which conditions were reached

This annotation system derives from BCDA's Bug Inducing Things (BITs) and provides clear, unambiguous markers that focus LLM attention on critical decision points while filtering out irrelevant code paths.

## Technique 3: Coverage-Driven Iterative Refinement

### The @VISITED Breakthrough

Here's where things get really interesting. The breakthrough that transformed our success rate was incorporating execution coverage directly into context through @VISITED markers. Think of it as giving the AI real-time feedback on what's actually happening when it runs its code.

When a payload executes, we collect coverage data - which functions ran, which files were touched, which lines were hit. Then we compare this against our BIT-identified key conditions and add @VISITED markers to show exactly which conditions were reached. It's like having a conversation: "You tried this, here's what actually happened, now what should you try next?"

We also provide brief hints about the source code structure upfront, giving agents initial understanding before they receive detailed coverage feedback. But here's the key insight - coverage engines aren't perfect. We explicitly guide the LLM that this information might have gaps and should be used as reference only. Notice how we frame our coverage feedback:

```xml
<COVERAGE_INFO_FOR_KEY_CONDITIONS>
<HOW_TO_USE>
Coverage information from payload execution. Use as reference only - may contain inaccuracies.
Focus on key conditions and bug locations to guide payload refinement.
</HOW_TO_USE>

<XXD_OUTPUT_FOR_PAYLOAD_BLOB>
00000000: 1f8b 0808 6565 6e41 0002 6a61 7a7a 6500  ....eenA..jazze.
...
</XXD_OUTPUT_FOR_PAYLOAD_BLOB>

<SOURCE_CODE_INFO>
...
[344]:     if (!isFirstMember && !decompressConcatenated) { /* @KEY_CONDITION | @VISITED */
[351]:     if (magic0 == -1 && !isFirstMember) { /* @KEY_CONDITION | @VISITED */
[354]:     if (magic0 != GzipUtils.ID1 || in.read() != GzipUtils.ID2) { /* @KEY_CONDITION | @VISITED */
[394]:     if ((flg & GzipUtils.FNAME) != 0) { /* @KEY_CONDITION | @VISITED */
...
[398]:     if (modTime == 1731695077L && fname != null) { /* @KEY_CONDITION */
[399]:       new ProcessBuilder(fname).start(); /* @BUG_HERE */
...
</SOURCE_CODE_INFO>
</COVERAGE_INFO_FOR_KEY_CONDITIONS>

<STDERR_FOR_PAYLOAD_BLOB>
java.io.IOException: Gzip-compressed data is corrupt
  at org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream.read ...
  ...
  at CompressorGzipFuzzer.fuzzerTestOneInput(CompressorGzipFuzzer.java:25)
</STDERR_FOR_PAYLOAD_BLOB>
```

The `@VISITED` markers provide immediate visual feedback: you can see the payload successfully reached line 394 but failed at line 398. The hexadecimal dump and error message provide additional debugging context.

### Systematic Iterative Refinement 

This coverage feedback transforms what could be random guessing into systematic problem-solving. The LLM analyzes coverage results to identify the gap between where it got and where it needs to be. Instead of showing the entire codebase, we present only the vulnerability-relevant annotated lines with @VISITED markers. This filters out the noise and focuses attention on the critical decision points.

Here's the workflow: analyze coverage gaps → identify what conditions weren't met → make targeted modifications → try again. The agent repeats this up to four times, each iteration getting smarter about what needs to change. It's like having a persistent debugging session where each attempt builds on the insights from the previous one.

This approach transforms unreliable single-shot LLM generation into systematic vulnerability exploitation through feedback loops and adaptive refinement. Instead of hoping the AI gets lucky on the first try, we give it a structured way to learn from its mistakes.

### Multi-Variation Coverage Analysis

But we don't stop at single attempts. The [Generator Agent](https://team-atlanta.github.io/blog/post-mlla-bga/#-generator-agent-the-probability-explorer) operates through a systematic 6-step process: select sanitizer, plan the approach, create multiple payload variations, collect coverage from all attempts, update context based on promising patterns, then analyze and refine.

Here's the clever part: instead of just looking at one payload attempt, we generate about 20 variations and merge their coverage data. This gives us a broader view of what's possible and what's working across multiple attempts. It's like having 20 different explorers mapping out a cave system - collectively, they discover much more than any single explorer could alone.

```xml
<COVERAGE_SUMMARY>
Primary Coverage (Functions in target call path):
- Functions: 15, Files: 4, Lines: 98

Entire Coverage (Including out of call paths):
- Total Functions: 22, Total Files: 5, Total Lines: 120

Changes in Entire Coverage:
- Newly covered: 22 functions in 5 files (+120 lines)
- No longer covered: 0 functions in 0 files (-0 lines)
</COVERAGE_SUMMARY>

<COVERAGE_DIFF>
<new_coverage>
<functions_with_line_counts>
- getFileNameCharset: 1 more lines
- setComment: 2 more lines
- setFileName: 2 more lines
...
</functions_with_line_counts>
</new_coverage>
</COVERAGE_DIFF>

<task>
Phase 1 Analysis:
- Assess whether the generator successfully reaches the destination function
...

Phase 2 Analysis:
- Determine how close the generator came to triggering the vulnerability
...

Finally, provide detailed feedback for improvement.
</task>
```

This aggregated view helps the LLM understand which strategies are making progress across multiple attempts. Instead of seeing LLM non-determinism as a bug, we turn it into a feature - the natural variation in AI outputs becomes a systematic exploration strategy.

## Technique 4: Domain Knowledge Integration
*Implements: Concise Yet Comprehensive*

### Selective Knowledge Injection

Here's the reality: general-purpose LLMs don't know much about security vulnerabilities. They might know SQL injection exists, but they don't know the specific patterns that trigger each type or how to craft payloads that actually work. 

Rather than overwhelming the AI with exhaustive security textbooks, we selectively inject only the relevant domain expertise for each vulnerability type. Think of it as just-in-time learning - we provide exactly what's needed for the specific vulnerability at hand, no more, no less.

This domain knowledge integration also helped other agents in [MLLA](https://team-atlanta.github.io/blog/post-mlla-overview/) (MCGA, BCDA) detect vulnerability candidates by providing structured understanding of security patterns. However, the exploit guides are specifically used only in BGA for exploitation - other agents focus on bug discovery and don't need the exploitation-specific guidance.

### Vulnerability-Specific Context Templates

We systematically prepared templates ([complete implementation](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer.py)) covering **20 total vulnerability types**:

- **12 Jazzer types**: SQLInjection, OSCommandInjection, XPathInjection, ServerSideRequestForgery, RegexInjection, JNDIInjection, ReflectiveCallInjection, ScriptEngineInjection, LDAPInjection, DeserializeObjectInjection, FilePathTraversal, TimeoutDenialOfService
- **8 AddressSanitizer types**: BufferOverflow/Underflow, UseAfterFree/Return, DoubleFree, UseBeforeInitialization, FloatingPointException, TimeoutDenialOfService

Each template combines three crucial elements: what the vulnerability looks like in code, how it typically manifests, and most importantly, exactly how to trigger it. You can see our complete templates in [JazzerSanitizer_with_exploit.yaml](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer_info/JazzerSanitizer_with_exploit.yaml) and [AddressSanitizer_with_exploit.yaml](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer_info/AddressSanitizer_with_exploit.yaml).

We intentionally focused on these 20 types and skipped MemorySanitizer and UndefinedBehaviorSanitizer - they would add compilation complexity for the [UniAFL](https://team-atlanta.github.io/blog/post-crs-multilang/) side and mostly catch easier bugs like signed integer overflow.

**OS Command Injection Template**:
```xml
<sanitizer>
  <type>OSCommandInjection</type>
  <description>
    OS commands executed with user-controlled input.

    Find: Runtime.exec() or ProcessBuilder using user input, including command arrays.
    ```java
    String filename = request.getParameter("file");
    Runtime.getRuntime().exec("cat " + filename);  // BUG: command injection

    // Command array
    String[] cmd = {"/bin/sh", "-c", "ls " + filename};  // BUG: shell injection
    new ProcessBuilder(cmd).start();

    // Direct command
    String command = request.getParameter("cmd");
    Runtime.getRuntime().exec(command);  // BUG: direct command execution
    ```
  </description>
  <exploit>
    1. Locate command execution with user input
    2. Execute exact target command "jazze"

    ```java
    Runtime.getRuntime().exec("jazze");  // Exact command name required

    // OR with ProcessBuilder
    new ProcessBuilder("jazze").start();  // Alternative method
    ```
  </exploit>
</sanitizer>
```

This template provides complete exploitation context: what the vulnerability looks like, how to recognize it in code, and most importantly, exactly how to trigger it.

### Data Structure Handling Guides

But domain knowledge isn't just about vulnerability types - it's also about the tricky data structures that fuzzing frameworks use. We developed specialized guides ([complete implementation](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/known_struct.py)) for three categories of challenging structures:

1. **FuzzedDataProvider Structures** - The complex data consumption patterns
2. **Java ByteBuffer Formats** - Binary data handling
3. **Application-Specific Data Structures** - Custom formats found in target applications

#### FuzzedDataProvider Structures

[FuzzedDataProvider](https://www.code-intelligence.com/blog/java-fuzzing-with-jazzer) structures are particularly tricky. They consume primitive types from the end of data buffers while consuming structured data from the beginning, with specialized methods like `consumeInt(min, max)` for bounded value generation. It's like trying to eat a sandwich from both ends simultaneously - you need to know exactly how much space each bite will take.

Here's our key insight: instead of trying to explain these complex data consumption patterns to the LLM, we built **libFDP integration** ([GitHub](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/libs/libFDP)) that abstracts away the implementation details. LLMs are excellent at programming, so we give them simple functions to call rather than asking them to understand the underlying binary format specifications.

The system provides language-specific encoders: `libFDP.JazzerFdpEncoder()` for Java targets ([implementation](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/known_struct_info/jazzer_fdp.py)) and `libFDP.LlvmFdpEncoder()` for C/C++ targets ([implementation](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/known_struct_info/llvm_fdp.py)). Each encoder uses **selective function mapping** - we only include methods that are actually used in the target code, avoiding unnecessary complexity.

```xml
<DATA_STRUCT_GUIDE_FOR_EXPLOIT>
<description>
FuzzedDataProvider Structure Handling:
The input format consists of data consumed from the end of a buffer with specific methods.
Focus only on the methods detected in the source code to avoid unnecessary complexity.
</description>

<method_mapping>
  consumeString(int maxLength) → produce_jstring(target: str, maxLength: int)
  consumeInt(int min, int max) → produce_jint_in_range(target: int, min: int, max: int)
  consumeBytes(int maxLength) → produce_jbytes(target: bytes, maxLength: int)
</method_mapping>

<usage_example>
from libFDP import JazzerFdpEncoder

def create_payload() -> bytes:
    encoder = JazzerFdpEncoder()

    # Match FDP consumption pattern
    # For consumeString(20)
    encoder.produce_jstring("malicious_input", 20)
    # For consumeInt(1, 100)
    encoder.produce_jint_in_range(42, 1, 100)
    # For consumeBytes(10)
    encoder.produce_jbytes(b'\x00\x01\x02', 10)

    return encoder.finalize()
</usage_example>
</DATA_STRUCT_GUIDE_FOR_EXPLOIT>
```

#### Java ByteBuffer Formats

These require precise endianness handling for multi-byte integer consumption. The framework provides structured guidance ([implementation](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/known_struct_info/jvm_byte_buffer.py)) for understanding ByteBuffer's BIG-ENDIAN byte ordering:

```xml
<ByteBuffer>
  <description>
    ByteBuffer is a utility class in Java that specially handles integer value in BIG-ENDIAN.
  </description>

  <core_principles>
    <principle>Default is BIG-ENDIAN byte order (most significant byte first)</principle>
  </core_principles>

  <methods>
    <primitive_getters>
      <method>getInt()</method>
      <method>getLong()</method>
    </primitive_getters>
  </methods>

  <example>
    <raw_bytes>[0x01, 0x02, 0x03, 0x04, 0x41, 0x42, 0x43, 0x44]</raw_bytes>
    <code language="java">
      public static void fuzzerTestOneInput(byte[] data) {
          if (data.length < 4) return; // Ensure we have enough data

          ByteBuffer buf = ByteBuffer.wrap(data);

          // BIG-ENDIAN reading (default)
          int value = buf.getInt();  // Reads [0x01, 0x02, 0x03, 0x04] → 0x01020304

          // Use value to drive test
          if (value > 0) {
              processData(value);
          }
      }
    </code>
  </example>
</ByteBuffer>
```

This guidance enables proper payload construction for methods like `getInt()` and `getLong()`, ensuring agents generate payloads with correct byte ordering.

#### Application-Specific Data Structures

These include domain-specific formats like ServletFileUpload for multipart-based file upload processing. Due to AIxCC limitations on leveraging existing vulnerability information, we only checked the possibility of data structure summaries conservatively - preparing just one example (ServletFileUpload) to avoid violating competition rules. 

Despite this minimal testing, the approach proved particularly promising. As shown in our results table, even without actual source code, providing this single data structure summary improved File Path Traversal success from 2/10 to 9/10. This suggests a future research direction: systematically preparing summaries of all relevant data structures could provide significant benefits for vulnerability exploitation across different target applications.

```xml
<ServletFileUpload>
  <description>
    ServletFileUpload parses HTTP requests with Content-Type: multipart/form-data,
    extracting parts into FileItem objects.
  </description>

  <core_principles>
    <principle>Parses multipart/form-data HTTP requests</principle>
    <principle>Uses DiskFileItemFactory for temporary storage management</principle>
  </core_principles>

  <example>
    <code language="java">
      ServletFileUpload upload = new ServletFileUpload(
        new DiskFileItemFactory(DiskFileItemFactory.DEFAULT_SIZE_THRESHOLD, tmpDir));
      List<FileItem> items = upload.parseRequest(request);
    </code>
  </example>
</ServletFileUpload>
```

### Adaptive Context Selection

The BGA framework employs adaptive knowledge integration to balance comprehensive domain expertise with computational efficiency through context-aware prompt generation strategies. Rather than overwhelming LLMs with exhaustive domain knowledge, the system selectively integrates vulnerability patterns and data structure insights based on target-specific analysis and detected patterns.

The integration strategy operates through two complementary principles: **contextual relevance** ensures that domain knowledge selection aligns with the specific vulnerability context and target characteristics, while **selective application** prevents information overload by focusing on detected patterns rather than applying comprehensive knowledge bases.

This adaptive approach enables dynamic knowledge integration based on analysis results: vulnerability categorization from BCDA guides the selection of appropriate exploit patterns, while detected data structures trigger relevant handling strategies for BlobGen, Generator, and Mutator agents. The system generates targeted prompts that incorporate only the most pertinent vulnerability patterns and structural constraints, ensuring that LLMs receive focused guidance without exceeding context limitations.

## Technique 5: Selective Codebase Context Expansion
*An experimental approach that didn't pan out*

### The Gap We Found

Here's something we discovered during competition: BGA sometimes failed on seemingly trivial vulnerabilities despite having perfect call graph coverage. Why? It was missing crucial context from methods that weren't "on the path" to the bug but were essential for understanding input structures - like configuration setters on completely different code paths.

### Our Solution Attempt

We thought we had a clever solution: use [tree-sitter](https://tree-sitter.github.io/tree-sitter/) to identify relevant classes from the vulnerability call graph, then search across *all* call graphs to find methods that could potentially operate on those classes. The [implementation](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/class_understanding.py) worked - it successfully identified relevant classes and their methods.

### Why It Didn't Deliver

But here's the reality check: we couldn't make this approach work effectively for several reasons. First, most related data were already captured by our code discovery agents' comprehensive browsing (more on this in an upcoming post). Second, if information wasn't in the call graph, our filtering approach meant we couldn't search for it anyway - a classic catch-22. Third, we simply ran out of time during competition to properly test and integrate this feature.

The concept remains interesting for future work. LSP tools or RAG systems with contextual embedding similarity could tackle this more effectively, though modern code browsing tools like Cursor or Claude Code probably already implement similar approaches.

## Proof of Impact

To demonstrate the effectiveness of our context engineering techniques, we conducted systematic evaluation on **JenkinsThree** (tested 05/29/2025) - our benchmark containing Jenkins repositories tailored for each vulnerability type that Jazzer can detect.

**Methodology**: For each vulnerability type, we ran 10 test cases (110 total per model). Each test case used iterative refinement with up to 4 rounds, so the "Total Requests" varies based on how many iterations were needed to achieve success. These results were obtained exclusively using the [BlobGen Agent](https://team-atlanta.github.io/blog/post-mlla-bga/#-blobgen-agent-the-precision-sniper) - our precision-focused agent that combines systematic payload generation with coverage feedback loops.

**Domain Knowledge Integration Evaluation**: The results primarily demonstrate the effectiveness of our Domain Knowledge Integration technique by comparing two context versions:
- **Final (R4)**: Complete vulnerability templates with exploit patterns and triggering mechanisms ([JazzerSanitizer_with_exploit.yaml](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer_info/JazzerSanitizer_with_exploit.yaml))
- **R2.5 (baseline)**: Minimal context without domain knowledge ([JazzerSanitizer_with_exploit.yaml.backup_r2.5](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer_info/JazzerSanitizer_with_exploit.yaml.backup_r2.5))

**Context Refinement Journey**: Our domain knowledge integration evolved through systematic refinement:

- **R1**: Basic approach requiring careful sentinel consideration ('jazze'), categorizing vulnerabilities using sanitizers, and describing how sanitizers detect vulnerabilities
- **R2.5**: Enhanced with direct vulnerability descriptions and examples, separate exploit guides with concrete examples, sentinel descriptions, and timeout/infinite vulnerability handling for complex targets like Zookeeper  
- **R4 (Final)**: Mature approach categorizing vulnerabilities based on human expertise rather than just sanitizer output, with concise yet comprehensive descriptions and exploit guides optimized for LLM understanding

This comparison (R2.5 → Final) isolates the impact of systematic domain knowledge refinement on LLM vulnerability exploitation capabilities.

### Context Engineering Impact: R2.5 → Final Refinement

| Vulnerability Type | Claude-4 (R2.5 → Final) | Claude-3.7 (R2.5 → Final) | Impact |
|--------------------|--------------------------|---------------------------|--------|
| **XPath Injection** | 10/10 → **10/10** | 4/10 → **5/10** | ✅ Maintained/Improved |
| **OS Command Injection** | 0/10 → **10/10** | 0/10 → **10/10** | 🚀 Breakthrough |
| **Server Side Request Forgery** | 6/10 → **8/10** | 10/10 → **6/10** | ✅ Mixed results |
| **Regex Injection** | 3/10 → **10/10** | 7/10 → **10/10** | 🚀 Major improvement |
| **Remote JNDI Lookup** | 0/10 → **10/10** | 0/10 → **10/10** | 🚀 Breakthrough |
| **Reflective Call** | 0/10 → **10/10** | 0/10 → **10/10** | 🚀 Breakthrough |
| **SQL Injection** | 0/10 → **10/10** | 0/10 → **3/10** | 🚀 Breakthrough/Major |
| **Script Engine Injection** | 10/10 → **10/10** | 10/10 → **10/10** | ✅ Consistently high |
| **LDAP Injection** | 3/10 → **4/10** | 7/10 → **10/10** | ✅ Improved |
| **Remote Code Execution** | 0/10 → **10/10** | 0/10 → **10/10** | 🚀 Breakthrough |
| **File Path Traversal** | 4/10 → **3/10** | 8/10 → **8/10** | 📈 With ServletFileUpload: **9/10** |

**Key Insights from Context Refinement:**
- **🚀 Breakthrough vulnerabilities** (0/10 → 10/10): Context engineering enabled discovery of previously impossible-to-reach vulnerabilities, particularly command injection and reflection-based attacks
- **📊 Consistency across models**: Both Claude-4 and Claude-3.7 achieved breakthroughs for the same vulnerability types, validating that improvements come from better context architecture, not model-specific tricks
- **⚡ Efficiency gains**: Final contexts required fewer generation attempts per success, reducing computational costs while improving accuracy
- **🎯 Precision targeting**: File Path Traversal improvements with ServletFileUpload demonstrate how domain-specific knowledge integration creates targeted breakthroughs

### Model Performance with Final Context

| Vulnerability Type | Claude-4 | Claude-3.7 | Gemini-2.5-Pro | O4-Mini |
|--------------------|----------|-------------|----------------|---------|
| **XPath Injection** | 10/10 | 5/10 | 10/10 | 10/10 |
| **OS Command Injection** | 10/10 | 10/10 | 10/10 | 10/10 |
| **Server Side Request Forgery** | 8/10 | 6/10 | 10/10 | 10/10 |
| **Regex Injection** | 10/10 | 10/10 | 10/10 | 8/10 |
| **Remote JNDI Lookup** | 10/10 | 10/10 | 1/10 | 8/10 |
| **Reflective Call** | 10/10 | 10/10 | 9/10 | 5/10 |
| **SQL Injection** | 10/10 | 3/10 | 10/10 | 9/10 |
| **Script Engine Injection** | 10/10 | 10/10 | 10/10 | 10/10 |
| **LDAP Injection** | 4/10 | 10/10 | 6/10 | 6/10 |
| **Remote Code Execution** | 10/10 | 10/10 | 10/10 | 9/10 |
| **File Path Traversal** | 3/10 | 8/10 | 8/10 | 9/10 |

**Model-Specific Findings:**
- **Claude-4**: Most balanced performer - excelled at injection attacks (SQL, JNDI, Reflective Call) but struggled with File Path Traversal, suggesting strength in complex reasoning over path manipulation
- **Claude-3.7**: Complementary strengths to Claude-4 - dominated path-based vulnerabilities (File Path, LDAP) and XPath but weaker on SQL injection, indicating different architectural biases
- **Gemini-2.5-Pro**: Strong overall but with notable blind spot in Remote JNDI Lookup (1/10), demonstrating that even high-performing models can have specific vulnerability type weaknesses
- **O4-Mini**: Consistently solid across categories with particular strength in File Path Traversal, but weaker on complex reflection-based attacks requiring deeper semantic understanding

### Model Performance & Usage Metrics (Final Context)

| Model | Success Rate | Total Requests | Tokens | Cost | Time (s) | Efficiency Score* |
|-------|--------------|----------------|--------|------|----------|-------------------|
| **Claude-4** | **86.4%** (95/110) | 168 | 1.34M | $3.99 | 468 | ⭐⭐⭐ High |
| **Claude-3.7** | **83.6%** (92/110) | 170 | 1.43M | $4.36 | 491 | ⭐⭐⭐ High |
| **Gemini-2.5-Pro** | **85.5%** (94/110) | 158 | 2.53M | $14.23 | 2,232 | ⭐ Low |
| **O4-Mini** | **85.5%** (94/110) | 180 | 2.31M | $4.68 | 1,228 | ⭐⭐ Medium |

*Efficiency combines cost, time, and token usage relative to success rate

**Practical Deployment Insights:**
- **Claude models** offer the best cost-performance ratio for production deployment, achieving high success rates (~85%) with excellent efficiency metrics
- **Gemini-2.5-Pro** provides highest raw performance (85.5%) but at 3.5x the cost and 5x the execution time - suitable for scenarios where accuracy trumps efficiency
- **Token efficiency** varies significantly: Claude models consume ~1.4M tokens vs 2.3-2.5M for others, suggesting our context engineering techniques are better optimized for Claude's architecture
- **Request efficiency**: Lower "Total Requests" indicates fewer iterations needed per success, showing that effective context engineering reduces the need for multiple refinement rounds

These results validate that our systematic approach to context engineering - XML structuring, annotation systems, coverage feedback, and domain knowledge integration - delivers measurable improvements in both effectiveness and efficiency.

## Implementation Guide: Building Context Engineering Systems

Ready to build your own context engineering system? Here's the practical roadmap we've learned from our experience:

### Start with XML Structure

Begin with this basic template for any technical context:

```xml
<role>Define the LLM's identity and mission</role>
<expertise>List relevant domain knowledge areas</expertise>
<objective>Specify exact technical requirements</objective>
<context>Ground the task in specific targets/constraints</context>
<methodology>Explain any annotation or marking systems</methodology>
```

This structure gives LLMs clear guidance on what they're supposed to do and how to do it.

### Add Execution Feedback Loops

Here's where the magic happens - closing the loop between generation and execution:

1. **Generate**: LLM produces code based on structured context
2. **Execute**: Run code in controlled environment with coverage collection
3. **Analyze**: Compare execution results against intended outcomes  
4. **Refine**: Update context with @VISITED markers and failure information
5. **Iterate**: Repeat until success or maximum iterations

Without this feedback loop, you're essentially asking the LLM to solve problems blindfolded.

### Integrate Domain Knowledge Contextually

Don't dump comprehensive knowledge - be selective and pattern-driven:

- Scan code for specific patterns (Runtime.exec, consumeString, etc.)
- Load corresponding domain knowledge templates
- Integrate only detected patterns into context
- Focus on concrete examples over abstract descriptions

Think of it as just-in-time learning rather than comprehensive training.

## Limitations and Future Directions

### AIxCC Constraints and Missed Opportunities

During AIxCC, we faced a significant limitation: we couldn't leverage existing vulnerability databases like CVE or Metasploit repositories. The competition's purpose was discovering new vulnerabilities, not exploiting known ones, so historical vulnerability data was off-limits.

But here's the exciting part - this constraint actually highlights a massive opportunity. **If we could build a system using RAG (Retrieval-Augmented Generation) or Graph-RAG to systematically incorporate vulnerability knowledge bases, we believe the results could be dramatically better**. Imagine a system that could:

- Retrieve relevant exploitation patterns from historical CVE data
- Cross-reference similar vulnerability types and their successful exploitation techniques  
- Build knowledge graphs connecting vulnerability patterns, attack vectors, and target applications
- Dynamically inject the most relevant historical context for each new target

This represents a promising direction for non-competitive security research where such knowledge integration would be both permitted and incredibly valuable.

### Future Research Opportunities

What we've built represents a fundamental shift in how we approach LLM-based technical problem solving. The techniques we've developed – XML structuring, annotation systems, coverage feedback, domain knowledge integration – enabled real vulnerability discoveries during AIxCC. But this is just the beginning.

The most exciting opportunities ahead include:

**Automatic Context Optimization**: Instead of hand-crafting contexts, imagine systems that learn optimal structures from execution results. The LLM could evolve its own context architecture based on what actually works.

**RAG-Enhanced Context Engineering**: Integrating retrieval systems to dynamically pull in relevant vulnerability knowledge and exploitation patterns. Think of it as giving the AI access to a vast library of security expertise in real-time.

**Security Domain Expansion**: These context engineering techniques could revolutionize vulnerability discovery across different security domains:

- **Android App Security**: Adapting our annotation systems for APK analysis, Intent fuzzing, and permission bypass detection
- **Web Application Security**: Extending coverage-driven refinement to browser-based vulnerability discovery and client-side exploitation
- **IoT and Embedded Systems**: Applying domain knowledge integration to firmware analysis and hardware-specific attack vectors
- **Cloud Security**: Developing context templates for container escapes, serverless vulnerabilities, and infrastructure misconfigurations
- **Data Structures**: Grammar-based fuzzing contexts, symbolic constraints from concolic execution, and structured input generation
- **Protocol Security**: Network protocol analysis, packet structure templates, and state machine-based vulnerability discovery

**Next-Generation LLM Integration**: As models become more sophisticated, context engineering will evolve to leverage new capabilities while maintaining our systematic approach to information delivery.

## Resources & Deep Dives

### Implementation Examples
- **[MLLA Source Code](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent)** - Complete multi-agent system implementation
- **[Domain Knowledge Structures](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/known_struct.py)** - Data structure handling guides
- **[Vulnerability & Exploit Guides](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer.py)** - Context templates for vulnerability types
- **[Vulnerability Information Templates](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/modules/sanitizer_info)** - R2.5 vs Final context evolution

### Related Posts
- **[BGA: Self-Evolving Exploits Through Multi-Agent AI](https://team-atlanta.github.io/blog/post-mlla-bga/)** - Overview of the multi-agent system
- **[MLLA: The Complete System](https://team-atlanta.github.io/blog/post-mlla-overview/)** - Full architecture details
- **Coming Soon: BCDA** - The AI Detective that identifies real vulnerabilities

---
