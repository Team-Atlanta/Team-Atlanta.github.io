---
title: "Context Engineering: How BGA Teaches LLMs to Write Exploits"
meta_title: ""
description: "Deep dive into the context engineering techniques that make BGA's AI agents effective at vulnerability exploitation - from XML structuring to coverage feedback loops"
date: 2025-08-30T10:00:00Z
image: "/images/blog/mlla/context_preview.png"
categories: ["Atlantis-Multilang"]
author: "Dongkwan Kim"
tags: ["context-engineering", "llm", "prompt-engineering", "bga", "coverage-feedback"]
draft: true
---

## The Problem with Teaching AI to Hack

Getting an LLM to write working exploits isn't just hard – it's a fundamentally different problem than most AI tasks. You can't approximate your way to success. You can't be "mostly right." When you need to trigger a vulnerability that requires an exact timestamp (1731695077), a specific filename ("jazze"), and perfect GZIP structure, 99% accuracy means 100% failure.

This precision requirement drove us to develop what we call **context engineering** – a systematic approach to structuring and delivering information that transforms LLMs from sophisticated guessers into reliable technical problem solvers. During the AIxCC competition, these techniques enabled our [BGA framework](https://team-atlanta.github.io/blog/post-mlla-bga/) to discover 7 unique vulnerabilities.

The key insight: LLMs don't need smarter algorithms – they need smarter information delivery. This post reveals the actual techniques we developed, with real examples from our technical implementation.

## The Core Challenge: From Chaos to Context

When we started building BGA, we immediately hit a wall that reveals the fundamental challenge of AI-assisted security research: **how do you teach an LLM about vulnerabilities that exist across massive, complex codebases?**

Traditional prompt engineering assumes you can describe your problem in natural language. But vulnerabilities don't work that way. They emerge from the interaction between:

- **Call graphs** spanning dozens of functions across multiple files
- **Data flow** through complex transformations and validations
- **Format specifications** that must be byte-perfect (GZIP headers, XML structures, protocol buffers)
- **Execution context** including sanitizers, containerization, and runtime environments
- **Domain knowledge** about vulnerability patterns, exploitation techniques, and specific tool behaviors

The breakthrough came when we realized this isn't a prompting problem – it's an information architecture problem. We needed to build a complete pipeline for transforming raw security analysis into structured, actionable context that LLMs could systematically use.

## The BGA Context Engineering Architecture

Our approach centers on five core techniques that work together:

1. **XML-Structured Context Design** – Organizing complex technical information for reliable LLM parsing
2. **Source Code Annotation Systems** – Marking vulnerabilities and conditions with precise labels
3. **Coverage-Driven Iterative Refinement** – Using execution feedback to guide systematic improvement
4. **Domain Knowledge Integration** – Injecting specialized security expertise contextually
5. **Multi-Agent Context Coordination** – Transforming information as it flows between specialized agents

Let's dive into how each technique works in practice.

## Technique 1: XML-Structured Context Design

### Why XML Beat Every Alternative

We tested multiple approaches for structuring context: JSON, YAML, plain text with markers, and XML. XML won decisively, but not for the reasons you might expect.

**The Parsing Reliability Problem**: When your context includes code snippets with nested braces, JSON parsing becomes unreliable. LLMs consistently misinterpret where code ends and structure begins. XML's verbose tags provide unambiguous boundaries:

```xml
<vulnerability>
  <code>if (modTime == 1731695077L && fname != null) {</code>
  <annotation>@KEY_CONDITION</annotation>
</vulnerability>
```

**Hierarchical Information Architecture**: Security contexts are naturally hierarchical – vulnerabilities contain functions, functions contain conditions, conditions have execution states. XML's opening/closing tags make these relationships explicit without ambiguity.

### Real System Prompt Structure

Here's our actual BlobGen system prompt structure, demonstrating the principles we discovered:

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

### The [n]: Line Number Format

We developed a specific format for delivering source code that consistently works across different LLMs. Inspired by RustAssistant, we use `[n]:` formatting where brackets and colons distinguish line numbers from code literals:

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

We use `@` prefixes to mark critical lines without conflicting with developer comments:

- **@BUG_HERE**: The line immediately after contains the actual vulnerability
- **@KEY_CONDITION**: The line immediately after contains a condition that must be satisfied to reach the vulnerability

This annotation system derives from BCDA's Bug Inducing Things (BITs) and provides clear, unambiguous markers that LLMs can reliably identify and reference.

## Technique 3: Coverage-Driven Iterative Refinement

### The @VISITED Breakthrough

The breakthrough that transformed our success rate was incorporating execution coverage directly into context through @VISITED markers. Here's how it works:

When a payload is executed, we collect runtime coverage data and compare executed lines against BIT-identified key conditions. We then add @VISITED markers to show which conditions were reached:

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

This coverage feedback integrates with our iterative refinement workflow. The BlobGen agent repeats up to four refinement cycles, with each iteration:

1. Analyzing coverage gaps between executed lines and required conditions
2. Using selective source code inclusion to present only vulnerability-relevant annotated lines  
3. Filtering irrelevant code paths to focus LLM attention on critical decision points
4. Systematically communicating coverage gaps to guide targeted script modifications

This transforms unreliable single-shot LLM generation into systematic vulnerability exploitation through feedback loops and adaptive refinement.

### Multi-Variation Coverage Analysis

The Generator agent takes a different approach, running 20 payload variations and learning from collective coverage:

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

This aggregated view helps the LLM understand which strategies are making progress across multiple attempts, enabling probabilistic exploration strategies that turn LLM non-determinism from weakness into strength.

## Technique 4: Domain Knowledge Integration

### Vulnerability-Specific Context Templates

Generic LLMs lack the specialized security knowledge needed for effective exploitation. We address this through structured domain knowledge templates that provide concrete patterns and triggering mechanisms.

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

This template provides complete exploitation context: conceptual understanding, code patterns to recognize, exact triggering requirements, and multiple valid approaches.

### Data Structure Handling Guides

Complex data structures require specialized handling. We developed guides for three categories of challenging structures:

**FuzzedDataProvider Structures**: These pose significant challenges due to complex data consumption behaviors – consuming primitive types from the end of data buffers while consuming structured data from the beginning:

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

**Java ByteBuffer Formats**: Require precise endianness handling for multi-byte integer consumption. The framework guides agents in understanding ByteBuffer's big-endian byte ordering, enabling proper payload construction for methods like `getInt()` and `getLong()`. Agents must generate payloads with correct byte ordering, such as transforming `b'\r\x00\x00\x00\x01\x00\x00\x00'` to `b'\x00\x00\x00\r\x00\x00\x00\x01'`.

**Application-Specific Data Structures**: Including domain-specific formats like ServletFileUpload for multipart-based file upload processing:

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

Rather than overwhelming LLMs with exhaustive domain knowledge, we employ adaptive knowledge integration through context-aware prompt generation strategies. This operates through two complementary principles:

- **Contextual Relevance**: Domain knowledge selection aligns with specific vulnerability context and target characteristics
- **Selective Application**: Prevents information overload by focusing on detected patterns rather than applying comprehensive knowledge bases

The system generates targeted prompts incorporating only the most pertinent vulnerability patterns and structural constraints, ensuring LLMs receive focused guidance without exceeding context limitations.

## Technique 5: Multi-Agent Context Coordination

### Context Transformation Across Agents

Different agents need different views of the same vulnerability. Our Orchestrator manages these transformations systematically.

**Starting Point - BCDA Output (Bug Inducing Thing)**:
```python
{
    "vulnerability_type": "OSCommandInjection",
    "location": {"file": "GzipCompressorInputStream.java", "line": 399},
    "trigger_conditions": [
        "modTime == 1731695077L",
        "fname != null", 
        "FNAME flag set in header"
    ],
    "call_path": ["fuzzerTestOneInput", "GzipCompressorInputStream.<init>", "init"],
    "priority": "HIGH"
}
```

**Transformation for BlobGen** (needs complete context for iterative refinement):
```xml
<vulnerability_context>
  <type>OSCommandInjection</type>
  <target_function>init</target_function>
  <full_call_path>fuzzerTestOneInput → GzipCompressorInputStream.<init> → init</full_call_path>
  <trigger_requirements>
    <requirement>Set FNAME flag (0x08) in GZIP header</requirement>
    <requirement>Include modification time == 1731695077</requirement>
    <requirement>Provide filename "jazze" in FNAME field</requirement>
  </trigger_requirements>
</vulnerability_context>
```

**Transformation for Generator** (needs source/destination for probabilistic exploration):
```xml
<generation_context>
  <source_function>fuzzerTestOneInput</source_function>
  <destination_function>init</destination_function>
  <vulnerability_location>line 399</vulnerability_location>
  <variation_hints>
    <hint>Try different GZIP compression methods</hint>
    <hint>Vary extra field contents</hint>
    <hint>Test with/without CRC validation</hint>
  </variation_hints>
</generation_context>
```

**Transformation for Mutator** (needs focused transition analysis):
```xml
<mutation_context>
  <transition>GzipCompressorInputStream.<init> → init</transition>
  <focus_area>GZIP header bytes 0-10</focus_area>
  <critical_values>
    <value offset="4">1731695077 (little-endian)</value>
    <value offset="3">0x08 (FNAME flag)</value>
  </critical_values>
</mutation_context>
```

Each transformation emphasizes what that specific agent needs to succeed, filtering and structuring information for maximum effectiveness.

## Real-World Results: What Actually Worked

During the AIxCC competition, these context engineering techniques enabled concrete discoveries. Here's what we learned works consistently:

### The Successes

**XML Structure Reliability**: XML parsing never failed us during the competition. The verbose tags provide unambiguous structure that LLMs parse correctly every time. This reliability was crucial under competitive pressure.

**@VISITED Markers**: Simple visual markers in source code made coverage feedback immediately understandable. LLMs grasp "you reached this line but not that one" instantly when shown with @VISITED annotations.

**Hierarchical Context Organization**: Our systematic approach of role → expertise → objectives → context → annotations consistently improved output quality compared to unstructured prompts.

**Script-Based Generation**: Having LLMs generate Python scripts that create payloads (rather than payloads directly) provided the precision needed for byte-perfect exploitation requirements.

### The Technical Insights

**Selective Context Beats Comprehensive**: Showing 50 annotated lines often outperformed showing 500 lines of complete context. LLMs get lost in noise just like humans do.

**Context-Before-Complexity**: Providing target binding (project name, sanitizer type) before introducing code complexity prevented focus dilution across irrelevant possibilities.

**Annotation Clarity**: The `@` prefix system avoided confusion with developer comments while providing clear, unambiguous markers that LLMs could reliably reference.

## Implementation Guide: Building Context Engineering Systems

### Start with XML Structure

Begin with this basic template for technical contexts:

```xml
<role>Define the LLM's identity and mission</role>
<expertise>List relevant domain knowledge areas</expertise>
<objective>Specify exact technical requirements</objective>
<context>Ground the task in specific targets/constraints</context>
<methodology>Explain any annotation or marking systems</methodology>
```

### Add Execution Feedback Loops

The key breakthrough comes from closing the loop between generation and execution:

1. **Generate**: LLM produces code based on structured context
2. **Execute**: Run code in controlled environment with coverage collection
3. **Analyze**: Compare execution results against intended outcomes  
4. **Refine**: Update context with @VISITED markers and failure information
5. **Iterate**: Repeat until success or maximum iterations

### Integrate Domain Knowledge Contextually

Rather than dumping comprehensive knowledge, detect patterns and inject relevant templates:

- Scan code for specific patterns (Runtime.exec, consumeString, etc.)
- Load corresponding domain knowledge templates
- Integrate only detected patterns into context
- Focus on concrete examples over abstract descriptions

## Future Directions

Context engineering represents a fundamental shift in how we approach LLM-based technical problem solving. The techniques we've developed – XML structuring, annotation systems, coverage feedback, domain knowledge integration, and multi-agent coordination – enabled real vulnerability discoveries during AIxCC.

But this is just the beginning. Key opportunities for advancement include:

**Automatic Context Optimization**: Learning optimal context structures from execution results rather than hand-crafting them.

**Cross-Domain Applications**: These techniques apply beyond security to any domain requiring precision and technical accuracy.

**Next-Generation LLM Integration**: As models become more sophisticated, context engineering will evolve to leverage new capabilities while maintaining the systematic approach to information delivery.

## Resources & Deep Dives

### Implementation Examples
- **[BGA Source Code](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents)** - Complete agent implementations
- **System Prompts** - See `blobgen-system-prompt.txt` and `blobgen-source-code-prompt.txt` in our technical report

### Related Posts
- **[BGA: Self-Evolving Exploits Through Multi-Agent AI](https://team-atlanta.github.io/blog/post-mlla-bga/)** - Overview of the multi-agent system
- **[MLLA: The Complete System](https://team-atlanta.github.io/blog/post-mlla-overview/)** - Full architecture details

---

Context engineering transforms LLMs from sophisticated guessers into systematic technical problem solvers. The structured approaches in this post – XML organization, annotation systems, coverage feedback, and adaptive knowledge integration – represent a systematic methodology for building AI systems that work reliably with complex technical domains.

The key insight: **Better information architecture creates better AI outcomes**. Start with structure, add execution feedback, iterate based on results.