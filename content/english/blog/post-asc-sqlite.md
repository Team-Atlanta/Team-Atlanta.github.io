---
title: "Autonomously Uncovering and Fixing a Hidden Vulnerability in SQLite3 with an LLM-Based Cyber Reasoning System"
meta_title: ""
description: "SQLite3 in ASC"
date: 2024-08-27T12:00:00Z
image: "/images/blog/atl/team.png"
categories: ["Vulnerability Analysis"]
author: "Hanqing Zhao"
tags: ["Atlantis CRS"]
draft: true
---

Without prior knowledge that the challenge project involved SQLite3, 
our team, [Team Atlanta](/authors), 
deployed our Cyber Reasoning System (CRS) named Atlantis in the AI cyber challenge 
organized by ARPA-H, DARPA, and the White House. 

Notably, Atlantis autonomously discovered and fixed a previously hidden vulnerability[^note], 
securing us a $2 million cash award and a spot in the grand finals of AIxCC. 
More details can be found in our [team's announcement blog](/blog/post-atl).

[^note]: Uncovering previous unknown bugs are not counted as valid scores in
competition, and Team Atlanta secured the finalist slot by submitting intended 
bugs in AIxCC.

## The Atlantis Cyber Reasoning System

Atlantis is an end-to-end, 
large language model (LLM)-based bug-finding and fixing system designed to operate 
without any human intervention. 

It supports complex systems, such as the Linux kernel, 
and modern programming languages, including C/C++, Java, and more.

Our design philosophy is straightforward: 
to replicate the mindset of seasoned security researchers and hackers using 
LLM agents reinforced with advanced program analysis techniques.

Atlantis is built to mimic human researchers' behavior, 
particularly in auditing the Git repositories of open-source software (OSS). 

Notably, our "baby-security-AGI" system is capable of replicating 
the code auditing process based on the habits of the security experts within our team.

Importantly, all source code will be open-sourced following the AIxCC competition.


## The SQLite3 Vulnerability

The hidden vulnerability was discovered in the 
[FTS5 module](https://www.sqlite.org/fts5.html) 
of SQLite3 
([link](https://sqlite.org/forum/forumpost/171bcc2bcd)).
The bug is in the trigram tokenizer, 
which treats each contiguous sequence of three characters as a token, 
allowing FTS5 to support more general substring matching.

Working PoCs to trigger the bugs are
```sql
PoC 1: CREATE VIRTUAL TABLE t USING fts5(s, tokenize='trigram case_sensitive');


PoC 2: CREATE VIRTUAL TABLE t USING fts5(s, tokenize='trigram remove_diacritics');
```


## Auto-generated patch

Automatically patching the aforementioned bug is challenging 
Thanks [Seunggi](authors/seunggi-min/) for collecting the statistics when patching the bug.

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


## The Author's Mustings
