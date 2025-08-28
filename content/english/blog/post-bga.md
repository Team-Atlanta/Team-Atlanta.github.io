---
title: "BGA: Self-Evolving Exploits Through Multi-Agent AI"
meta_title: ""
description: "How BGA's multi-agent AI framework creates self-evolving exploits that adapt and improve through coverage feedback - discovering 7 critical vulnerabilities through intelligent iteration"
date: 2025-08-27T21:00:00Z
image: "/images/blog/mlla/bga_preview.png"
categories: ["Atlantis-Multilang"]
author: "Dongkwan Kim"
tags: ["mlla", "llm", "exploit-generation", "multi-agent", "bga"]
draft: true
---

## Why Programs Beat Payloads

We'll never forget the moment we realized we were asking LLMs the wrong question. Picture this: you need an exploit with exactly 1000 'A' characters followed by shellcode. Ask an LLM to generate it directly, and you might get 847 A's, maybe 1203 A's – never quite right. But ask it to write `payload = "A" * 1000 + shellcode`, and you get perfection every time.

This insight sparked our breakthrough during the AIxCC competition. Instead of hoping AI could guess the right attack data, we taught it to write programs that create that data. The result? **BlobGen found 2 vulnerabilities. Generator found 4. Mutator found 1.** Seven exploits that evolved and adapted until they found their targets.

The Blob Generation Agent (BGA) framework works on a simple principle: exploits that can rewrite themselves based on what they learn are far more effective than static attacks. Each agent approaches this self-evolution differently – some refine single payloads through iterative feedback, others generate variations and learn from collective results, still others perform surgical modifications on existing inputs.

What emerged was a system where exploits literally evolve in real-time, getting smarter with each execution until they crack their target.

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

## The Four Specialists: Brief Overview

The BGA framework coordinates four specialist agents, each with a different strategy for creating self-evolving exploits. Rather than competing, they complement each other – covering different vulnerability landscapes through distinct adaptation mechanisms.

**🎭 Orchestrator Agent**: The strategic commander that receives vulnerability reports, filters redundant work, and dispatches contexts to specialized agents concurrently. It ensures no resource exhaustion and manages the coordination of all exploitation attempts.

**🎯 BlobGen Agent**: The precision sniper that creates Python scripts generating targeted binary payloads. It refines single payloads through up to 4 iterations based on coverage feedback, perfect for known vulnerability paths with strict format requirements.

**🎲 Generator Agent**: The probability explorer that creates generator functions producing 20+ payload variations per iteration. It turns LLM non-determinism from weakness into strength through systematic exploration, ideal for complex formats and multiple valid attack paths.

**🔧 Mutator Agent**: The surgical specialist that focuses on single function transitions when full vulnerability context would exceed LLM limits. It creates targeted mutations for specific transitions, handling deep call graphs with precision.

## Building the Agents: The Development Journey

### 🎭 Orchestrator Agent: Strategic Commander

When we started building BGA, we quickly realized that before any exploit gets crafted, something needed to take command of the operation. The Orchestrator Agent became our mission control for vulnerability exploitation.

The Orchestrator receives Bug Inducing Things (BITs) from upstream analysis – detailed vulnerability reports with call paths, trigger conditions, and annotated code. But not every BIT deserves attention. The Orchestrator filters aggressively:
- Eliminates transitions already covered by previous fuzzing
- Removes duplicates across different call graphs
- Filters out paths without conditional branches (no mutation opportunities)
- Prioritizes high-value targets from recent code changes

Once filtered, it transforms raw BITs into specialized contexts for each agent and dispatches work concurrently using asyncio. One BIT might spawn multiple exploitation attempts across different agents, all running in parallel. The Orchestrator ensures no resource exhaustion, no redundant work, and no cascade failures.

### 🎯 BlobGen Agent: The Precision Sniper

BlobGen became our precision instrument – when you know exactly where the vulnerability is and need a perfect shot to trigger it. This agent specializes in generating Python scripts that create targeted binary payloads, then iteratively refining them through coverage feedback.

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

