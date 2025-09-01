---
title: "Hybrid Fuzzing: Exploring Complex Paths with Concolic Execution"
meta_title: ""
description: "How we used concolic execution to enhance our fuzzing capabilities in the AIxCC competition."
date: 2025-08-19T12:15:00Z
image: "/images/blog/afc/concolic-blog-header1.jpg"
categories: ["Atlantis"]
author: "Woosun Song"
tags: ["AFC"]
draft: false 
---

## 1. Why Concolic Execution?
We integrated a hybrid fuzzer based on concolic execution to enable our fuzzer to explore complex path conditions. The following code snippet from the `curl-delta-01` challenge problem in Round 3 illustrates a complex path condition that benefits from concolic execution. The function `verynormalprotocol_doing` contains a synthetic bug triggered when the server response begins with the string `"crashycrashy"`. 

```c
static CURLcode verynormalprotocol_doing(struct Curl_easy *data, bool *done)
{
  CURLcode result = CURLE_WEIRD_SERVER_REPLY;
  ssize_t nread;
  char response[128];

  *done = FALSE;

  /* Read the response from the server. If we see the correct "heartbeat",
     we should complete the transaction and return CURLE_OK. */
  do {
    result = Curl_xfer_recv(data, response, 128, &nread);
  } while(result == CURLE_AGAIN);
  if(result) {
    /* ... */ 
  }
    
  else if(strcasecmp(response, "crashycrashy") == 0) {  /* <== COMPLICATED PATH CONDITION */
    *done = TRUE;
    *(unsigned int *)result = CURLE_OK;
  }

  /* ... */
  return result;
}

```

Traditional fuzzers struggle to generate inputs that satisfy this condition because it requires meeting two distinct requirements simultaneously:
1. The input must contain the substring `"crashycrashy"`
2. The substring must appear at a specific index

The probability of randomly generating a valid input is extremely low due to these dual requirements. Concolic execution excels at solving this type of problem.

