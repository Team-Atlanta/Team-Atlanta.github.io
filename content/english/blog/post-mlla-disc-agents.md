---
title: "From Harness to Vulnerability: AI Agents for Code Comprehension and Bug Discovery"
meta_title: ""
description: ""
date: 2025-09-04T10:00:00Z
image: "/images/blog/mlla/cpua_preview.png"
categories: ["Atlantis-Multilang"]
author: "Soyeon Park"
tags: ["mlla", "llm", "multi-agent"]
draft: false
---

## **Beneath the Exploit: The Groundwork That Makes Bug Hunting Possible**

When people hear about **AI agents finding vulnerabilities**, they often imagine the spectacular finale: an exploit payload triggering a crash, or a carefully crafted generator slipping past validation layers.

But here’s the truth: **none of that would have been possible without groundwork laid by three quieter agents.**

Before any exploit can be created, the system must answer harder, subtler questions:
- _Which functions in this ocean of code are worth exploring?_
- _How do they connect to one another?_
- _Where are the potential dangerous sinks?_

That’s the job of **CPUA, CGPA, and MCGA** — the scouts, librarians, and cartographers of the MLLA ecosystem. They don’t generate flashy exploits. Instead, they build the maps, catalogs, and entry points that make exploit generation possible.

In fact, **if MCGA doesn’t detect a vulnerable sink, BCDA and BGA never even get triggered.** This pipeline dependency means the exploit stage only happens because these three agents did their job first.

---
## **Why Code Comprehension Matters**

Imagine being dropped into a foreign city with millions of streets but no map. That’s what a raw codebase looks like to a fuzzer. You could wander aimlessly (traditional fuzzing), but you’ll likely never find the treasure. Instead, you need guides who can:

- **Scout entry points** (harness functions that process input)
- **Retrieve precise directions** (resolve function definitions, signatures, and dependencies)
- **Draw accurate maps** (call graphs with danger zones clearly marked)

That’s what CPUA, CGPA, and MCGA do. They are not about brute force; they are about **intelligence in navigation**.

---
## **🎯 CPUA: The Scout**

If every heist needs someone to case the building first, **CPUA (CP Understanding Agent)** is that scout.

- **Input**: Harness file contents (the starting point of fuzzing).
- **Output**: A prioritized list of “interesting functions” that deserve attention.

CPUA uses LLM reasoning to analyze harnesses, detect functions that handle **untrusted input**, and annotate them with metadata like:

- Function names and locations
- Priority scores (e.g., fuzzed input vs. utility function)
- Tainted parameters

This focus prevents wasted effort. Instead of traversing millions of functions, CPUA narrows the field to dozens that actually matter.

**Strengths:**
- Language-independent (works for C, C++, Java, etc.)
- Can handle reflection-heavy harnesses (common in JVM projects)

**Limitations:**
- If the harness doesn’t expose critical functions (like in nginx), CPUA can’t surface them.

Still, CPUA’s scouting ability sets the stage. Without it, later agents would drown in noise.

**Hands-on Example:**
```python
# Simplified CPUA flow (from cpua.py)
def analyze_harness(harness_code: str) -> list[str]:
    funcs = extract_function_calls(harness_code)
    prioritized = rank_functions(funcs)  # fuzzed input, tainted args
    return prioritized

# Example harness snippet
harness = """
public void fuzzerTestOneInput(FuzzedDataProvider data) {
    String xml = data.consumeString(100);
    parseDocument(xml);   // interesting
    helperLog(xml);       // low priority
}
"""

print(analyze_harness(harness))
# Output: ["parseDocument", "helperLog"]
```

---
## **📚 CGPA: The Librarian**

Once CPUA points at “interesting” functions, the next question is: _where exactly are they, and what do they look like?_

That’s the role of **CGPA (Call Graph Parser Agent)** — the meticulous librarian of the team.

- **Input**: Partial function info (e.g., just a function name, or callsite reference).
- **Output**: Full function definition (location, signature, body, caller/callee context).

CGPA achieves this by orchestrating a suite of tools:

