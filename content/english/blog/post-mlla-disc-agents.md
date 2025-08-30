---
title: "From Harness to Vulnerability: AI Agents for Code Comprehension and Bug Discovery"
meta_title: ""
description: ""
date: 2025-08-29T21:00:00Z
image: "/images/blog/mlla/bga_preview.png"
categories: ["Atlantis-Multilang"]
author: "Soyeon Park"
tags: ["mlla", "llm", "multi-agent"]
draft: true
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
# Output: ["parseDocument"]  (ranked as target)
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
## **The Trio in Action**

Individually, these agents are useful. Together, they form the backbone of MLLA’s code comprehension layer:

- **CPUA** scouts the entry points.
- **CGPA** fetches the precise definitions.
- **MCGA** maps the relationships and danger zones.

Only after this pipeline runs can **BCDA** classify bug candidates and **BGA** generate exploit strategies.

This is why we say: **without CPUA, CGPA, and MCGA, BGA’s spectacular exploits could never exist.**

---

## **Engineering Challenges**

Building these agents was far from trivial. Some lessons from the trenches:

- **LLM Cost Control**: Call graph expansion is recursive and potentially explosive. We had to integrate caching layers and prioritize tool-based results (Joern, LSP) before falling back to LLM calls.
- **Balancing Static and Dynamic**: Pure LLM reasoning often hallucinated callees. By mixing AST parsing, coverage traces, and Joern outputs, MCGA became both faster and more accurate.
- **Asynchronous Execution**: Instead of serially building massive graphs, MCGA launches sink detections asynchronously, enabling early-stage bug discovery.
- **Context Windows**: For CPUA, harness files were often too large. We learned to slice harnesses, summarize reflection-heavy code, and feed LLMs only the most relevant chunks.

---
## **Lessons Learned**

Reflecting on this design, a few insights stand out:

1. **Groundwork Is Invisible but Essential**
    People celebrate payloads and crashes, but the real innovation is building the maps that make them possible.
2. **Machine-Guided Beats Human-Mimicry**
    Early on, we tried to mimic human auditors too literally. Later, we leaned into machine advantages — like async graph expansion and LLM-guided fuzzing integration — and saw better results.
3. **Context Engineering Is the Next Frontier**
    LLMs thrive on top-down descriptions with selective detail. Feeding call paths, tainted args, and sanitizer hints in structured form was more effective than dumping entire files.
4. **Integration Matters**    
    These agents weren’t just standalone tools; they were designed to hand off work seamlessly. CPUA’s outputs flowed into MCGA, which in turn leaned on CGPA, all culminating in BCDA and BGA.

---
## **Closing Thoughts**

In AI-assisted vulnerability discovery, flashy exploits may get the headlines. But the unsung heroes are the agents that quietly do the groundwork — mapping functions, resolving symbols, and tracing call graphs until dangerous paths come into focus.

**From harness to vulnerability, the journey is long. And without scouts, librarians, and cartographers, you’d never reach the treasure.**

The next time you see an AI exploit demo, remember: behind every successful exploit is an army of silent agents, building the maps that made it possible.

---