**Coverage Intelligence**: We used line coverage information consisting of hit file name, function name, and line number to guide the evolution process. While this coverage data wasn't always perfectly accurate, it provided crucial guidance for the LLM during iterative refinement, helping it understand which parts of the target code were being reached and which critical paths remained unexplored.

**Example Approach: Apache Commons Compress GZIP**
```python
def create_payload() -> bytes:
    payload = bytearray()
    
    # GZIP magic bytes (required to pass format check)
    payload.extend([0x1f, 0x8b])  # .ID1, .ID2
    payload.append(8)     # Compression (DEFLATED)
    payload.append(0x08)  # FNAME flag set
    
    # Vulnerability condition: exact timestamp
    mod_time = 1731695077  # Vulnerability trigger
    payload.extend(struct.pack('<I', mod_time))
    
    payload.extend([0x00, 0x00])  # Extra flags
    
    # Filename section - exact command for sanitizer
    filename = b"jazze"   # Required by jazzer
    payload.extend(filename)
    payload.append(0x00)  # Null terminator
    
    # Complete GZIP structure with minimal data
    payload.extend([0x03, 0x00])  # Minimal data
    payload.extend([0x00, 0x00, 0x00, 0x00])  # CRC32
    payload.extend([0x00, 0x00, 0x00, 0x00])  # ISIZE
    
    return bytes(payload)
```

Notice the surgical precision: exact modification time, specific filename pattern, proper GZIP structure. BlobGen discovered these requirements through iterative coverage analysis, using the line-level coverage data (file names, function names, and line numbers) to add `@VISITED` markers and track progress toward the vulnerability.

**When BlobGen Wins:** Known vulnerability path, strict format requirements, need for precise value combinations.

### 🎲 Generator Agent: The Probability Explorer

Generator discovered something counterintuitive: when you can't predict which attack will succeed, systematic variation beats precision. This agent probabilistically reaches target vulnerability points through multiple payload variations rather than hoping for one perfect attempt.

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
    # Strategy selection for XXE attack variations
    strategy = rnd.choice([
        'basic_xxe',
        # ... (other strategies) ...
    ])
    root_filename = rnd.choice([
        'root.xml',
        # ... (other filenames) ...
    ])
    
    # Create Manifest.xml content
    manifest_content = f'''
<?xml version="1.0" encoding="UTF-8"?>
<manifest><Root>{root_filename}</Root></manifest>
'''.encode('utf-8')
    
    # Generate exploit payload based on strategy
    if strategy == 'basic_xxe':
        port = rnd.choice([80, 443, 8080])
        root_content = f'''
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root
  [<!ENTITY xxe SYSTEM "http://jazzer.com:{port}">]>
<root>&xxe;</root>'''.encode('utf-8')

    # ... (other strategies) ...
    
    # Build ZIP file with exploit payloads
    files = [
        ('Manifest.xml', manifest_content),
        (root_filename, root_content)
    ]
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

Mutator tackles a different problem: what happens when vulnerability paths are so complex that even LLMs can't hold the entire context? Its solution is elegant – focus on single transitions between functions rather than trying to comprehend the whole picture.

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
    if len(seed) < 16:
        return seed + b'\x00' * (16 - len(seed))
    
    # Find EXIF header and Makernote section
    exif_pos = seed.find(b'Exif\x00\x00')

    # ... (boundary check) ..
    
    makernote_pos = _find_makernote_start(
                        seed, tiff_start
                    )

    # ... (prefix setup) ...
    
    # Apply format-specific mutations
    mutated_body = _mutate_makernote(rnd, body)
    result = prefix + mutated_body
    
    return result[:min(len(result), 102400)]