## 2. Challenges
To implement concolic execution, we built upon existing hybrid fuzzing tools, including [SymCC](https://github.com/eurecom-s3/symcc) for C/C++, [SWAT](https://github.com/SWAT-project/SWAT) for Java, and [CrossHair](https://github.com/pschanely/CrossHair) for Python. However, we encountered two significant challenges during the integration process.

### C1. Out-of-Instrumentation Functions
First, these tools had limited support for functions residing in external libraries, which we refer to as *out-of-instrumentation* (OOI) functions. 
One example was the `strcasecmp` function in the example above, which is [not supported](https://github.com/eurecom-s3/symcc/blob/master/compiler/Runtime.cpp#L193) by SymCC.

### C2. Incompatible Path Constraint Representations
Second, the tools used incompatible representations for path constraints, making integration challenging. For instance, SymCC stores path constraints in memory as a `Z3_ast *` type, whereas SWAT emits path constraints as strings in the SMT-LIB2 format.

### Our Approach
We carefully designed the hybrid fuzzer to address both challenges. To support more OOI functions (**C1**), we developed an *offline LLM-based function modeling* technique to incrementally improve the concolic executor. To account for the differences in path constraint formats (**C2**), we decoupled the concolic executor from the solver component, which we call *SymState*. This approach significantly reduced engineering costs, as all language targets now share the same SymState module and benefit from the same optimizations. 

{{<image src="images/blog/afc/concolic-overview.png" alt="Architecture of our hybrid fuzzer" class="blog-image" position="center" webp="false">}}

The figure above illustrates the overall architecture of our hybrid fuzzer. We describe each component ([Concolic Executor](#concolic-executor) and [SymState](#symstate) in detail below.

<a name="concolic-executor"></a>
## 3. Concolic Executor

Our concolic executor addresses the challenge of *out-of-instrumentation* (OOI) functions through *offline LLM-based function modeling*. We also improved the SymCC toolchain's robustness against compilation errors by fixing bugs in the original codebase.

### Offline LLM-based Function Modeling
We discuss our approach in detail in a separate blog post: [Using LLMs to Model Out-of-Instrumentation Functions for Concolic Execution](https://team-atlanta.github.io/blog/post-llm-concolic/). In brief, our approach consists of three steps: 
1. Identify out-of-instrumentation functions via three-way differential testing
2. Use an LLM to generate function models
3. Validate the generated models by re-running the differential tests

The diagram below illustrates an example prompt and response for modeling the `recv` function from the C standard library.


### Compilation Robustness
We made our workflow robust against compilation failures by testing it 
against all OSS-Fuzz projects. Initial testing revealed that existing 
frameworks were susceptible to numerous compilation errors. 
For instance, when compiling the 411 C/C++ projects in OSS-Fuzz using 
SymCC, we encountered compilation errors in 161 projects. 
After analyzing and fixing each bug, we successfully compiled 
**409** of the 411 projects—a significant improvement 
from the original **250**.

#### SymQEMU-based Fallback

We also implemented a SymQEMU-based fallback mechanism for projects that failed to compile with SymCC. This involved executing the libfuzzer harnesses, which are guaranteed to compile, with SymQEMU. However, running the libfuzzer harnesses with SymQEMU resulted in suboptimal performance due to TCG instrumentation overhead. 

To mitigate this, we ran the harness in fuzzing mode (without any seed directory argument) and hooked into the `LLVMFuzzerTestOneInput` function to inject input bytes directly into memory. Our implementation uses shared memory and semaphore synchronization to efficiently pass input between the fuzzer and SymQEMU:

```c
// libfuzzer-shm.c - Shared memory mechanism for input injection
int libfuzzer_shm_init(void) {
    const char *shm_key_str = getenv("SYMQEMU_SHM");
    const char *worker_id_str = getenv("SYMQEMU_WORKER_IDX");
    
    // Map shared memory for input buffer
    int shm_fd = shm_open(shm_key_str, 0, 0666);
    libfuzzer_shm.input_buffer = 
        mmap(NULL, input_size, PROT_READ, MAP_SHARED, shm_fd, 0);
    
    // Setup semaphores for synchronization
    snprintf(buf, sizeof(buf), "symqemu-%s.start", worker_id_str);
    libfuzzer_shm.start_sem = sem_open(buf, 0, 0666, 0);
    snprintf(buf, sizeof(buf), "symqemu-%s.end", worker_id_str);
    libfuzzer_shm.end_sem = sem_open(buf, 0, 0666, 0);
    return 0;
}

int libfuzzer_shm_recv(uint8_t **data, size_t *size) {
    // Wait for input from fuzzer
    sem_wait(libfuzzer_shm.start_sem);
    
    // Read input size and data from shared memory
    *size = *(size_t *)libfuzzer_shm.input_buffer;
    *data = libfuzzer_shm.input_buffer + sizeof(size_t);
    return 0;
}
```

The hooking mechanism intercepts calls to `LLVMFuzzerTestOneInput` and other sanitizer functions:

```c
// libfuzzer-hooks.c - Hook into LLVMFuzzerTestOneInput
static bool libfuzzer_pre_hook(CPUState *cpu, DisasContextBase *s, 
                               uint64_t pc) {
    int symbol_id = libfuzzer_get_symbol_id_by_pc(pc);
    
    if (symbol_id == LIBFUZZER_SYMBOL_LLVM_FUZZER_TEST_ONE_INPUT) {
        // Begin symbolic execution when entering LLVMFuzzerTestOneInput
        pre_hook_libfuzzer_func(s, pc);
        libfuzzer_begin_symbolize(s);
        return false;
    }
    
    // Skip instrumentation for sanitizer coverage functions
    if (symbol_id != UNASSIGNED_LIBFUZZER_SYMBOL_ID) {
        switch (symbol_id) {
        case SANITIZER_COV_TRACE_CMP8:
        case SANITIZER_COV_TRACE_CMP4:
        case SANITIZER_WEAK_HOOK_MEMCMP:
        // ... other sanitizer functions
            libfuzzer_skip_trace_cov_func(s);
            return true;
        }
    }
    return false;
}
```

This approach allowed us to reuse the TCG instrumentation for multiple inputs without re-initialization. Additionally, we patched SymQEMU to skip instrumentation of SanitizerCoverage and AddressSanitizer runtime functions to avoid redundant symbolic tracking.

<a name="symstate"></a>
## 4. SymState
The SymState component comprises four submodules, three of which are duplicated in each core: the *Symbolic Trace Parser*, the *Solver*, and the *Solution Applier*. The *Solution DB* is shared across all cores and allows SymState to switch between two input generation regimes, depending on whether a solution is found in the database (i.e., the input has been observed previously by any other core).

For unobserved seeds, SymState follows a three-stage pipeline:
1. The Symbolic Trace Parser converts various path constraint formats emitted by the concolic executor (**SymCC** - *JSONized Z3 AST*, **SWAT** - *SMT-LIB2 String*) into a unified path constraint format
2. The Solver solves the path constraints and emits assignments
3. The Solution Applier transforms these assignments into concrete input bytes

Conversely, seeds previously processed by other cores bypass this pipeline entirely, leveraging our novel *fusing mutator* to generate new inputs based on existing ones.

### Our Unified Path Constraint Format
```json
```

### Fusing Mutator
We introduce the *Fusing Mutator*, a novel hybrid fuzzing technique that utilizes solutions from multiple seeds. The Fusing Mutator first selects random solutions from the Solution DB, then sequentially applies cached solutions to an input, generating a set of new inputs where each application builds upon the previous result. 

This technique has two advantages not present in existing hybrid fuzzers:
1. The fuzzer can create new inputs that satisfy path constraint properties of multiple seeds, allowing it to explore novel paths
2. It improves performance by reusing solutions from other cores, eliminating redundant execution and solving overhead

### Auxiliary Symbols
Our Solution Applier supports path constraints expressed in terms of higher-level symbols beyond individual bytes (e.g., `data[0]`). These auxiliary symbols significantly improve SymState's performance by eliminating the need to represent all path constraints at the byte level.

For example, we introduced the `ScanfExtract_{f,s,e,i}` symbol, which represents the value of the i-th variadic argument in an `sscanf` function call where the format string is `f` and the input string is `data[s:e]`. This symbol allows the solver to reason in terms of `sscanf` arguments directly rather than individual input bytes, avoiding the need to encode complex string parsing rules into SMT expressions. After the solver solves in terms of `ScanfExtract`, the Solution Applier uses the inverse operation `sprintf(output_str, fmt, arg1, arg2, ...)` to produce byte-level replacements.
