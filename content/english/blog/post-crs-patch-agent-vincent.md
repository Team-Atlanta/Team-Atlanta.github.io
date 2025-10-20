---
title: "Vincent, One Puzzle for Our Ensemble Toward High-quality Patches"
meta_title: ""
description: "Overview of the Vicent agent, one of patching agents in Atlantis-Patch."
date: 2025-10-10T11:00:00Z
image: "/images/blog/crs-patch/integration.png"
categories: ["Atlantis-Patch"]
authors: ["Younggi Park", "Insu Yun"]
tags: ["patch", "ensemble", "multi-agent"]
draft: false
---

As mentioned in the previous post, our strategy for patching is to prepare multiple agents to ensure both the robustness and correctness of the system.
To this end, we developed various patch agents, each specialized for different LLM models and tools. 

In this post, we would like to introduce Vincent agent, one of the patch agents running under our ensemble-based patching system.


## Right Root cause, Wrong Patches

What surprised us during the competition was that LLMs alone are already quite doing well at generating proper patches. 
Given a sanitizer report, LLMs could freely explore the codebase by itself and reason correctly about the given bug—especially when the problematic code appeared near the call stacks in the report.

However, our patch agent consistently struggled with the following (seemingly) simple challenge.
The challenge is a double-free bug in the `nginx` provided by the AIxCC organizer, where the bug is placed in the `ngx_http_process_prefer` in the `ngx_http_request.c`.
(If interested, the actual challenge can be found in [here](https://github.com/aixcc-public/challenge-004-nginx-cp/blob/main/.internal_only/cpv10/patches/nginx/good_patch.diff)).

```c
static ngx_int_t
ngx_http_process_prefer(ngx_http_request_t *r, ngx_table_elt_t *h,
    ngx_uint_t offset)
{
    ngx_table_elt_t *p;

    if (r->headers_in.prefer) {
        ngx_log_error(NGX_LOG_INFO, r->connection->log, 0,
                      "client sent duplicate host header: \"%V: %V\", "
                      "previous value: \"%V: %V\"",
                      &h->key, &h->value, &r->headers_in.prefer->key,
                      &r->headers_in.prefer->value);
        ngx_free(r->headers_in.prefer); // double-free
        return NGX_OK;
    }

    p = ngx_alloc(sizeof(ngx_table_elt_t), r->connection->log);

    if (!p) {
        ngx_http_finalize_request(r, NGX_HTTP_BAD_REQUEST);
        return NGX_ERROR;
    }

    p->hash = h->hash;
    p->key.len = h->key.len;
    p->key.data = h->key.data;
    p->value.len = h->value.len;
    p->value.data = h->value.data;

    r->headers_in.prefer = p;

    return NGX_OK;
}
```

`ngx_http_process_prefer` is a function that handles Prefer headers in the given HTTP request.
It first checks if any prefer header already exists. If so, the function decides that the current request is invalid. It logs the current request and free the previously allocated object.
Otherwise, it allocates the `ngx_table_elt_t` and store the provided prefer header information.


```
GET / HTTP/1.1
Host: localhost
Prefer: FirstPrefer
Prefer: SecPrefer
Prefer: ThirdPrefer
Accept: */*
```

Here's how the situation goes wrong. 
If a HTTP request maliciously contains multiple `prefer` headers, it can make the program enter the `if`-block multiple times.
However, the function never nullifies `r->headers_in.prefer` after freeing the object. Consequently, the dangling pointer `r->headers_in.prefer` can be reused, which is a typical use-after-free scenario.


The sanitizer report for the given problematic input seems to exhibit "all-we-have-to-know" about this bug.
```
==14==ERROR: AddressSanitizer: attempting double-free on 0x506000006d40 in thread T0:
SCARINESS: 42 (double-free)
    #0 0x5630699d7106 in free /src/llvm-project/compiler-rt/lib/asan/asan_malloc_linux.cpp:52:3
    #1 0x563069acd9cd in ngx_http_process_prefer /src/nginx/src/http/ngx_http_request.c:4018:9
    #2 0x563069adc761 in ngx_http_process_request_headers /src/nginx/src/http/ngx_http_request.c:1499:23
      [...omitted...]

DEDUP_TOKEN: __interceptor_free--ngx_http_process_prefer--ngx_http_process_request_headers
0x506000006d40 is located 0 bytes inside of 56-byte region [0x506000006d40,0x506000006d78)
freed by thread T0 here:
    #0 0x5630699d7106 in free /src/llvm-project/compiler-rt/lib/asan/asan_malloc_linux.cpp:52:3
    #1 0x563069acd9cd in ngx_http_process_prefer /src/nginx/src/http/ngx_http_request.c:4018:9
    #2 0x563069adc761 in ngx_http_process_request_headers /src/nginx/src/http/ngx_http_request.c:1499:23
      [...omitted...]
```
The report clearly indicates that the bug is a double-free in the `ngx_http_process_prefer` function.


So far, the bug is quite obvious and it looks easy to fix considering the current LLMs' capabilities.
How can we fix this bug? A straightforward fix would be to nullify the pointer `r->headers_in.prefer` after `ngx_free`. By doing so, we would prevent the function from entering the problematic `if`-block repeatedly — and that was the exact way how LLMs thought.

```diff
--- a/src/http/ngx_http_request.c
+++ b/src/http/ngx_http_request.c
@@ -4016,6 +4016,7 @@
                    &h->key, &h->value, &r->headers_in.prefer->key,
                    &r->headers_in.prefer->value);
        ngx_free(r->headers_in.prefer);
+       r->headers_in.prefer = NULL; // Nullify to prevent further misuse (comment by LLMs)
        return NGX_OK;
    }
```

Here's the typical patch that our patch agents produced.
As mentioned earlier, it nullifies the `r->headers_in.prefer` pointer to prevent further misuse.

However, it turned out that the problem was not that simple.
When handling each HTTP request, `nginx` requires "rules" to treat the failures.
To be specific, for problematic HTTP requests, each header handlers (like `ngx_http_process_prefer`) must finalize the HTTP request using `ngx_http_finalize_request` with a proper flag, and return the `NGX_ERROR` to indicate something went wrong with the request.
Without complying the rules, the patched program still suffers from another heap overflow caused by prefer header.

This implies that the agent must also consider project-specifc aspects rather than just fixing the observed symptom.


## Guiding LLMs Toward the Right Way: Property-Analysis Layer


The question is, how can we guide the LLMs to consider such "project-specific" aspect without losing generality?
To address this issue, our team borrowed the concept of **properties** from the field of software engineering and verification.

A program property is, usually described in a formal logical representation, is a statement about a program’s behavior that should hold true for all possible executions (or specific ones).

For example, here are properties in popular projects:
* **Safety Property**: "No null pointer dereference occurs during kernel execution." (Linux Kernel)
* **Functional Property**: "After executing an `INSERT` statement, the database file contains the inserted row." (SQLite)

Our team's strategy is to use this concept of properties to avoid context-agnostic patches that only addresses symptoms of security issues. To this end, Vincent agent added an intermediate layer that analyzes the program property just before generating patches.
Interestingly, LLMs seems to already have the concept of properties, enabling the use of concise prompt like below.
```
    [...omitted...]
In formal terms, a property refers to a condition that must hold true across all possible execution traces (i.e., sequences of system states).
This means that every possible path the program can take during execution must satisfy the property.
    [...omitted...]
```

By using the property extraction prompt, Vincent agent infers the properties related to the given bug.
The following example is a partial list of program properties for the provided double-free bug when using Claude Sonnet 3.5 model.

* **Memory Safety**: For any header field in `ngx_http_headers_in_t`, the pointer must either be `NULL` or point to a valid `ngx_table_elt_t` structure.
* **Header Processing Consistency**: All single-value HTTP headers (like Host, From, Content-Length) must maintain exactly one instance throughout the request processing lifecycle.
* **Error Response Consistency**: When encountering invalid headers, the system must either: (1) Return `NGX_ERROR` and call `ngx_http_finalize_request` with `NGX_HTTP_BAD_REQUEST` (2) Log the issue and return `NGX_OK` But never both or neither.

The **Error Response Consistency** is one that LLMs failed to consider in the previous superficial patch.

By considering this property, Vincent agent managed to produce the following sound patch for the given `nginx` double-free bug:

```diff
--- a/src/http/ngx_http_request.c
+++ b/src/http/ngx_http_request.c
         ngx_free(r->headers_in.prefer);
-        return NGX_OK;
+        r->headers_in.prefer = NULL;
+        ngx_http_finalize_request(r, NGX_HTTP_BAD_REQUEST);
+        return NGX_ERROR;
     }
```


## Workflow of Vincent Agent

The overall workflow of *Vincent Agent* consists of three analysis steps as follows.

{{< figure src="images/blog/crs-patch/vincent_overview.png" class="img-fluid text-center" width="70%" caption="Fig.1 High-level overview of *Vincent Agent*" >}}

The initial step is the root cause analysis (RCA) step—a process that identifies the reason why the bug occurs. Given the sanitizer report and the PoC (Proof-of-Concept) input binary, Vincent lets the LLMs explore the codebase autonomously.
The next step is property analysis. Using the RCA report from the previous step, Vincent extracts relevant program properties with the help of the LLMs.
To infer more precise properties, the LLMs are allowed to further explore the codebase.
Finally, with the RCA and property analysis reports retained in the message context, Vincent instructs the LLMs to generate a security patch in diff format.

For each generated patch, Vincent applies it to the given project and validates whether the patch is sound. To do this, Vincent utilizes the OSS-Fuzz–based building and testing interfaces of Crete, our framework for developing patch agents.

As a result of patch validation, there are four possible outcomes: (i) sound, (ii) vulnerable, (iii) uncompilable, and (iv) test failure.
Except in the case of a sound patch, Vincent collects the related logs (e.g., sanitizer report, build error log, etc.) and delivers the information to the LLM to generate a new patch. Vincent repeats the patch generation–validation-feedback cycle until a sound patch is produced.


## Code Retrieval of Vincent Agent

One of the core components that each patch agent should support is the code retrieval feature, which enables the LLMs to understand the codebase.
Based on our experience in internal evaluations, the precision of code retrieval and the performance of LLMs are highly correlated.
In Crete, we adopt various code retrieval strategies to ensure the robustness and responsiveness of our system.
In the case of Vincent Agent, we provide the LLMs with code information by combining the `ctags` utility and the `tree-sitter` library.

`ctags` is a command-line utility that generates an index (or "tags" file) of symbols found in source code files—like functions, classes, variables, macros, etc.
`tree-sitter` is a modern parsing library designed to build incremental parsers for programming languages, primarily to provide fast, precise, and robust syntax analysis for code editors and tools.

Instead of providing entire source files, Vincent Agent pinpoints code snippets essential to the LLM's request.
Specifically, given a target symbol name, such as a function or variable, Vincent first locates where the requested code snippet exists using `ctags`.
Then, it extracts the actual code, including the surrounding context (e.g., the full implementation of a function, struct, enum, etc.), using `tree-sitter`.

Beyond this basic strategy, we observed occasional failures of `tree-sitter`'s parser when dealing with complex codebases.
For example, if the target source code contains complex compile directives or macros, `tree-sitter` may fail to parse the intended snippets properly.
To handle such potential errors from external libraries, Vincent allows LLMs to request additional code lines when the initial query result is insufficient.

## Conclusion
In this blog post, we discussed one of the challenges our team struggled with and how the Vincent agent successfully solved it.
While LLMs can often fix surface-level bugs, they struggle with project-specific rules and invariants. By introducing a property analysis layer, Vincent guides LLMs to reason about deeper program semantics, resulting in sounder patches.
Integrated within the Crete framework, Vincent autonomously retrieves, analyzes, and validates patches in an iterative loop, improving both correctness and robustness.
