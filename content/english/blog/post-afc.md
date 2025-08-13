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

Two years after its first announcement at [DEF CON 31](https://aicyberchallenge.com/), 
our team stood on stage as the winners of the AIxCC Final—a moment we had been working toward 
since the competition began.

Yet when we heard we placed 1st, relief overshadowed excitement. 
Why? While competing head-to-head with world-class teams like [Theori](https://theori.io/blog/aixcc-and-roboduck-63447) 
was a privilege, the real-time, long-running nature of this competition 
demanded extreme engineering reliability alongside novel approaches to succeed.

Balancing innovation with stability under time pressure 
proved our greatest challenge. 
We simply hoped our Cyber Reasoning System (CRS) would run as intended—
but it exceeded expectations, outperforming other teams 
in most categories by significant margins.

In this post, I'll answer the most common questions we received from the DEF CON audience 
and share the story behind our victory.

{{< image src="images/blog/afc/announcement.jpg" width="1000" position="center" class="img-fluid" >}}

<div style="display: flex; justify-content: center; gap: 10px;">
<iframe width="1000" height="562" src="https://www.youtube.com/embed/21Zrj632Y1I?si=D4tQ1bvsnbNRD7Zm" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

## L0. The Bug That Almost Ended Everything

Why were we so anxious despite our confidence?
In this competition, a single bug can be fatal.
One line of code nearly destroyed our chances.

We discovered this critical bug during integration testing—
just hours after submitting our final version,
and mere hours before the deadline.
The problematic code was designed to **skip** patch generation 
for fuzzing harnesses.
In all previous challenge projects and our benchmarks,
fuzzing harness source files contained "fuzz" in their paths
(e.g., "fuzz/" or "http_request_fuzzer.cc" in nginx)—
a simple but effective heuristic to avoid false positives.

The problem? During our final integration test,
we discovered the organizers had prefixed all OSS-Fuzz projects
with "ossfuzz" (e.g., "r3-ossfuzz-sqlite3").
The irony wasn't lost on us—here we were,
building an *autonomous* CRS powered by state-of-the-art AI,
nearly defeated by a string matching bug.

{{< image src="images/blog/afc/patch-crs-bug.png" width="1000" position="center" class="img-fluid" >}}