def _mutate_makernote(rnd, body):
    strategy = rnd.randint(0, 3)
    
    if strategy == 0:    # Mutate directory counts
        return _mutate_directory_counts(rnd, body)
    elif strategy == 1:  # Create oversized fields
        return _mutate_field_sizes(rnd, body)
    elif strategy == 2:  # Corrupt offset values
        return _mutate_offsets(rnd, body)
    else:  # Generic byte-level mutations
        return _byte_mutations(rnd, body)

# ... (helper functions) ...
```

**Why Mutator Succeeded:** When dealing with deep call chains where understanding the full context would overwhelm even the most capable LLM, Mutator's focused approach shines. It doesn't need to understand the entire vulnerability – just how to navigate from function A to function B.

**When Mutator Wins:** Deep call graphs, context limitations, specific transition requirements.

## Competition Results and Technical Analysis

### Seven Critical Discoveries

The AIxCC competition provided a real-world test of the self-evolving exploit approach. In the Final Final round, BGA discovered **7 unique vulnerabilities** – genuine bugs in production software that other approaches had not identified.

{{< image src="images/blog/bga/scoreboard.png" caption="BGA's contribution to Team Atlanta's success" >}}

These discoveries validate the multi-agent, script-based approach, though the specific code examples shown throughout this post come from earlier development and rounds, illustrating how the techniques work in practice.

### System in Action: How Four Strategies Work Together

An interesting question emerged during development: why not just use the most successful approach (Generator) for everything? The answer lies in how different vulnerability types require different evolutionary strategies.

**Complementary Evolution Patterns**: Each agent embodies a distinct adaptation mechanism – BlobGen provides iterative refinement, Generator offers probabilistic exploration, and Mutator enables surgical precision. These patterns address fundamentally different challenges in exploit development.

**Real-World Workflow**: When vulnerability candidates arrive from upstream analysis, the Orchestrator analyzes each BIT and dispatches work concurrently: BlobGen handles precise conditions, Generator tackles complex paths with multiple variations, and Mutator focuses on specific function transitions. All three agents work simultaneously using asyncio, launching different exploitation approaches in parallel while maintaining resource limits.

### Technical Innovations That May Have Contributed

Our analysis suggests several technical factors may have enabled these discoveries:

**Script-Based Generation**: Instead of generating raw payloads, the system creates Python programs that construct exploits programmatically. This enables handling complex formats, incorporating dynamic values, and documenting reasoning in code.

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

**Collective Learning from Execution**: Rather than learning only from successes, the system analyzes patterns across all variations:

```xml
<COVERAGE_SUMMARY>
Primary Coverage (Functions in target call path):
- Functions: 5, Files: 3, Lines: 287
Changes in Entire Coverage:
- Newly covered: 2 functions in 2 files (+41 lines)
- parseHeader: 23 more lines, validateFormat: 18 more lines
</COVERAGE_SUMMARY>
```

**Multi-Agent Coordination**: Building effective multi-agent LLM coordination required solving several engineering challenges including context management through intelligent compression, safety isolation in Docker containers, and domain knowledge integration with specialized security patterns.

### What We Think Made the Difference

The discoveries appear to benefit from characteristics that favor adaptive approaches:

1. **Format Complexity**: Multi-layer format requirements (valid ZIP containing valid XML containing valid XXE) that challenge traditional random approaches
2. **Semantic Requirements**: Understanding that specific functions execute commands or that certain values trigger vulnerabilities
3. **Precision Constraints**: Exact checksums, specific string patterns, correct binary structures  
4. **Multiple Valid Attack Paths**: Different strategies leading to the same vulnerability

We believe traditional approaches would require millions of attempts to accidentally discover these combinations, while the self-evolving approach found them more systematically through code understanding, execution feedback, and adaptive strategy refinement.

## Lessons Learned: Key Insights from Development

Developing BGA revealed several critical insights about LLM-based security research and multi-agent coordination:

### Context Management and LLM Limitations

We discovered that LLM context limitations aren't just about token counts – they're about meaningful reasoning boundaries. The Mutator Agent's focused transition analysis emerged from recognizing that trying to understand entire call graphs often overwhelmed the LLM's ability to provide precise analysis. By concentrating on single function transitions, we achieved surgical precision that wouldn't be possible with broader context.

### Script-Based vs Direct Generation

The shift from generating raw payloads to generating Python scripts that create payloads was transformative. LLMs excel at code generation and logical reasoning but struggle with precise binary format construction. By asking for executable exploit recipes rather than raw exploits, we leveraged LLM strengths while avoiding their weaknesses in exact format compliance.

### Multi-Agent Coordination Challenges

Coordinating multiple LLM agents requires solving problems that don't exist in single-agent systems. We learned that:

- **Fault Isolation** is critical – one agent's failure cannot cascade to others
- **Resource Management** through semaphore-based concurrency control prevents system exhaustion
- **Context Transformation** requires tailoring information for each agent's specialized needs
- **Intelligent Filtering** eliminates redundant work that would waste computational resources

### Domain Knowledge Integration

Rather than overwhelming LLMs with comprehensive security knowledge, we found that adaptive, context-sensitive guidance works better. The system selectively integrates vulnerability patterns and data structure insights based on target-specific analysis, preventing information overload while ensuring relevant knowledge reaches the agents.

### Probabilistic Success vs Deterministic Failure

The Generator Agent taught us that embracing LLM non-determinism through systematic variation is more effective than fighting it. Instead of trying to generate one perfect payload, generating 20 targeted variations dramatically increases success probability while providing collective learning opportunities.

*For a deep dive into the context engineering techniques that enable these capabilities, see our upcoming post: "Context Engineering: How BGA Teaches LLMs to Write Exploits"*

## Future Vision: Where BGA Goes Next

BGA's success in AIxCC is just the beginning. Here's where this technology is heading:

### Immediate Improvements
- **Cross-Agent Learning**: Successful strategies from Generator inform BlobGen's refinement
- **Adaptive Selection**: Orchestrator learns which agent types work best for specific vulnerability classes
- **Context Optimization**: Better compression techniques for larger codebases

### Revolutionary Possibilities
- **Self-Improving Agents**: Scripts that modify themselves based on execution results
- **Collaborative Human-AI**: Security researchers guiding agent strategies in real-time
- **Cross-Language Mastery**: Extending beyond C/Java to Rust, Go, Python
- **Defensive Applications**: Using BGA to automatically generate patches

### The Broader Impact

BGA proves that AI can do more than assist security research – it can fundamentally transform how we approach vulnerability discovery. The script-based generation paradigm could extend beyond security to any domain where complex test generation is needed.

## Dive Deeper

Ready to explore BGA in detail? Here are your next steps:

### 📚 **Technical Resources**
- **Source Code by Agent:**
  - [Orchestrator Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/orchestrator_agent)
  - [BlobGen Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/blobgen_agent)
  - [Generator Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/generator_agent)
  - [Mutator Agent](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/blob-gen/multilang-llm-agent/mlla/agents/mutator_agent)
- [libfdp library for FuzzedDataProvider handling](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-multilang/libs/libFDP)

### 🔗 **Related Deep Dives**
- [MLLA Overview: The Complete System](https://team-atlanta.github.io/blog/post-mlla-overview/)
- [UniAFL: The Fuzzing Infrastructure](https://team-atlanta.github.io/blog/post-crs-multilang/)
- Coming Soon: "Context Engineering: How BGA Teaches LLMs to Write Exploits"
- Coming Soon: "Inside BCDA: How AI Detects Real Vulnerabilities"

---

**The Bottom Line:** BGA discovered 7 critical vulnerabilities through self-evolving exploits that adapt and improve based on execution feedback. Generator's probabilistic approach led with 4 discoveries, while BlobGen's iterative refinement and Mutator's surgical precision each contributed their own successes. The results suggest that teaching AI to write programs that create exploits, rather than generating static payloads, opens new possibilities for intelligent vulnerability discovery.

Self-evolving exploits represent a different approach to AI-assisted security research – one where adaptation and learning drive success rather than hoping for perfect initial generation.
