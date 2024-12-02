---
title: "Hacking Redefined: How LLM Agents Took on University Hacking Competition"
meta_title: ""
description: "Atlantis in CTF competitions"
date: 2024-12-01T12:15:00Z
image: "/images/blog/tkctf2024/ai-vs-human.png"
categories: ["CTF", "Analysis"]
author: "Hanqing Zhao"
tags: ["Atlantis CRS"]
draft: Yes
---

For the first time, 
we deployed our hybrid system powered by LLM agents, [Atlantis](/blog/post-atl), 
to participate in Georgia Tech’s flagship CTF competition, 
[TKCTF 2024](https://tc.gts3.org/cs6265/2024-fall/ctf.html).

During the competition, 
Atlantis focused on two key areas: 
vulnerability analysis and automatic vulnerability remediation. 
Impressively, our system identified 10 vulnerabilities and 
generated 7 sound patches[^1], 
demonstrating the effectiveness of our approach in a real-world challenge.

In this blog, 
I’ll share some interesting observations and key lessons we learned during the CTF. 
Notably, following the AIxCC competition, 
we plan to open-source all the details of our system, 
in line with AIxCC competition rules.

While this might seem like just another step forward for CTF competitions, 
it represents a significant milestone in our journey toward advancing LLM-based security research. 
The achievements of Atlantis at TKCTF would not have been possible without 
the dedication and expertise of our incredible team:
[Andrew Chin](/authors/andrew-chin),
[Jiho Kim](//authors/seunggi-min/),
[Gyejin Lee](/authors/seunggi-min/),
[Seunggi Min](/authors/seunggi-min/),
[Kevin Stevens](/authors/seunggi-min/),
[Woosun Song](/authors/seunggi-min/), and
[Hanqing Zhao](/authors/seunggi-min/),

We invite you to follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
to stay updated on our work at the intersection of AI and security.

[^1]: Fully sound patches not only address the actual root causes
but also keep the correct behaviors.

## AIxCC, Atlantis CRS, and CTF



## Interesting Challenges Solved by Atlantis

### Maze Puzzles


<details>
  <summary>Click me to show the maze puzzle </summary>

```c

```
</details>


## Case Studies: How Atlantis Patches Vulnerabilities

## Team Atlanta's Next Steps
Frankly,
Atlantis still has a long way to go to be a seamless autonomous CTF competitor,
which is also one of our team's goals.

Specifically,
we are working on the following improvements:
- Binary analysis for better vulnerability understanding:
Currently, Atlantis can only support source code repos,
which limits its capability in CTF competitions.
- Automatic Exploit Generation; 
At the moment, Atlantis can only generate Proof-of-Concept (PoC) code to trigger vulnerabilities,
which is far from a real exploit.
- Customized LLM models:
We're working on customizing LLM models for better security analysis purpose,
which can, ideally, reduce the requirements of sophisticated prompts and
reduce the complexity of our system, and thus make it faster and more accessible.

## The Author's Random Thoughts
By leveraging generative AI models (GenAI) as "high-level" static analysis tools, 
we can significantly enhance automated bug finding,
thanks to their proficiency in code explanation. 
For example, 
complex program analysis tasks such as points-to analysis and inter-procedural analysis, 
which are challenging for traditional compilers, 
can be approached differently using GenAI through retrieve-augmented generation (RAG).
Additionally, 
GenAI opens new possibilities for automatic exploit generation and 
vulnerability remediation due to its strong capabilities in code writing.

However, GenAI is not a cure-all and is far from perfect. 
That's why our hybrid system is designed to improve GenAI's performance 
in security research by addressing common issues such as LLM hallucinations, 
scalability, and domain-specific challenges for particular software.

AIxCC has provided our team with a fantastic opportunity to put into practice 
the insights gained from decades of security research in both academia and industry. 
If you're interested in learning more about our team 
and the work done by our [team members](/authors), please feel free to 
[contact us](mailto:aixcc-atl@googlegroups.com)! 

Follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
if you're interested in AI or security.
