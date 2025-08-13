---
title: "AIxCC Final and Team Atlanta"
meta_title: ""
description: "Atlantis in CTF competitions"
date: 2025-08-12T12:15:00Z
image: "/images/blog/afc/afc-team.jpeg"
categories: ["Milestone"]
author: "Taesoo Kim"
tags: ["ASC"]
draft: false
---

Let me first share our exciting moment with you at DEF CON! 
This is our long waiting moment 
since its first announcement in [DEF CON 31](https://aicyberchallenge.com/), 
precisely two years ago.
It's exciting, but more relaxed moment to our team
when we heard we placed 1st in the final.
Why? 
It's privileged
to compete with world-class hackers like [Theori](https://theori.io/blog/aixcc-and-roboduck-63447)
head-to-head,
but its realtime, long-running nature of the competition
requires lots of dedication in engineering 
for its reliability
and novel approaches to win ultimately.

Balancing two, given the limited time budget,
is always challenging to us,
and simply wished
our CRS runs as intended.
Surprised! our CRS outperformed other teams 
in most categories by a large margin.
In this blog, 
I'd like to answer some of the most commonly questions we heard from DEF CON audience.

{{< image src="images/blog/afc/announcement.jpg" width="1000" position="center" class="img-fluid" >}}

<div style="display: flex; justify-content: center; gap: 10px;">
<iframe width="1000" height="562" src="https://www.youtube.com/embed/21Zrj632Y1I?si=D4tQ1bvsnbNRD7Zm" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

Wait, why were we concerned so much?
A tiny mistake 
can kill the copmetition.
This single line nearly kills our CRS.
We discovered this bug 
during the integration testing 
after submitting the last version,
a few hours before the final deadline.
This code is meant to **skip** patch generation 
on fuzzing harnesses.
In all challenge projects (CP) in each round and even our benchmarks,
the source file of the fuzzing harnesses 
contain the "fuzz" string in its path
(e.g., "fuzz/" or "http_request_fuzzer.cc" in nginx).
Simple, but effective way of avoiding flase positive.
Why was it a problem? 
During the last integration testing of the submitted CRS,
merely a few hours before the deadline,
we discovered that the organizers put a prefix of "ossfuzz"
(e.g., "r3-ossfuzz-sqlite3")
for each CP from the oss-fuzz projects!
It's irony that
we are building an *autonomous* CRS
with the state-of-the-art AI.

{{< image src="images/blog/afc/patch-crs-bug.png" width="1000" position="center" class="img-fluid" >}}

## L0. System robustness is priority 1.

A single bug can kill the CRS, period. It's that brittle. 
Then, how to balance engineering for robustness 
vs. novel research for winning.
Our CRS, Atlantis, 
consists of *various* CRSs
that were designed independently
by each groups, say C, Java, Multilang, Patch, and SARIF teams.
Each team deliverately 
took orthogonal approaches.
For example, 
our bug finding CRS 
consists of three different CRSs:
Atlantis-multilang, 
which originally designed to be robust and perform bug finding in a language agnostic manner,
and Atlantis-C and Atlantis-Java
tailored for C and Java respectively.

{{< image src="images/blog/afc/design-overview.png" width="1000" position="center" class="img-fluid" >}}

In comparison, 
Atlantis-C ..

Talk about:

N-versioning for fault tolerant – minimal sharing among CRSs
Intentionally made many orthogonal design decisions
For each of C/Java, we prepared traditional tools:
  - Ensemble fuzzer: libafl, libfuzzer, afl++, custom Jazzer, custom format
  - Concolic executor: SymCC for C and in-house implementation for Java
  - Directed fuzzer: in-house implementation for C and Java

