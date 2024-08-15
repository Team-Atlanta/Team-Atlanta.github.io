---
title: "Announcing Team Atlanta!"
meta_title: ""
description: "Beginning"
date: 2024-08-13T05:00:00Z
image: "/images/blog/blog1-team.png"
categories: ["Announcement"]
author: "Taesoo Kim"
tags: ["team"]
draft: true
---

Hello world! We are *Team Atlanta*, and are developing Atlantis to complete in [DARPA AIxCC](https://aicyberchallenge.com/).

[Our team](/authors/) consists of six different organizations:
[Georgia Tech](https://www.gatech.edu/),
[GTRI](https://www.gtri.gatech.edu/),
[Samsung Research](https://research.samsung.com/),
[Samsung Research America](https://sra.samsung.com/),
[KAIST](https://www.kaist.ac.kr/en/)
and [POSTECH](https://www.postech.ac.kr/),
and the leads of each institution are the alumni of Georgia Tech.
We as a team have been tirelessly preparing for this competition
last several months,
and finally, competed in the AIxCC Semifinal last week!

## Journey Begins

When AIxCC announced [last year](https://www.whitehouse.gov/briefing-room/statements-releases/2023/08/09/biden-harris-administration-launches-artificial-intelligence-cyber-challenge-to-protect-americas-critical-software/), 
we quickly formed a team with a group of friends,
including [Zellic](https://www.zellic.io/).
At that time,
everything was unclear;
knowing not much of the game format or scoring,
proof-of-vulnerability,
sanitizers,
harnesses,
the number of programming language supports,
and proof-of-understanding.
As the organizers and participants are well of [what has happened](https://free.eol.cn/edu_net/edudown/spkt/zhangchao.pdf#page=34) at DARPA CGC,
we expected that AIxCC strives to avoid the *gamification* of the competition
and to promote the use of AI, say LLM, to win the competition.
It was a logical decision
for us
to focus on two directions:
1) leveraging LLMs to identify bugs -- it means *statically* and it's very different from finding bug-triggering inputs;
and
2) fine-tuning LLMs for code analysis -- *specialization* is always a win if possible
and we expect to support 10+ programming languages during the competition.
We quickly realized that, to enable either one of these directions, we need a dataset, yes benchmark.
We decided our team for three tasks: 1) static analysis by using LLM prompts/agents, 
2) C benchmark -- CGC, OSS-Fuzz, etc,
and 3) the commitpack for a pair of CVE-patch-PoC for open source projects for fine-tuning of the in-house code model at Samsung
or leveraging open source LLMs.
In fact, we achieved all of 1), 2) and 3) in 4-5 months
and our LLM-based CRS, called Skynet, seems
reasonably and surprisingly working well on our benchmark,
discussing possibility of fine-tuning our in-house model.

The time flied. The cold, 2023 winter is over and it's already a new year of 2024.
I remember that the dear friends from Zellic left our team around that time
for the Small Business Track (SBIR),
which DARPA supplements $1m for the competition,
as Georgia Tech and Samsung are not eligible for the award.

## Kick-off with Surprises!

{{< image src="images/blog/blog1-timeline.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}

In the kick-off event on March 29th,
AIxCC announced the first challenge project, the Linux kernel,
with an example vulnerability:
[CVE-2021-43267](https://nvd.nist.gov/vuln/detail/CVE-2021-43267).
In fact, this bug is [well described](https://www.sentinelone.com/labs/tipc-remote-linux-kernel-heap-overflow-allows-arbitrary-code-execution/)
and its PoC exploit is [publicly available](https://github.com/zzhacked/CVE-2021-43267),
which is a great example bug to work on.
More importantly, it has an intriguing story behind;
a security researcher audits the Linux kernel source code
by using [CodeQL](https://codeql.github.com/).
In particular,
the researcher was seeking the code that 16-bit `size` parameters are passed to the `kmalloc()` function
for memory allocation
by using a dataflow-based CodeQL query.
The intuition behind is that it might be easy to overflow the 16-bit `size` parameter
when accessing the allocated object.
The discovered bug, however, is not related to the integer overflow
but is an out-of-bound heap overflow
due to missing sanity check.

```c
static bool tipc_crypto_key_rcv(struct tipc_crypto *rx, struct tipc_msg *hdr)
{
	struct tipc_crypto *tx = tipc_net(rx->net)->crypto_tx;
	struct tipc_aead_key *skey = NULL;
	u16 key_gen = msg_key_gen(hdr);
	u16 size = msg_data_sz(hdr);
	u8 *data = msg_data(hdr);

  ...

	/* Allocate memory for the key */
	skey = kmalloc(size, GFP_ATOMIC);
	if (unlikely(!skey)) {
		pr_err("%s: unable to allocate memory for skey\n", rx->name);
		goto exit;
	}

	/* Copy key from msg data */
	skey->keylen = ntohl(*((__be32 *)(data + TIPC_AEAD_ALG_NAME)));
	memcpy(skey->alg_name, data, TIPC_AEAD_ALG_NAME);
	memcpy(skey->key, data + TIPC_AEAD_ALG_NAME + sizeof(__be32),
	       skey->keylen);
```

The `skey` was allocated with `size` from the user-provided `hdr`
but `skey->key` was copied upto `skey->keylen` (also user-provided),
which alas can be inconsistent with `size`.
The kernel did not perform a sanity check on these two parameters.

```diff
commit fa40d9734a57bcbfa79a280189799f76c88f7bb0
Author: Max VA <maxv@sentinelone.com>
Date:   Mon Oct 25 17:31:53 2021 +0200

    tipc: fix size validations for the MSG_CRYPTO type

    The function tipc_crypto_key_rcv is used to parse MSG_CRYPTO messages
    to receive keys from other nodes in the cluster in order to decrypt any
    further messages from them.
    This patch verifies that any supplied sizes in the message body are
    valid for the received message.

diff --git a/net/tipc/crypto.c b/net/tipc/crypto.c
index c9391d38de85..dc60c32bb70d 100644
--- a/net/tipc/crypto.c
+++ b/net/tipc/crypto.c
@@ -2285,43 +2285,53 @@ static bool tipc_crypto_key_rcv(struct tipc_crypto *rx, struct tipc_msg *hdr)
 	u16 key_gen = msg_key_gen(hdr);
 	u16 size = msg_data_sz(hdr);
 	u8 *data = msg_data(hdr);
+	unsigned int keylen;
+
+	/* Verify whether the size can exist in the packet */
+	if (unlikely(size < sizeof(struct tipc_aead_key) + TIPC_AEAD_KEYLEN_MIN)) {
+		pr_debug("%s: message data size is too small\n", rx->name);
+		goto exit;
+	}
+
+	keylen = ntohl(*((__be32 *)(data + TIPC_AEAD_ALG_NAME)));
+
+	/* Verify the supplied size values */
+	if (unlikely(size != keylen + sizeof(struct tipc_aead_key) ||
+		     keylen > TIPC_AEAD_KEY_SIZE_MAX)) {
+		pr_debug("%s: invalid MSG_CRYPTO key size\n", rx->name);
+		goto exit;
+	}
 
```

Two checks are added to fix this bug; verifying if `size` is bigger than the minimum key size,
and verifying if `keylen` is consistent with `size`,
preventing it from accessing beyond the allocated object.


## Misunderstanding 1. PoV

Given a humongous Linux repo (yep, 20m LoC), where should we first look at?
The LLM approach, it turns out, is all about asking the right question,
so called prompting engineering.
We adopted many techniques like Chain-of-Thought (CoT) and Tree-of-Thoughts (ToT),
and were exploring Retrieval Augmented Generation (RAG)
to quickly look up the known bugs.
At that time,
the context size was limited;
the most advanced model, `gpt-3.5 turbo` (yep, there exists pre-`gpt-4o` era) from OpenAI,
supports 16k tokens,
so it is essential to ask a right question!
We first tried spotting the potentially vulnerable code snippets
via all sorts of static analysis tools,
including CodeQL and various tools from the academic publication,
and started filtering out the results by using LLMs.
We discussed the possibility of diffing the upstream Linux kernel to the provided repo,
and asked LLMs to spot the bug from each of modified functions one by one.
Still, we had no doubt that, to promote the use of the AI tools,
the AIxCC organizer will design the competition in this way, 
so that a single CRS code base can explore any code repository using 10+ programming languages 
and their combinations.

However, PoV turns out a *bug-triggering input* or a crashing input.
To show the existence of a bug,
each CRS should formulate the input
so the referee can quickly check and score them;
it's easy and perhaps objective for the game but significantly depromote the adoptions of LLMs.
Our team quickly recognized that
we have to adopt dynamic approaches like fuzzing
for the competition.
Formulating the bug-triggering input, including its reachability,
is a much difficult job
than spotting the buggy code in the repo.
The strength of the fuzzing -- a dumb tool and the opposite of the fancy LLM,
is that once a bug is found, we will have a bug-triggering input, almost 100%.

Ah, around that time, Google recently announced `gemini-pro` with a sensational 128k context
and possibility of 1 million tokens!
`gpt-4` was announced with a gaming changing feature
called function calling,
which lets LLM to choose which callback to make
and incorporates its results back to the prompt at runtime.

We are confused, and always felt behind; the entire world evolves too quickly than our code base.

## Misunderstanding 2. Harnesses

Sorry, what's the input to trigger CVE-2021-43267? by using a fuzzer? 
To fuzz the Linux *kernel*,
we needed a user program calling a sequence of system calls
with various arguments.
Given a Linux kernel,
there are over [400 system calls](https://filippo.io/linux-syscall-table/)
to explore -- not ideal for the competition.
We thought, therefore, the harness and test cases 
are provided to indicate which parts of the Linux kernel 
to check for bugs.
We implemented various versions of the Linux Kernel fuzzers
like a custom [`libafl`](https://github.com/AFLplusplus/LibAFL) based one with `kcov` and `kcmp`,
and adopted [Syzkaller](https://github.com/google/syzkaller)
that we were familiar with.
However, still then, our focus is to feature out what sequences of system calls
to test, by using syscall traces and static analysis of the given program,
and then to correctly formulate an end-to-end userspace program
to trigger the bug.

[The Linux Kernel CP](https://github.com/aixcc-public/challenge-001-exemplar/)
was announced on April, 
and comes with a harness, [linux_test_harness.c](https://github.com/aixcc-public/challenge-001-exemplar-source/blob/main/test_harnesses/linux_test_harness.c).
That was full of surprises;
the structure of the program is given, which alas we mostly focused on,
and the [`blob`](https://github.com/aixcc-public/challenge-001-exemplar/blob/main/exemplar_only/blobs/sample_solve.bin)
should be provided to the harness
in a way to trigger the bug.
The kinds of system calls we interact are limited by the harness,
and our job is to find the data input
that the harness ultimately invokes necessary sequences of system calls
with the right parameters.

In other words, we had to discard what we have been working on,
and pivoted to analyze the harness logics and `blob` format
in fuzzing.

The Jenkins harness, however, was a fuzz driver (or often called harness)
that is a stand alone program invoking APIs for fuzz testing.
In May, a new CP, called `mock-cp` (a userspace program),
was announced along with a new harness format,
which is a shell script executing a CP binary
with the provided input.
In June,
the format of the harness was officially determined:
[libfuzzer](https://llvm.org/docs/LibFuzzer.html)
for userspace programs (`mock-cp` and Nginx),
[jazzer](https://github.com/CodeIntelligenceTesting/jazzer)
for Java programs (Jenkins),
while keeping the `blob`-based harness for the Linux kernel.
We constantly updated our CRS to handle these changes,
yet many of these decisions
made our LLM-based components unnecessary.


## Misunderstanding 2. Proof-of-understanding

Unlike CGC treating PoV (PoC exploit) as proof of discovery of a bug,
AIxCC required an additional information,
namely the type of the bug ([CWE](https://cwe.mitre.org/top25/archive/2023/2023_kev_list.html)),
to be provided along with PoV.
This sounds like an interesting decision
as AIxCC CRS should find a bug from the source code
while CGC CRS should discover a bug from the binary.

Our team brainstormed a lot about how to recognize CWE,
for sure, by using LLM prompts
that leverage crashing input, sanitizer reports,
related code snippets, outputs from static analyzers, etc.
However, the notion of CWEs are ambiguous to be used as a score for the game.
For example, CVE-2021-43267 should be
(1) CWE-122 (Heap-based Buffer Overflow),
(2) CWE-787 (Out-of-bounds Write),
or (3) CWE-20 (Improper Input Validation)?
First two are indeed the symptoms cased by the bug,
and (3) is a root cause
as the patch added input validations to fix this bug.

At the end, in AIxCC,
PoU was changed to find a bug-introducing commit (BIC),
the hash or the commit id of the git repo.
Combining with the fuzzing harness and PoU,
the CRS job is to run the fuzzing harness
and performs a [`git-bisect`](https://git-scm.com/docs/git-bisect)
to recognize the BIC from the repository.
I believe, the key differentiator of most CRS, if not all, is
to generate effective input corpus (by using LLM, etc)
for fuzzing,
or ambitious enough like us, is to replace the `libfuzzer`
with a custom hybrid fuzzer.


## Misunderstanding 3. Semantic patching

Patching is the most interesting part of AIxCC.
In CGC, PoV is a simple exploit (arbitrary read/write/execute, etc)
so mitigation schemes (e.g., adding a stack canary)
can thwart the PoV.
In fact, not just the targeted PoV,
the patching can be applied *without knowing* the bug itself;
e.g., adding a stack canary to all functions
can prevent the exploit of buffer overflows that might exist some places.
The challenge there was to treat the challenge *binary*
and the CGC organizer placed a rule like the minimum number of bytes changes
and adding the performance overheads to the score rubric
(i.e., instrumenting all memory accesses to prevent out-of-boundary bugs).
These rules enforced CRS to evaluate the pros and cons
of universal patching:
losing points from exploitation v.s., losing points from patching/availability.

In AIxCC, CRS has to generate a semantically correct patch
not only to fix the found PoV
but to respect functional correctness of the CP.
This is a bit tricky business as the *correctness*
cannot be formally defined for CRS--
some functional changes are acceptable or some are not,
mostly determined by the owner of the code.
One way to address such an ambiguity is to provide
the test code to see if the patch can successfully pass the provided, so called public test.
However, CRS should still consider some private tests by the organizer.

In the semi-final, there was one patch submission by our CRS -- so it at least prevents the crash and
passes the public test, but rejected by the private functionality tests.
We'd love to know about the bug and patch more!

## Misunderstanding 4. Memory-safe language (Java and Web!)

The notion of sanitizers
was not clear to our team
until we see the concrete construction of the sanitizers
for memory-safe languages like Java,
or more importantly Jenkins --
the web application written in Java!
The role of the sanitizer, in fact a bug oracle,
is to recognize if the bug is correctly triggered or not.
In memory-unsafe languages like C,
standard tools like ASAN, UBSAN, etc
can perform as a sanitizer to catch the memory-safety issues
with low or no false positive (i.e., out-of-bound accesses should never happen).
For memory-safe languages,
everything is tricky;
executing a command is legitimate feature by a user in the CI tools like Jenkins
or it should be treated as a command line injection (CWE-78)?
In other words,
the sanitizers become
the CP-specific rather than being specific to the programming language;
each CP should provide some custom sanitizers
(e.g., [path traversal sanitizers](https://www.code-intelligence.com/blog/java-fuzzing-with-jazzer)).

Our team spent some time
working on finding web-related bugs
like XSS or CSRF --
in fact, we think LLM might work great for these targets.
However, once AIxCC announced that
the sanitizers for Java
are the [jazzer](https://github.com/CodeIntelligenceTesting/jazzer) sanitizers,
our team decided to focus more on the standard jazzer-based fuzzing.

## Semifinal

Our team spent the most engineering time to build a CRS for the Linux Kernel.
And we are proud that
our CRS can find and correctly generate a patch for CVE-2021-43267
at the end.
However, in the semifinal,
it appears to us that
there was only *one* harness provided, similar to the provided exemplar,
and none of CRSes works properly for the Linux Kernel.

{{< image src="images/blog/blog1-dashboard.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}

In summary, our CRS got in total of six achievement badges:
five bugs (i.e., first bloods) and one patch.

{{< image src="images/blog/blog1-achievements.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}

There are several unique bugs only our CRS found and
we will describe it in the later blog post.

Other than known Linux (C), Jenkins (Java) and Nginx (C),
there were new CPs, namely Tika (Java) and Sqlite3 (C).
Our CRS performs relatively better on Sqlite3,
but sadly, our Java CRS couldn't properly handle Tika
and love to know more about what has happened during the competition.
Tika is a popular file format parser
and has lots of unique features like recursively parsing an embedded object, etc.

## Preparing for the AIxCC Final 🎉

{{< image src="images/blog/blog1-finalists.png" caption="AIxCC Finalists" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}

We are so excited that our team can compete in the final! 
There are several things we can make the competition more interesting.

- Longer execution time for the Linux kernel -- 20m LoC in the Linux Kernel
  requires non-trivial amount of time for building, boostraping, and bisecting.
  Compared with other smaller programs (e.g., 200k in Tika), it would be a good idea
  to give more time to CRS to navigate the code of the Linux kernel.
- More programming languages or their combination. Rust XXX

{{< youtube FkJimGWJYgw >}}

<hr>

### Gallery

{{< gallery dir="images/gallery" class="" height="400" width="400" webp="true" command="Fit" option="" zoomable="true" >}}

<hr>

### Slider

{{< slider dir="images/gallery" class="max-w-[600px] ml-0" height="400" width="400" webp="true" command="Fit" option="" zoomable="true" >}}

<hr>

### Youtube video


Nam ut rutrum ex, venenatis sollicitudin urna. Aliquam erat volutpat. Integer eu ipsum sem. Ut bibendum lacus vestibulum maximus suscipit. Quisque vitae nibh iaculis neque blandit euismod.

> Lorem ipsum dolor sit amet consectetur adipisicing elit. Nemo vel ad consectetur ut aperiam. Itaque eligendi natus aperiam? Excepturi repellendus consequatur quibusdam optio expedita praesentium est adipisci dolorem ut eius!

Lorem ipsum dolor sit amet consectetur adipisicing elit. Nemo vel ad consectetur ut aperiam. Itaque eligendi natus aperiam? Excepturi repellendus consequatur quibusdam optio expedita praesentium est adipisci dolorem ut eius!
