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

# BLOG POST AGENDA: Context Engineering for AI Vulnerability Discovery

## Target Audience & Style
- **Primary**: ML engineers, prompt engineers, LLM application developers
- **Secondary**: Security researchers wanting implementation details
- **Tone**: Technical deep dive with practical examples
- **Style**: Tutorial-like with concrete techniques and lessons learned

## Core Structure

### 1. **Introduction: Beyond Prompt Engineering** (~300 words)
- Why "context engineering" vs "prompt engineering"
- The challenge: Teaching LLMs to understand vulnerabilities and write exploits
- Preview of techniques: XML structuring, coverage integration, domain knowledge injection
- Connection to BGA's success (link to main BGA post)

### 2. **The Context Challenge in Security AI** (~400 words)
- **Scale problem**: Massive codebases, limited context windows
- **Precision problem**: Need exact technical details, not approximations
- **Feedback problem**: LLMs need execution results to improve
- **Domain problem**: Generic LLMs lack security expertise
- Why traditional prompting approaches fail for exploit generation

### 3. **Architecture Overview: The Context Engineering Pipeline** (~300 words)
- How context flows from analysis → prompt → execution → feedback → refinement
- The role of different agents in context transformation
- Integration with execution infrastructure (coverage, Docker, validation)

### 4. **Technique 1: XML-Structured Context Design** (~600 words)
#### 4.1 Why XML Over JSON or Plain Text
- Parsing reliability for structured data
- Hierarchical organization of complex information
- Clear section boundaries for LLM comprehension

#### 4.2 Core XML Patterns in BGA
- `<SOURCE_CODE_INFO>` with function boundaries
- `<COVERAGE_INFO_FOR_KEY_CONDITIONS>` with @VISITED markers
- `<VULNERABILITY_CONTEXT>` with categorized threat information
- `<DATA_STRUCT_GUIDE>` for format-specific knowledge

#### 4.3 Real Examples
- BlobGen system prompt structure (from technical report)
- Generator planning prompt with AttributeCG integration
- Coverage feedback prompt with execution results

### 5. **Technique 2: Context Window Management** (~500 words)
#### 5.1 The Compression Challenge
- Fitting elephant-sized vulnerability contexts into mouse-sized windows
- Selective inclusion strategies (@KEY_CONDITION, @BUG_HERE filtering)
- Function boundary extraction and relevance scoring

#### 5.2 Hierarchical Context Layering
- System prompt: Role and constraints
- Context prompt: Vulnerability and code structure  
- Task prompt: Specific exploitation goals
- Feedback prompt: Execution results and refinement direction

#### 5.3 Context Optimization Techniques
- Line number formatting (`[n]:` style from RustAssistant)
- Comment annotation systems (@-prefix markers)
- Ellipsis for irrelevant code sections

### 6. **Technique 3: Coverage-Driven Context Refinement** (~600 words)
#### 6.1 The Feedback Loop Architecture
- How execution results transform into context updates
- @VISITED marker integration into source code
- Coverage diff analysis for iterative improvement

#### 6.2 Multi-Variation Context Merging (Generator)
- Aggregating insights from 20 payload variations
- Coverage summary generation and analysis
- Function prioritization based on collective results

#### 6.3 Iterative Refinement Workflows
- BlobGen: 4-iteration single payload refinement
- Generator: Multi-variation coverage analysis
- Mutator: Transition-focused context windows

### 7. **Technique 4: Domain Knowledge Integration** (~700 words)
#### 7.1 Vulnerability-Specific Context Templates
- OS Command Injection patterns and requirements
- XXE attack strategies and target domains
- Memory corruption techniques and sanitizer integration
- Deserialization exploit templates

#### 7.2 Format-Aware Context Engineering
- **FuzzedDataProvider**: Consumption patterns and libfdp integration
- **ByteBuffer**: Endianness handling and integer consumption
- **Complex formats**: ZIP+XML combinations, multipart forms
- **Binary structures**: EXIF, GZIP, protocol buffers

#### 7.3 Adaptive Context Selection
- Context-aware prompt generation based on detected patterns
- Selective domain knowledge inclusion (avoid information overload)
- Dynamic template selection based on vulnerability classification

### 8. **Technique 5: Multi-Agent Context Coordination** (~500 words)
#### 8.1 Context Transformation Between Agents
- How BCDA BITs become BGA exploitation contexts
- Orchestrator's role in context filtering and prioritization
- Information flow and context adaptation across agent boundaries

#### 8.2 Shared Context Infrastructure
- Caching strategies for repeated context elements
- Context version management and updates
- Cross-agent context consistency

#### 8.3 Concurrent Context Management
- Asyncio coordination with context isolation
- Resource management for multiple LLM calls
- Context cleanup and memory optimization

### 9. **Lessons Learned & Best Practices** (~600 words)
#### 9.1 What Worked
- XML structure reliability over JSON
- @VISITED markers for clear execution feedback
- Role-playing prompts ("You are a security researcher...")
- Chain-of-thought reasoning before code generation
- Selective context inclusion over comprehensive dumps

#### 9.2 What Failed
- Overly complex nested XML structures
- Too much context leading to diluted focus
- Generic prompting without domain knowledge
- Single-shot generation without feedback loops
- Plain text formatting for complex technical data

#### 9.3 Competition-Specific Insights
- Cost optimization strategies (prompt compression, caching)
- Speed vs accuracy trade-offs in context engineering
- Model selection impact on context effectiveness
- Real-world performance under time pressure

### 10. **Practical Implementation Guide** (~500 words)
#### 10.1 Getting Started
- Basic XML prompt structure templates
- Coverage integration setup
- Domain knowledge organization

#### 10.2 Advanced Techniques
- Context compression algorithms
- Dynamic prompt generation
- Feedback loop implementation

#### 10.3 Integration Points
- How to adapt these techniques for other domains
- Context engineering for non-security AI applications
- Scaling considerations and optimization

### 11. **Future Directions** (~300 words)
- Context engineering research opportunities
- Potential improvements based on competition experience
- Cross-domain applications of these techniques
- Integration with next-generation LLMs

### 12. **Resources & Deep Dive Links** (~200 words)
- Links to actual prompt templates from BGA source code
- Context engineering examples from technical report
- Related techniques in academic literature
- Tools and libraries for context engineering

## Key Technical Examples to Include

1. **Complete BlobGen System Prompt** with XML structure analysis
2. **Generator Coverage Integration** showing 20-variation feedback processing
3. **Domain Knowledge Templates** for different vulnerability types
4. **Context Compression Examples** showing before/after optimization
5. **Multi-Agent Context Flow** from BCDA BIT to BGA exploitation
6. **Real Coverage Feedback** with @VISITED markers and execution results

## Visual Elements
- Context engineering pipeline diagram
- XML structure breakdown with annotations
- Before/after context optimization examples
- Multi-agent context transformation flowchart
- Coverage feedback integration visualization

## Connection Points
- Link back to main BGA blog post for system overview
- Reference specific agents and their context needs
- Show how context engineering enabled the 7 vulnerability discoveries
- Connect to broader MLLA and UniAFL systems

## Key Messages
- Context engineering is more precise than prompt engineering
- Structure and feedback loops are crucial for technical AI applications
- XML provides reliable parsing for complex technical context
- Domain knowledge integration requires careful balance
- Real-world results validate these techniques

This blog post will serve as a comprehensive guide for implementing advanced context engineering techniques in LLM applications, using BGA's proven success as a case study while providing broadly applicable insights for other domains.
