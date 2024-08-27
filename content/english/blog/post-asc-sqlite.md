---
title: "Autonomously Uncovering and Fixing a Hidden Vulnerability in SQLite3 with an LLM-Based System"
meta_title: ""
description: "SQLite3 in ASC"
date: 2024-08-27T12:00:00Z
image: "/images/blog/asc-sqlite/sqlite.webp"
categories: ["Vulnerability Analysis"]
author: "Hanqing Zhao"
tags: ["Atlantis CRS"]
draft: true
---

Without knowing beforehand that the challenge project involved SQLite3, 
our team, [Team Atlanta](/authors), entered our Cyber Reasoning System (CRS), 
named Atlantis, 
into the [AI Cyber Challenge](https://aicyberchallenge.com/) 
organized by ARPA-H, DARPA, and the 
[White House](https://www.whitehouse.gov/briefing-room/statements-releases/2023/08/09/biden-harris-administration-launches-artificial-intelligence-cyber-challenge-to-protect-americas-critical-software/).

Remarkably, 
Atlantis autonomously identified and patched a previously undiscovered vulnerability[^1], 
earning us a $2 million prize and a place in the grand finals of AIxCC. 
For more information, check out our [team's announcement blog](/blog/post-atl).

In this blog, 
we will outline our very high-level approach to using LLMs for bug detection and 
vulnerability remediation, 
provide an analysis of the fixed SQLite3 vulnerability, 
and discuss the challenges of using our LLM agents for such fixes.

Follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
if you're interested in AI or security.

[^1]: Discovering previously unknown bugs does not count as a valid score in the competition. 
Team Atlanta secured a finalist spot by submitting the intended bugs and patches in AIxCC.


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

To harness the full potential of LLMs and address their limitations in tackling complex problems, 
we incorporate traditional program analysis techniques (both dynamic and static) to assist LLMs in decision-making.

One of the interesting features of Atlantis is 
our "baby-security-AGI" system, 
which can emulate the code auditing process based on 
the habits of the security experts on our team. 
It's not magic; we've distilled our collective experience and common practices in
manual auditing and reverse engineering into structured prompts, 
significantly enhancing the system's capabilities.

All source code will be open-sourced in accordance with the AIxCC competition rules.

## The SQLite3 Vulnerability

The hidden vulnerability was discovered in the 
[FTS5 module](https://www.sqlite.org/fts5.html) 
of SQLite3 
([link](https://sqlite.org/forum/forumpost/171bcc2bcd)).
The bug is in the trigram tokenizer, 
which treats each contiguous sequence of three characters as a token, 
allowing FTS5 to support more general substring matching.

When creating a virtual table, users can specify options in the `trigram`
field. (e.g., `case_sensitive 1`). However, when users fail to give
key-value pairs, SQLite does not have enough checks and assume the value
must be there, resulting in off-by-one access. Because SQLite3 allocates
enough heap buffer in this case, the off-by-one access can only reach the
spaces within an allocated heap chunk. 
Also, Because of the good coding
practices, SQLites uses `MallocZero` to make sure there is no uninitialized
variables. In this way, it results in a zero pointer dereference.  

<details>
  <summary>Click me to show the vulnerable function in SQLite3 </summary>

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
        if( (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){
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

Working PoCs to trigger the bugs are

```sql
PoC 1: CREATE VIRTUAL TABLE t USING fts5(s, tokenize='trigram case_sensitive');
PoC 2: CREATE VIRTUAL TABLE t USING fts5(s, tokenize='trigram remove_diacritics');
```

## Auto-generated patch

Automatically patching the aforementioned bug is challenging because a 
perfect patch[^2] requires the human/AI patcher to understand the arguments are
paired and the null pointer dereference is caused by a off-by-one heap 
access within a heap chunk.


[^2]: The "perfect patch" here is just a vague concept in my mind. 
To elaborate further, I want to emphasize that a patch need to understand
the contexts and semantics of a program and the real root causes other than
simply add hacky checks to bypass address sanitizer.

```diff
diff --git a/ext/fts5/fts5_tokenize.c b/ext/fts5/fts5_tokenize.c
index f12056170..0d26ea17a 100644
--- a/ext/fts5/fts5_tokenize.c
+++ b/ext/fts5/fts5_tokenize.c
@@ -1299,6 +1299,10 @@ static int fts5TriCreate(
     pNew->bFold = 1;
     pNew->iFoldParam = 0;
     for(i=0; rc==SQLITE_OK && i<nArg; i+=2){
+      if (azArg == NULL || azArg[i] == NULL || azArg[i+1] == NULL) {
+        rc = SQLITE_ERROR;
+        break;
+      }
       const char *zArg = azArg[i+1];
       if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
         if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){
```

In this case, Atlantis spent <\$3 for the whole patch generation, iteration, and
correctness-validation process, which demonstrates it is promising potential to apply to real-world
softwares. 
Thanks [Seunggi](authors/seunggi-min/) for collecting the statistics when patching the bug.

<details>
  <summary>Click me to show SQlite3's patch </summary>

```diff
Improved robustness of parsing of tokenize= arguments in FTS5.
[forum:/forumpost/171bcc2bcd|Forum post 171bcc2bcd].

FossilOrigin-Name: d9f726ade6b258f8723f90d0b04a4682e885e30939eb29773913e4dfc8e85503
 int i;
      memset(p, 0, sizeof(AsciiTokenizer));
      memcpy(p->aTokenChar, aAsciiTokenChar, sizeof(aAsciiTokenChar));
      for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
        const char *zArg = azArg[i+1];
        if( 0==sqlite3_stricmp(azArg[i], "tokenchars") ){
          fts5AsciiAddExceptions(p, zArg, 1);
	@@ -90,6 +90,7 @@ static int fts5AsciiCreate(
          rc = SQLITE_ERROR;
        }
      }
      if( i<nArg ) rc = SQLITE_ERROR;
      if( rc!=SQLITE_OK ){
        fts5AsciiDelete((Fts5Tokenizer*)p);
        p = 0;
	@@ -381,17 +382,16 @@ static int fts5UnicodeCreate(
      }

      /* Search for a "categories" argument */
      for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
        if( 0==sqlite3_stricmp(azArg[i], "categories") ){
          zCat = azArg[i+1];
        }
      }
      if( rc==SQLITE_OK ){
        rc = unicodeSetCategories(p, zCat);
      }

      for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
        const char *zArg = azArg[i+1];
        if( 0==sqlite3_stricmp(azArg[i], "remove_diacritics") ){
          if( (zArg[0]!='0' && zArg[0]!='1' && zArg[0]!='2') || zArg[1] ){
	@@ -416,6 +416,7 @@ static int fts5UnicodeCreate(
          rc = SQLITE_ERROR;
        }
      }
      if( i<nArg ) rc = SQLITE_ERROR;

    }else{
      rc = SQLITE_NOMEM;
	@@ -1298,7 +1299,7 @@ static int fts5TriCreate(
    int i;
    pNew->bFold = 1;
    pNew->iFoldParam = 0;
    for(i=0; rc==SQLITE_OK && i<nArg-1; i+=2){
      const char *zArg = azArg[i+1];
      if( 0==sqlite3_stricmp(azArg[i], "case_sensitive") ){
        if( (zArg[0]!='0' && zArg[0]!='1') || zArg[1] ){
	@@ -1316,6 +1317,7 @@ static int fts5TriCreate(
        rc = SQLITE_ERROR;
      }
    }
    if( i<nArg ) rc = SQLITE_ERROR;

    if( pNew->iFoldParam!=0 && pNew->bFold==0 ){
      rc = SQLITE_ERROR;
```
</details>

The patch checks 

## The Author's Mustings