- **Joern** for deep static analysis and Code Property Graphs
- **LSP** (via multilspy, patched to support clangd for C/C++/Java)
- **Ripgrep/AST-grep** for syntax-aware code searching
- **Code Indexer** for fast cross-referencing

If multiple candidates match, CGPA can even query the LLM to disambiguate.

Think of it this way: if CPUA says “go check the room marked ‘processInput’,” CGPA is the one who fetches the blueprints and directions to the exact door, floor, and lock.

**Hands-on Example:**
```python
# Simplified CGPA query (from cgpa.py)
def resolve_function(partial: str) -> dict:
    result = code_indexer.lookup(partial)
    if not result:
        result = lsp.find_definition(partial)
    if not result:
        result = joern.query(f'function.name="{partial}"')
    return result

# Example: partial info = "parseDocument"
print(resolve_function("parseDocument"))
# Output:
# {
#   "file": "src/main/java/org/example/XMLParser.java",
#   "signature": "public void parseDocument(String xml)",
#   "start_line": 42,
#   "end_line": 87
# }
```

---

## **🗺️ MCGA: The Cartographer**

Now comes the most ambitious of the trio: **MCGA (Make Call Graph Agent)**. If CPUA is the scout and CGPA the librarian, MCGA is the cartographer — building maps of how code actually flows.

- **Input**: Function info (name, file, code, tainted args).
- **Output**: Structured call graph annotated with vulnerability info.

MCGA works recursively:

1. **Root Node Initialization** – Starts from a target function (resolved via CGPA).
2. **Callee Extraction** – Finds all callsites in the body.
3. **Vulnerable Sink Detection** – Uses LLM reasoning to flag dangerous operations (e.g., system calls, unsafe deserialization).
4. **Callee Resolution** – Queries CGPA to fetch precise info for each callee.
5. **Recursive Expansion** – Builds subgraphs, detects cycles, and respects depth limits.
6. **Caching & Efficiency** – Uses Redis + in-memory caches to prevent re-analysis.
7. **Structured Output** – Returns a FuncInfo tree, each node annotated with sink detection reports.

**Hands-on Example:**
```python
# From mcga.py
def build_call_graph(fn: FuncInfo) -> FuncInfo:
    callees = extract_callees(fn.func_body)
    for callee in callees:
        callee_info = cgpa.resolve_function(callee)
        child = FuncInfo(func_location=callee_info)
        fn.children.append(child)
        if detect_sink(child):  # e.g., Runtime.exec, SQL query
            child.sink_detector_report = {"sink": True}
        build_call_graph(child)  # recursion
    return fn

# Example call graph output
root = FuncInfo(func_location={"name": "parseDocument"})
graph = build_call_graph(root)
print(graph.to_json())
# {
#   "name": "parseDocument",
#   "children": [
#     {"name": "validateXML", "children": []},
#     {"name": "loadExternalDTD", "sink": true}
#   ]
# }
```

Here, loadExternalDTD is flagged as a sink — a finding that triggers BCDA to generate a **BugInducingThing** and eventually hands off to BGA for exploit generation.

---

## **Engineering Challenges**

Building these agents was far from trivial. Some lessons from the trenches:

- **LLM Cost Control**: Call graph expansion is recursive and potentially explosive. We had to integrate caching layers and prioritize tool-based results (Joern, LSP) before falling back to LLM calls.
- **Balancing Static and Dynamic**: Pure LLM reasoning often hallucinated callees. By mixing AST parsing, coverage traces, and Joern outputs, MCGA became both faster and more accurate.
- **Asynchronous Execution**: Instead of serially building massive graphs, MCGA launches sink detections asynchronously, enabling early-stage bug discovery.

---
## **Lessons Learned**

Reflecting on this design, a few insights stand out:

1. **Machine-Guided Beats Human-Mimicry**
    Early on, we tried to mimic human auditors too literally. Later, we leaned into machine advantages — like async graph expansion and LLM-guided fuzzing integration — and saw better results.
1. **Context Engineering Is the Next Frontier**
    LLMs thrive on top-down descriptions with selective detail. Feeding call paths, tainted args, and sanitizer hints in structured form was more effective than dumping entire files.
