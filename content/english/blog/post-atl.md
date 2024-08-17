---
title: "Announcing Team Atlanta!"
meta_title: ""
description: "Beginning"
date: 2024-08-13T05:00:00Z
image: "/images/blog/atl/team.png"
categories: ["Announcement"]
author: "Taesoo Kim"
tags: ["team"]
draft: false
---

Hello, world! We are *Team Atlanta*, the minds behind Atlantis, our innovative
AI-driven cybersecurity solution competing in the prestigious
[DARPA AIxCC](https://aicyberchallenge.com/).

[Our team](/authors/) is a collaborative powerhouse made up of six leading institutions:
[Georgia Tech](https://www.gatech.edu/),
[GTRI](https://www.gtri.gatech.edu/),
[Samsung Research](https://research.samsung.com/),
[Samsung Research America](https://sra.samsung.com/),
[KAIST](https://www.kaist.ac.kr/en/), and
[POSTECH](https://www.postech.ac.kr/).
Each of these organizations is led by Georgia Tech alumni,
and includes past winners of prestigious hacking competitions 
such as DEF CON CTF, Pwn2Own and kernelCTF.

For the past several months, we have been diligently preparing for this competition,
combining our expertise in AI, cybersecurity,
and software engineering.
Last week, we proudly competed in the AIxCC Semifinals,
showcasing our hard work and dedication
to advancing cybersecurity through artificial intelligence.

## The Journey Begins

When AIxCC was announced [last year](https://www.whitehouse.gov/briefing-room/statements-releases/2023/08/09/biden-harris-administration-launches-artificial-intelligence-cyber-challenge-to-protect-americas-critical-software/), 
we quickly assembled a team of friends,
including [Zellic](https://www.zellic.io/) 
and [SSLab](https://gts3.org/).
At that time,
much was uncertain;
details about the game format,
scoring rubric,
proof-of-vulnerability (PoV),
sanitizers, harnesses, supported programming languages,
and proof-of-understanding (PoU) were all unclear.
Our team, however, started preparing for the competition from last October.

Many of our team members previously participated in the
[DARPA Cyber Grand Challenge (CGC)](https://www.darpa.mil/program/cyber-grand-challenge)
as part of [Crspy](https://en.wikipedia.org/wiki/2016_Cyber_Grand_Challenge), 
where we were responsible for bug finding and exploitation generation.
DARPA CGC was an ambitious endeavor
that sparked numerous innovative research directions afterward.
However, the competition was not without its challenges,
particularly due to the *gamification* of the event; 
the scoring metrics and rules significantly influenced [the outcomes](https://free.eol.cn/edu_net/edudown/spkt/zhangchao.pdf#page=34).
In the end, the competing Cyber Reasoning Systems (CRS) that focused on operating reactively--prioritizing the availability score over fixing bugs--
tended to score higher, as exploitation proved to be far more difficult than patching.

Aware of [the gamification issues](https://aicyberchallenge.com/rules/) from CGC, 
we anticipated that to excel in AIxCC 
our CRS should leverage AI, particularly LLMs, aggressively in various depths and levels
of the CRS pipelines.
With this in mind, we strategically chose to focus our efforts on two key directions:

1. **Static Analysis.** To encourage the use of LLMs and set AIxCC apart from CGC, 
we anticipated that
AIxCC would strongly advocate for the adoption of *static analysis* while
steering away from the dominant use of *fuzzing*[^1].
It's important to note
that finding bugs is quite different from finding crash- or bug-triggering
inputs. The latter offers a clear advantage in objectively and autonomously
verifying the discovered bug,
but it has a much narrower scope compared to the former.
In practice, the *triggering* aspect, also known as the reachability problem, is
a significantly more challenging and crucial issue to address,
where *dynamic tools* like fuzzing have a clear edge.

2. **Fine-tuning LLMs for Source Code.** Specialization is always an advantage
   when possible. Given that each CRS will likely need to support more than 10
   programming languages during the competition, we decided to fine-tune both
   in-house and open-source models for analyzing code. 
   This approach is conceptually similar to
   [commitPack](https://paperswithcode.com/dataset/commitpack), 
   but focuses on
   commits related to bugs like their fixes, bug-introducing commits, descriptions,
   and public exploits, if available.
   Our expectation was that training with this data would enable
   the fine-tuned LLM to reason about security bugs,
   their fixes, and likely input corpus,
   more effectively than the
   foundational model.

[^1]: I think it’s one of the worst names ever chosen by a security researcher; non-security folks often think it's a really *dumb* technique. But if you dig into the details, it's actually an impressive AI tool. It operates entirely autonomously, adapting to unknown code, self-learning from past executions, using feedback loops similar to backpropagation, and employing cost functions like coverage maps, and more! Most importantly, like deep learning, it works incredibly well in practice!

We quickly realized that to pursue these directions effectively, 
we first needed a dataset: a benchmark.
Our team divided tasks into three areas: 1) static analysis
using LLM prompts/agents, 2) developing a C benchmark from sources like CGC and
OSS-Fuzz, and 3) collecting a training dataset pairing CVEs with patches and PoCs for
open-source projects to fine-tune our in-house code model at Samsung or to
leverage open-source LLMs.

Remarkably, within 4-5 months, we accomplished all three goals,
and our LLM-based Cyber Reasoning System (CRS), dubbed Skynet,
performed surprisingly well on our benchmark,
and fine-tuning on a smaller dataset shows some promises like in python.

Time flew by. The cold winter of 2023 ended, and we found ourselves in the new
year of 2024. 
I vividly remember that around this time, our dear friends from
Zellic left our team to pursue the Small Business Innovation Research (SBIR) track,
which DARPA supports with $1 million for the competition.
Unfortunately, Georgia Tech and Samsung were not eligible for this award.

## Kick-off with Surprises!

{{< image src="images/blog/atl/timeline.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title" webp="false" >}}

At the kick-off event on March 29th, AIxCC unveiled the first challenge project:
the Linux kernel, along with an example vulnerability,
[CVE-2021-43267](https://nvd.nist.gov/vuln/detail/CVE-2021-43267). 
This bug is [well documented](https://www.sentinelone.com/labs/tipc-remote-linux-kernel-heap-overflow-allows-arbitrary-code-execution/),
and its PoC exploit is [publicly available](https://github.com/zzhacked/CVE-2021-43267), 
making it an excellent example to work on.

What makes this bug even more intriguing is the story behind it. 
A security researcher audited the Linux kernel source code using
[CodeQL](https://codeql.github.com/). 
Specifically, the researcher was searching
for instances where 16-bit `size` parameters are passed to the `kmalloc()`
function for memory allocation, 
using a dataflow-based CodeQL query. 
The intuition was that a 16-bit `size` parameter
could easily lead to an *integer overflow* when accessing the allocated object.
However, the discovered bug was not caused by an integer overflow,
but an out-of-bound heap overflow due to a missing sanity check on the `size` and related inputs.

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

The `skey` was allocated with a `size` based on the user-provided `hdr`, 
but `skey->key` was copied up to `skey->keylen`, 
which was also user-controlled and could therefore be inconsistent with `size`.
Unfortunately, the kernel did not
perform a sanity check on these two parameters,
causing an out-of-boundary access.


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

Two checks were added to fix this bug: 
verifying that `size` is greater than the
minimum key size, and ensuring that `keylen` is consistent with `size`, 
thereby preventing access beyond the allocated object.


## Misunderstanding 1: PoV

Given a massive Linux repository (yes, 20 million lines of code),
where should we start?
The LLM approach is all about asking the right questions,
also known as prompt engineering.
We utilized various techniques like Chain-of-Thought (CoT)
and Tree-of-Thoughts (ToT),
and were exploring Retrieval Augmented Generation (RAG)
to quickly identify known 1-day bugs.

At that time, context size was limited; 
the most advanced model, `gpt-3.5 turbo`
(yes, pre-`gpt-4` era) from OpenAI, supported 16k tokens,
making it crucial to ask the right question!
We initially tried identifying potentially vulnerable
code snippets using a range of static analysis tools, 
including CodeQL, Semgrep and various tools from academic publications, 
and then filtered the results with LLMs.
We even considered diffing the upstream Linux kernel
against the provided repository,
so that our CRS can look at the modified part of the code first.

We were confident our decision; to promote the use of AI tools,
the AIxCC organizers
would design the competition in a way that allows a single CRS codebase to
explore any code repository using 10+ programming languages and their
combinations.

Ah, around that time, 
Google had just announced `gemini-pro` 
with an impressive 128k context and the potential to support 1 million tokens! 
Meanwhile, `gpt-4`
introduced a game-changing feature called function calling, 
which allows the LLM to select which callback to use and integrate the results back into the prompt
at runtime. We felt that everything was evolving favorably for our CRS to adopt
these cutting-edge techniques.

However, PoV turned out to mean *bug-triggering input*
or a crashing input.
To demonstrate the existence of a bug,
each CRS needed to formulate an input
that the referee could quickly verify.
While this approach is
straightforward and objective for the competition,
it significantly discourages the adoption of LLMs in finding bugs.
Our team quickly realized
that we needed to pivot to the dynamic approaches like fuzzing
for the competition.

```c
void tipc_trigger(uint8_t *smashbuf, uint32_t smashlen, int seqno) {
    uint8_t pkt[0x1000];
    uint32_t w0, w1, w2, w3, w4, w5;

    w0 = hdr_version(TIPC_VERSION);
    w0 |= hdr_size(6);
    w0 |= hdr_user(MSG_CRYPTO);
    w0 |= hdr_msg_size(24 + 36 + KEY_SIZE);
    w1 = 0;
    w2 = seqno;
    w3 = NODE_ID;
    w4 = 0;
    w5 = 0;

    memset(pkt, 0, sizeof(pkt));
    gen_tipc_hdr(pkt, w0, w1, w2, w3, w4, w5);

    memcpy(pkt+24, "HAXX", 4);
    *(uint32_t*)(pkt+24+32) = be32(KEY_SIZE + SMASH_SIZE + smashlen); // <- (1)
    memset(pkt+24+36, 'C', KEY_SIZE);
    memset(pkt+24+36+KEY_SIZE, 'D', SMASH_SIZE);
    memcpy(pkt+24+36+KEY_SIZE + SMASH_SIZE, smashbuf, smashlen);
    tipc_send(pkt, sizeof(pkt));
}
```

Formulating a bug-triggering input, including ensuring its reachability, 
is a far more challenging task than simply spotting buggy code in the repository. 
The strength of fuzzing, perhaps the opposite of a sophisticated LLM, 
is that once a bug is found,
you almost always have a bug-triggering input.

In CVE-2021-43267, using CodeQL and auditing, 
one could identify this bug, but triggering it is an entirely different challenge, 
not to mention [exploiting it](https://github.com/zzhacked/CVE-2021-43267/blob/main/poc.py). 
For example,
TIPC must be properly set up first, and the `keylen` needs to be precisely
crafted in (1) to trigger the bug.

## Misunderstanding 2. Harnesses

Sorry, what's the input needed to trigger CVE-2021-43267? even with a fuzzer?  
To fuzz the Linux *kernel*, 
we needed a *user* program 
that calls a sequence of system calls
with various arguments. 
Considering the Linux kernel has over [400 system calls](https://filippo.io/linux-syscall-table/)
to explore, this was far
from ideal for a competition setting.

We initially assumed that harnesses and test cases would be provided to indicate
which parts of the Linux kernel should be checked for bugs. 
To tackle this, 
we implemented and adopted various versions of Linux kernel fuzzers, 
including a custom kernel syscall fuzzer with `kcov` and `kcmp`,
and also utilized the most popular Linux fuzzer, [Syzkaller](https://github.com/google/syzkaller).
However, our focus remained on determining which sequences of system calls
to test, using syscall traces and static analysis of the provided program,
and then correctly formulating an end-to-end userspace program to trigger the bug.

```c
/***
 * Blob begins with a 4 byte command count
 * [4-bytes command count]
 * Currently there are two commands:
 *  0 - send a packet blob
 *      [4-bytes size][4-bytes send flags][size-bytes packet data]
 *  1 - send a netlink packet
 *      [4-bytes Message Type][4-bytes Message Flags][4-bytes Netlink Protocol][4-bytes size][size bytes data]
 * blob_size MUST be a trusted value
 */
int harness( uint8_t *blob, uint32_t blob_size)
{ ... }
```

[The Linux Kernel CP](https://github.com/aixcc-public/challenge-001-exemplar/)
was announced in April and came with a harness,
[linux_test_harness.c](https://github.com/aixcc-public/challenge-001-exemplar-source/blob/main/test_harnesses/linux_test_harness.c).
This announcement was full of surprises; 
the program's structure was provided by the harness,
which is alas what we primarily focused on,
and the [`blob`](https://github.com/aixcc-public/challenge-001-exemplar/blob/main/exemplar_only/blobs/sample_solve.bin)
needed to be fed to the harness in a way that triggers the bug.
The types of system calls we could interact with
were limited by the harness,
and our task was to find the right data input 
that would *lead the harness*
to invoke the necessary sequence of system calls with the correct parameters.
In other words, we needed to understand the harness first
before dealing with the Linux kernel bugs.

Later, the Jenkins harness was announced, and more surprisingly, 
it was a fuzz driver (often called a *fuzzing harness*), 
a standalone program designed to
invoke APIs for fuzz testing. 
In May, a new CP, called `mock-cp` (a userspace program), 
was introduced along with a new harness format, which was simply a
shell script executing a CP binary with the provided input.
Such diverse formats got us thinking that
our CRS should adopt LLM to figure out the structure of the programs
and CPs first; like how to compile, how to correctly run, etc.

By June, the harness format was officially established - 
surprisingly, yet not entirely unexpected: 
[libfuzzer](https://llvm.org/docs/LibFuzzer.html) for
userspace programs (`mock-cp` and Nginx),
[jazzer](https://github.com/CodeIntelligenceTesting/jazzer) for Java programs
(Jenkins), while retaining the `blob`-based harness for the Linux kernel.
We continually updated our CRS to adapt to these changes,
but many of these decisions rendered our LLM-based components unnecessary. 
This decision, however,
greatly helped all the participating teams
by reducing the engineering time needed for game operation.
Unfortunately, we were too proactive in reacting to these changes and ended up
wasting some engineering time as a result 😊.

A harness's role is crucial in the AIxCC competition; it sets the context for
the CRS to trigger the bug and serves as a key factor in adjusting the
difficulty of bug discovery. Therefore, it's important to strike a balance:
it should provide enough detail to relieve the CRS from unnecessary burdens,
allowing it to focus on bug finding, but without revealing too much information
about the bugs.

## Misunderstanding 3. Proof-of-understanding

Unlike CGC, which treated the PoV (a proof-of-concept exploit) 
as sufficient proof of bug discovery,
AIxCC required additional information—specifically, the bug type as classified by
[CWE](https://cwe.mitre.org/top25/archive/2023/2023_kev_list.html),
to be provided along with the PoV.
This was an interesting decision, as AIxCC required
CRS to find bugs in the source code,
whereas CGC focused on discovering bugs in binaries.

Our team spent a lot of time brainstorming 
how to accurately identify CWE categories, 
primarily by using LLM prompts that leverage crashing inputs,
sanitizer reports, related code snippets, outputs from static analyzers, and more. 
However, the notion of CWEs can be ambiguous when used as a scoring
mechanism for the competition. 
For instance, should CVE-2021-43267 be classified
as (1) CWE-122 (Heap-based Buffer Overflow), (2) CWE-787 (Out-of-bounds Write),
or (3) CWE-20 (Improper Input Validation)? 
The first two describe the symptoms
caused by the bug, while the third identifies the root cause, as the patch for
this bug involved adding input validations.

In the end, AIxCC shifted the focus from PoV to identifying the bug-introducing
commit (BIC) - the specific hash or commit ID in the git repository. 
Combined with
the fuzzing harness and PoV, the CRS's task was to run the fuzzing harness and
perform a [`git-bisect`](https://git-scm.com/docs/git-bisect) to pinpoint 
the BIC in the repository.
We did a simple bisecting in the semifinal but lots of improvement
required to be functional for the final event.

## Misunderstanding 4. Semantic patching

Patching is one of the most intriguing aspects of AIxCC. In CGC, the PoV was
typically a simple exploit (like arbitrary read/write/execute),
so mitigation strategies (e.g., adding a stack canary) could effectively thwart the PoV.
In fact, patches could be applied *without even knowing* the specific bug; 
for example,
adding a stack canary to all functions in a binary 
can prevent buffer overflow exploits 
that might exist in some places.

The challenge in CGC was that the focus was on the binary, and the organizers
introduced rules such as a minimum number of bytes changed and performance
overheads added to the scoring rubric (e.g., instrumenting all memory accesses
to prevent out-of-bound errors). These rules were designed to encourage
competitors to generate correct patches. Ultimately, this forced CRS to weigh
the pros and cons of universal patching, as both exploiting and patching were
extremely difficult during the CGC era, 
resulting in a trade-off between losing
points from exploitation versus losing points from patching and availability.

In AIxCC, the CRS must generate a semantically correct patch that not only fixes
the identified PoV but also maintains the functional correctness of the CP. This
is a tricky task, as *correctness* cannot be formally defined for CRS - some
functional changes may be acceptable, while others may not, depending on the
code owner's criteria. 
One approach to addressing this ambiguity is to provide
test code to see if the patch passes the provided, so-called public tests.
However, CRS must still account for private tests set by the organizers.

In the semifinals, our CRS submitted a patch that successfully prevented the
crash and passed the public tests given to us during the competition,
but was ultimately rejected in the private
functionality tests. 
We're eager to learn more about the bug and the patch!

## Misunderstanding 5: Sanitizers

The concept of sanitizers was unclear to our team until we encountered
their concrete implementation
for memory-safe languages like Java, and more
specifically, for Jenkins, a web application written in Java! 
The role of a sanitizer, essentially a bug oracle, is to determine whether a bug has been
correctly triggered.

In memory-unsafe languages like C, standard tools like ASAN and UBSAN can serve
as sanitizers to catch memory-safety issues with low or no false positives
(e.g., out-of-bound accesses should never occur). 
However, in memory-safe languages, 
things get trickier. 
For example, is executing a command a legitimate
feature in CI tools like Jenkins, 
or should it be treated as a command injection (CWE-78)?

In other words, sanitizers are more CP-specific 
rather than programming language-specific; 
each CP needs to provide custom sanitizers 
(e.g., [path traversal sanitizers](https://www.code-intelligence.com/blog/java-fuzzing-with-jazzer)).

Our team initially spent time working on finding web-related bugs like XSS or
CSRF in Jenkins - areas where we believed LLMs could excel in seed generation.
However, once AIxCC announced
that the sanitizers for Java would be
[jazzer](https://github.com/CodeIntelligenceTesting/jazzer) sanitizers,
we decided to shift our focus more towards standard jazzer-based fuzzing.

## Semifinal

Our team dedicated most of our engineering effort to building a CRS for the
Linux Kernel, and we're proud that our CRS was able to find and correctly
generate a patch for CVE-2021-43267 in the end. 
However, during the semifinal,
it appeared that only *one* harness was provided, similar to the exemplar, and
none of the CRSes functioned properly for the Linux Kernel.
We loved to know more about how our Linux CRS functioned 
during the competition.

{{< image src="images/blog/atl/dashboard.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}

In summary, our CRS earned a total of six achievement badges: five for
discovering bugs (i.e., first bloods) and one for a patch.

{{< image src="images/blog/atl/achievements.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title" webp="false" >}}

Our CRS found several unique bugs, which we will describe in a later blog post!

Aside from the known CPs—Linux (C), Jenkins (Java), and Nginx (C) - there were new
CPs introduced, namely Tika (Java) and sqlite3 (C). 
Our CRS performed relatively
well on sqlite3, but unfortunately,
our Java CRS struggled with Tika. 
We would love to learn more about what happened during the competition. 
Tika, a popular file format parser, 
has many unique features, such as recursively parsing
embedded objects, 
which may have contributed to the challenges we faced.

## Looking Ahead to the AIxCC Final 🎉

{{< image src="images/blog/atl/finalists.png" caption="AIxCC Finalists" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title" webp="false" >}}

We are thrilled that our team has advanced to the AIxCC finals! We have several ideas that could make the competition even more exciting:

- **Different execution times based on code complexity.**  
  The Linux kernel, with its 6,000 files and 20 million lines of code, requires
  substantial time for bookkeeping like building, bootstrapping, and bisecting.
  Compared to smaller programs (e.g., 200k in Tika), it would be beneficial to
  allocate more time for CRSes to navigate such complex codebases.

- **More programming languages and their combinations.**  
  Top candidates include Python, Rust, and JavaScript/HTML, along with
  combinations like JNI (C) in Java or Rust device drivers in the Linux kernel.
  These would offer a more comprehensive evaluation of CRS capabilities in
  diverse and challenging settings where CRS is most needed.

- **Standardized execution environments.**  
  Standardizing the compiler (e.g., `clang-18`), runtime (e.g., JVM version),
  and base Docker image ahead of time would help teams explore more advanced
  techniques, such as LLM-based instrumentation, in a controlled environment.

- **Improved visualization during the competition.**  
  While the AIxCC village was impressively set up, competing teams and
  participants had limited visibility into the competition's progress and how
  each CRS was functioning. To capture more attention from [the DEF CON audience](https://www.reddit.com/r/Defcon/comments/1eta3tj/was_the_aixcc_village_disappointing_to_anyone_else/),
  it would be beneficial to expose more technical information during the
  competition - such as showing current prompts of each CRS in turn, their CPU
  usage, or even stdout from CRSes (for fun), along with explanations of the
  progress.

With our baseline system up and running, it’s time for our team to explore the
possibility of incorporating LLMs or ML techniques into our CRS workflow. If
you’re passionate about AIxCC and as committed to the competition as we are,
feel free to [contact us](mailto:aixcc-atl@googlegroups.com)!

We are fortunate to have support from generous sponsors like GT/GTRI, Samsung,
and KAIST/NYU. If your company is interested in sponsoring our team, we would be
happy to discuss further!

Last but not least, we want to extend our heartfelt thanks to the AIxCC
organizers for launching the competition we've been craving. Hackers thrive on
competition-driven innovation, and this has been an exciting opportunity for all
of us.

<div style="width:640px; margin: 0 auto;">
{{< youtube FkJimGWJYgw >}}
</div>
