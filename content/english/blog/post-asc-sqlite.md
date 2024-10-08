---
title: "Autonomously Uncovering and Fixing a Hidden Vulnerability in SQLite3 with an LLM-Based System"
meta_title: ""
description: "SQLite3 in ASC"
date: 2024-08-28T12:15:00Z
image: "/images/blog/asc-sqlite/sqlite-bug-finding.png"
categories: ["Vulnerability Analysis"]
author: "Hanqing Zhao"
tags: ["Atlantis CRS"]
draft: false
---

Without knowing beforehand that the challenge project involved SQLite3, 
our team, [Team Atlanta](/authors), entered our Cyber Reasoning System (CRS), 
named Atlantis, 
into the [AI Cyber Challenge](https://aicyberchallenge.com/) 
organized by ARPA-H, DARPA, and the 
[White House](https://www.whitehouse.gov/briefing-room/statements-releases/2023/08/09/biden-harris-administration-launches-artificial-intelligence-cyber-challenge-to-protect-americas-critical-software/).

Remarkably, 
Atlantis secured six first-bloods and
autonomously identified and patched a real bug in SQLite3[^1], 
earning us a $2 million prize and a place in the grand finals of AIxCC. 
For more details, check out our [team's announcement blog](/blog/post-atl).

In this blog, 
we will outline our very high-level approach to using LLMs for bug detection and 
vulnerability remediation, 
provide an analysis of the fixed SQLite3 vulnerability, 
and discuss the challenges of using our LLM agents for such fixes.

Follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
if you're interested in AI or security.

[^1]: Discovering previously unknown bugs does not count as a valid score in the competition. 
Team Atlanta secured a finalist spot by submitting the intended bugs and patches for AIxCC.


## The Atlantis Cyber Reasoning System

Atlantis is a end-to-end, 
large language model (LLM)-based bug-finding and 
fixing system designed to function entirely without human intervention.
It is capable of handling complex systems like the Linux kernel and
supports a range of modern programming languages, including C/C++, Java, and others.

Our design philosophy is simple: 
to emulate the mindset of experienced security researchers and 
hackers through LLM agents, 
enhanced with advanced program analysis techniques.

Atlantis is specifically designed to replicate the behavior of human researchers, 
particularly in auditing the Git repositories of open-source software (OSS).
To harness the full potential of LLMs and 
address their limitations in tackling complex problems, 
we incorporate traditional program analysis techniques 
(both dynamic and static) to assist LLMs in decision-making.

One of the interesting features of Atlantis is 
our "baby-security-AGI" system, 
which can emulate the code auditing process based on 
the habits of the security experts on our team. 
It's not magic; we've distilled our collective experience and common practices in
manual auditing and reverse engineering into structured prompts, 
significantly enhancing the system's capabilities.

All source code will be open-sourced in accordance with the AIxCC competition rules.


## The Off-by-One Access in SQLite3

The hidden vulnerability was discovered in the 
[FTS5 module](https://www.sqlite.org/fts5.html) 
of SQLite3 
([link](https://sqlite.org/forum/forumpost/171bcc2bcd)). 
The bug is located in the trigram tokenizer, 
which processes each contiguous sequence of three characters as a token, 
enabling FTS5 to support more general substring matching.

When creating a virtual table, 
users can specify options in the `trigram` field (e.g., `case_sensitive 1`)
as outlined in the [documentation](https://www.sqlite.org/fts5.html). 

However, if users fail to provide key-value pairs, 
SQLite3 does not adequately check for this and assumes that the value is present. 
This assumption can lead to an off-by-one access error. 
Because SQLite3 allocates a sufficient heap buffer in such cases, 
the off-by-one access is confined to the space within an allocated heap chunk. 
Additionally, due to SQLite's good coding practices, 
it uses `MallocZero` to ensure no uninitialized variables exist, 
which ultimately results in a zero pointer dereference.


<details>
  <summary>Click me to show the vulnerable code in SQLite3 </summary>

```c
static int fts5TriCreate(
  void *pUnused,
  const char **azArg,
  int nArg,
  Fts5Tokenizer **ppOut
){
  int rc = SQLITE_OK;
  TrigramTokenizer *pNew = (TrigramTokenizer*)sqlite3_malloc(sizeof(*pNew));
  UNUSED_PARAM(pUnused);
  if( pNew==0 ){
    rc = SQLITE_NOMEM;
  }else{
    int i;
    pNew->bFold = 1;
    pNew->iFoldParam = 0;
    for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
      const char *zArg = azArg[i+1]; <---- off-by-one
      if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
        if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){ <----null dereference 
          rc = SQLITE_ERROR;
        }else{
          pNew->bFold = (zArg[0]=='0');
        }
      }else if( 0==sqlite3_stricmp(azArg[i], "remove_diacritics") ){
        if( (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){ <--
          rc = SQLITE_ERROR;
        }else{
          pNew->iFoldParam = (zArg[0]!='0') ? 2 : 0;
        }
      }else{
        rc = SQLITE_ERROR;
      }
    }

    if( pNew->iFoldParam!=0 && pNew->bFold==0 ){
      rc = SQLITE_ERROR;
    }

    if( rc!=SQLITE_OK ){
      fts5TriDelete((Fts5Tokenizer*)pNew);
      pNew = 0;
    }
  }
  *ppOut = (Fts5Tokenizer*)pNew;
  return rc;
}
```
</details>

Working proof-of-concepts (PoCs) to trigger the bug are as follows:

```sql
PoC 1: CREATE VIRTUAL TABLE t USING fts5(s, tokenize='trigram case_sensitive');
PoC 2: CREATE VIRTUAL TABLE t USING fts5(s, tokenize='trigram remove_diacritics');
```

While human researchers might consider this bug trivial, 
I am still pleased that our system enabled us to be the only team 
to discover a real bug—even without knowing that the challenge project was SQLite3.

## Auto-Generated Patch vs Human-Write Patch

Automatically patching the aforementioned bug is challenging 
because a perfect patch[^2] requires the human or AI patcher to understand that 
the arguments are paired and that the null pointer dereference results from
an off-by-one heap access within a glibc-allocated heap chunk.

In other words, the actual root cause is a semantic inconsistency 
concerning the paired arguments. 
Therefore, the patcher needs to recognize that 
the code must verify if the number of arguments is even.

[^2]: The word "perfect patch" is a vague concept in my mind.
To clarify, a patch should comprehend the context and semantics of the program
and address the actual root causes rather than merely adding superficial checks to 
bypass address sanitizers ([ASAN](https://clang.llvm.org/docs/AddressSanitizer.html)).

### Generating Patches Using a Naive Zero-Shot Prompt 

To get a basic sense of how LLMs reason about patch generation, 
I asked the models to analyze the root cause and generate a patch for 
the given bug using the crash logs, PoCs, 
and the code of the `fts5TriCreate()` function.

<details>
  <summary>A patch generated by Claude 3.5 sonnet</summary>

```diff
--- a/sqlite3.c
+++ b/sqlite3.c
@@ -255841,7 +255841,7 @@ static int fts5TriCreate(
     for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
       const char *zArg = azArg[i+1]; 
       if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
-        if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){ 
+        if( !zArg || (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){ 
           rc = SQLITE_ERROR;
         }else{
           pNew->bFold = (zArg[0]=='0');
@@ -255849,7 +255849,7 @@ static int fts5TriCreate(
       }else if( 0==sqlite3_stricmp(azArg[i], "remove_diacritics") ){
-        if( (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){ 
+        if( !zArg || (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){ 
           rc = SQLITE_ERROR;
         }else{
           pNew->iFoldParam = (zArg[0]!='0') ? 2 : 0;
```
</details> 

<details>
  <summary>A patch generated by ChatGPT 4o</summary>

```diff
--- a/sqlite3.c
+++ b/sqlite3.c
@@ -255835,11 +255835,15 @@
     pNew->iFoldParam = 0;
     for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
       const char *zArg = azArg[i+1]; 
-      if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
+      if( i+1 >= nArg || azArg[i+1] == NULL ){
+        rc = SQLITE_ERROR;
+      }else if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
         if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){ 
           rc = SQLITE_ERROR;
         }else{
           pNew->bFold = (zArg[0]=='0');
         }
       }else if( 0==sqlite3_stricmp(azArg[i], "remove_diacritics") ){
         if( (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){ 
           rc = SQLITE_ERROR;
```
</details> 


The patches are fairly close to "good patches," 
and the models almost identify the root causes. 
However, due to my simple zero-shot prompt, 
there are still a few minor issues. 
For example, 
the patch generated by Claude effectively mitigates the bug by ensuring that 
a null pointer is always handled when the bug is triggered, 
but it doesn't fully address the off-by-one root cause. 
The patch generated by GPT-4o addresses the bounds check but 
only covers the `case_sensitive` branch, missing the `remove_diacritics` branch.

Nonetheless, the results are promising given that a simple prompt was used, 
and the LLMs almost arrived at the correct solution. 
However, in real-world scenarios, 
patch generation can be much more challenging, 
as it requires 
locating the source code of the vulnerable parts in a large codebase, 
dealing with indeterminate results, 
handling hallucinations, 
and validating correctness, among other issues.

### Patch Generated by Atlantis CRS

Atlantis CRS generates patches by 
incrementally applying domain-specific knowledge with multiple LLM agents and 
iteratively refining them using a custom validation oracle. 
The patch generated by Atlantis is as follows:

```diff
diff --git a/ext/fts5/fts5_tokenize.c b/ext/fts5/fts5_tokenize.c
index f12056170..552f14be9 100644
--- a/ext/fts5/fts5_tokenize.c
+++ b/ext/fts5/fts5_tokenize.c
@@ -1299,8 +1299,10 @@ static int fts5TriCreate(
     pNew->bFold = 1;
     pNew->iFoldParam = 0;
     for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
-      const char *zArg = azArg[i+1];
-      if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
+      const char *zArg = (i+1 < nArg) ? azArg[i+1] : NULL;
+      if (zArg == NULL) {
+        rc = SQLITE_ERROR;
+      } else if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
         if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){
           rc = SQLITE_ERROR;
         }else{
```

The auto-generated patch successfully checks 
the bounds and provides additional protection against null pointer dereference. 
In this case,
Atlantis spent ~15 minutes for the entire building, patch generation, 
iteration, and correctness-validation process, 
demonstrating its promising potential for application to real-world software.

Admittedly, 
our patching techniques are still in their prototype stages, 
as we require more time to apply and evaluate the many new ideas we have. 
However, 
the patch above illustrates that 
LLM-based automated vulnerability remediation is a very feasible direction.

Thanks [Seunggi](/authors/seunggi-min/) for collecting the statistics when patching the bug.

### Official SQLite3 patch

<details>
  <summary>Click me to show SQlite3's official patch</summary>

```diff
commit e9b919d550262076d1b8453c3d6852b88822b922
Author: drh <>
Date:   Tue Aug 6 22:49:01 2024 +0000

    Improved robustness of parsing of tokenize= arguments in FTS5.
    [forum:/forumpost/171bcc2bcd|Forum post 171bcc2bcd].

    FossilOrigin-Name: d9f726ade6b258f8723f90d0b04a4682e885e30939eb29773913e4dfc8e85503

diff --git a/ext/fts5/fts5_tokenize.c b/ext/fts5/fts5_tokenize.c
index 3e9fdff3e..08de0d60d 100644
--- a/ext/fts5/fts5_tokenize.c
+++ b/ext/fts5/fts5_tokenize.c
@@ -79,7 +79,7 @@ static int fts5AsciiCreate(
       int i;
       memset(p, 0, sizeof(AsciiTokenizer));
       memcpy(p->aTokenChar, aAsciiTokenChar, sizeof(aAsciiTokenChar));
-      for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
+      for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
         const char *zArg = azArg[i+1];
         if( 0==sqlite3_stricmp(azArg[i], "tokenchars") ){
           fts5AsciiAddExceptions(p, zArg, 1);
@@ -90,6 +90,7 @@ static int fts5AsciiCreate(
           rc = SQLITE_ERROR;
         }
       }
+      if( i<nArg ) rc = SQLITE_ERROR;
       if( rc!=SQLITE_OK ){
         fts5AsciiDelete((Fts5Tokenizer*)p);
         p = 0;
@@ -381,17 +382,16 @@ static int fts5UnicodeCreate(
       }

       /* Search for a "categories" argument */
-      for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
+      for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
         if( 0==sqlite3_stricmp(azArg[i], "categories") ){
           zCat = azArg[i+1];
         }
       }
-
       if( rc==SQLITE_OK ){
         rc = unicodeSetCategories(p, zCat);
       }

-      for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
+      for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
         const char *zArg = azArg[i+1];
         if( 0==sqlite3_stricmp(azArg[i], "remove_diacritics") ){
           if( (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){
@@ -416,6 +416,7 @@ static int fts5UnicodeCreate(
           rc = SQLITE_ERROR;
         }
       }
+      if( i<nArg ) rc = SQLITE_ERROR;

     }else{
       rc = SQLITE_NOMEM;
@@ -1298,7 +1299,7 @@ static int fts5TriCreate(
     int i;
     pNew->bFold = 1;
     pNew->iFoldParam = 0;
-    for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
+    for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
       const char *zArg = azArg[i+1];
       if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
         if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){
@@ -1316,6 +1317,7 @@ static int fts5TriCreate(
         rc = SQLITE_ERROR;
       }
     }
+    if( i<nArg ) rc = SQLITE_ERROR;

     if( pNew->iFoldParam!=0 && pNew->bFold==0 ){
       rc = SQLITE_ERROR;
```
</details>

The patch changes the loop boundary and checks early exit to prevent
out-of-bounds access. 
After the loop, there's an additional check:

```c
if( i<nArg ) rc = SQLITE_ERROR; 
```

This check ensures that all arguments were processed. If `i` is less than
`nArg` after the loop, it means there was an odd numbers of arguments, 
which is considered an error because the arguments should always come in pairs. 

Interestingly, the maintainer patched `fts5UnicodeCreate()` and `fts5AsciiCreate()` as well
because similar code patterns existing there. It actually shows the 
strength of human-write patches because developers remember potential
buggy paths in their code base. However, the additional checks are actually
unnecessary because the checks are already at the beginning of the functions.
It demonstrates human-write patches are not perfect as well.

```c
static int fts5AsciiCreate(
  void *pUnused, 
  const char **azArg, int nArg,
  Fts5Tokenizer **ppOut
){
  int rc = SQLITE_OK;
  AsciiTokenizer *p = 0;
  UNUSED_PARAM(pUnused);
  if( nArg%2 ){   <---- already checks
    rc = SQLITE_ERROR;
  }else{
    --> unnecessary checks <--- 
```

I believe the maintainers notice the issues so that they changed their
patch in [b651084](https://github.com/sqlite/sqlite/commit/b651084713e8bb9a6a7a0399a00677604d157b2f)
by checking `if (nArgs % 2) == 0` at the beginning of `fts5TriCreate()`.
At the same time, they removed the unnecessary patches in `fts5AsciiCreate()`
and `fts5UnicodeCreate()`. 

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