1. **Integration Matters**
    These agents weren’t just standalone tools; they were designed to hand off work seamlessly. CPUA’s outputs flowed into MCGA, which in turn leaned on CGPA, all culminating in BCDA and BGA.

---
## **Closing Thoughts**

When I actually worked on using LLMs to find bugs, I came away with some mixed but exciting impressions.

First, I realized that **fuzzing and LLMs shine in very different domains**. Fuzzers
are still unmatched at surfacing **memory corruption** issues, such as crashes, overflows,
dangling pointers, the kinds of low-level chaos that brute-force mutation is
naturally good at exploring.
But when it comes to **logic errors**, fuzzers are only as good as their bug oracles.
LLMs, on the other hand, surprised me
with how well they could identify logic errors. They’re able to reason about
semantics, invariants, and unintended behavior in a way fuzzers can’t. That made
me think: maybe LLMs could be especially valuable in areas like smart contracts,
where correctness depends far more on logic than memory safety.

That said, LLMs struggle with memory corruption directly. Many of these bugs are
**deeply context-dependent** — think use-after-free, or API-sequence–driven
vulnerabilities. To capture that context, you’d have to feed the model an
enormous slice of the codebase, which quickly runs into context window limits.
That’s why we designed UniAFL to use LLMs more as assistants to fuzzing rather
than replacements. The fuzzer provides raw coverage and brute force, while the
LLM helps steer: generating better seeds, prioritizing paths, or highlighting
suspicious functions. It worked well in practice, but it also showed me how much
room there is to grow. Handling **execution context**, the stateful conditions that
make subtle memory bugs appear, is still a frontier.
I even considered attaching tools like a **debugger** to give LLMs richer execution
insights, but we simply didn’t have the time during the competition. Still, I
think giving LLMs better tools to reason about those contexts will be one of the
most promising directions forward.

Looking back at the competition, I think the results were encouraging. Every
system was constrained to a handful of harnesses, each exercising only a limited
set of functions. Within that tight scope, Atlantis still uncovered **six zero-day vulnerabilities**. That felt significant. It also hinted at potential: with more
harnesses, or with broader harness coverage per project, the number of bugs we
could find would scale up dramatically.

That leaves me asking a deeper question: what makes a good harness? A harness
isn’t just a piece of glue code. It defines the **context needed to trigger a bug**. And building the right context is exactly where I think LLMs can shine.
They’re good at understanding code, generating scaffolding, and filling in the
missing pieces of a test. If we can teach them to generate better harnesses, we
might open up whole new classes of vulnerabilities that current tools can’t
touch.

In the end, my biggest takeaway is that LLMs are not here to replace human
security researchers or fuzzers. Instead, they’re here to **amplify our reach**.
Fuzzers will continue to hammer the low-level space. Humans will continue to
frame the hardest questions. And LLMs can be the bridge, helping us understand
complex codebases, reason about hidden contexts, and design smarter experiments.

<span style="background-color:lightgray;color:green">From harness to vulnerability, the journey is long. But with LLMs as
collaborators rather than replacements, I believe we can explore parts of the
security landscape that used to feel unreachable.</span>

## 📚 **Technical Resources**
- **Source Code by Agent:**
  - [CPUA](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/cpua.py)
  - [CGPA](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/cgpa.py)
  - [MCGA](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/mcga.py)

### 🔗 **Related Deep Dives**
- [🏗️ **MLLA Overview: The Complete System**](https://team-atlanta.github.io/blog/post-mlla-overview/)
- [📖 **UniAFL: The Fuzzing Infrastructure**](https://team-atlanta.github.io/blog/post-crs-multilang/)
- [🛠️ **BGA: Self-Evolving Exploits Through Multi-Agent AI**](https://team-atlanta.github.io/blog/post-mlla-bga/)
- [🧠 **Context Engineering: How BGA Teaches LLMs to Write Exploits**](https://team-atlanta.github.io/blog/post-context-engineering/)
- [🔬 **BCDA: The AI Detective Separating Real Bugs from False Alarms**](https://team-atlanta.github.io/blog/post-mlla-bcda/)

---
