---
title: "Jazzer+LibAFL: Insights into Java Fuzzing"
meta_title: ""
description: "How we incorporated LibAFL as a new fuzzing backend for Jazzer"
date: 2025-08-14T18:00:00Z
image: "/images/blog/crs-java/libafl-jazzer/jazzer_plus_libafl.png"
categories: ["Atlantis"]
author: "Ammar Askar"
tags: ["retrospective", "java"]
draft: true
---

AIxCC involved finding bugs in software written in two languages: C++ and *Java*.
The focus of the competition was on the use of LLMs and AI, however, our teams
approach was to balance ambitious strategies alongside proven traditional
bug-finding techniques like fuzzing.
While our team was deeply familiar with fuzzing C++ from decades of academic
research and industry work, Java was uncharted territory for us.
In part of our Java fuzzing development we created a fork of Jazzer that uses
LibAFL as the fuzzing backend and it is available as
[part of our open source release](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/fuzzers/atl-libafl-jazzer).
This post details some of the lessons we learned about Java fuzzing and the
creation of this fork.

DARPA chose [Jazzer](https://github.com/CodeIntelligenceTesting/jazzer/) as
their baseline fuzzer and sanitizer framework for Java challenges.

## Jazzer

[Jazzer](https://github.com/CodeIntelligenceTesting/jazzer/) is an open-source
Java Fuzzer developed by the *Code Intelligence* company. It makes use of
LibFuzzer (written in C++) using the [Java Native Interface](https://en.wikipedia.org/wiki/Java_Native_Interface) (JNI).
The architecture of Jazzer is roughly:

<span style="color: lightcyan">

```goat
     Java           |                C++
                    |
                    |    +------------------------+
                    |    |        LibFuzzer       |
  .---------.   JNI |    |- - - - - - - - - - - - |
 |   Jazzer  | --------> | 1. LLVMFuzzerRunDriver |
  '---------'       |    +------------------------+
                    |    | 2.  *fuzzing loop*     |
  .----------.  JNI |    | fuzz_target_runner.cpp |
  | runOne() | <-------- |      testOneInput      |
   '---+----'       |    +------------------------+
       |            |                 ^
       v            |                 |
   .--------.       |                 |
  /  Target  \   SanCov   +---------------------------+
 /   Program  \ --------> | Update LibFuzzer feedback |
'--------------'    |     +---------------------------+
                    |
```

</span>

Jazzer begins by using the JNI to make a call to `LLVMFuzzerRunDriver` which is [LibFuzzer's
recommended way of using it as a library](https://llvm.org/docs/LibFuzzer.html#using-libfuzzer-as-a-library).
This starts the C++ fuzzing loop inside libFuzzer where Jazzer's stub fuzz driver
`fuzz_target_runner.cpp` implements a `testOneInput` method. This method is very
simple and uses the JNI to
call to a `private static int runOne(long dataPtr, int dataLength)` in Java.

From here, Jazzer takes the `void*` input from LibFuzzer and converts it into
the appropriate type before handing it off to the Java fuzzing entrypoint such
as `fuzzerTestOneInput(byte[] input)`.

On the Java side of things, Jazzer makes use of the [JaCoCo](https://github.com/jacoco/jacoco)
code coverage library and [ASM](https://asm.ow2.io/) to inject instrumentation
hooks into the program's edges. These coverage tracking hooks insert a call to
the `recordCoverage(int id)` method in `CoverageMap.java`. Jazzer here uses the
`UNSAFE.putByte` function from [`sun.misc.Unsafe`](https://mishadoff.com/blog/java-magic-part-4-sun-dot-misc-dot-unsafe/)
to directly write the edge into the coverage map memory location.
LibFuzzer makes use of the [LLVM Sanitizer Coverage](https://clang.llvm.org/docs/SanitizerCoverage.html)
(SanCov) API to receive coverage feedback. Jazzer hooks into this system by using
the `__sanitizer_cov_pcs_init` method to set where in memory the coverage map is
being stored.

When control flow returns from the Java `fuzzerTestOneInput` program and flows
back to the fuzzing loop inside LibFuzzer, it can now mutate the input and we
can successfully fuzz a Java program.

*Note: This explanation glosses over details such as how Jazzer also instruments
comparison functions and provides them to LibFuzzer for value-feedback based
mutation*.

## The State of Jazzer and LibFuzzer

Unfortunately, right as the AIxCC competition started, Code Intelligence
[announced](https://github.com/CodeIntelligenceTesting/jazzer/commit/d3a916932583fcdcf92deca1a57eaffafc96d4b5)
that they had stopped maintaining Jazzer as an open-source project in favor of
their commercial offerings. That change has since been reverted, however, Jazzer
has not had any substantial new features or optimizations made to it since then.

Additionally, LibFuzzer, while it is a very mature and well-built fuzzer is also
on maintenance mode. LibFuzzer was created by [Kostya Serebryany](https://x.com/kayseesee)
under the LLVM umbrella when he was employed at Google but since then Google's
priorities have shifted. The LibFuzzer documentation notes:

> The original authors of libFuzzer have stopped active work on it and switched
> to working on another fuzzing engine, [Centipede](https://github.com/google/centipede). LibFuzzer is still fully
> supported in that important bugs will get fixed. However, please do not expect
> major new features or code reviews, other than for bug fixes.

Just because Jazzer and LibFuzzer are in maintenance mode doesn't mean the
rest of the fuzzing community is. Projects like [AFL++](https://aflplus.plus/)
have continued to incorporate ideas from research work and industry creating
far more capable fuzzers.

## Jazzer+LibAFL

This brings us to one area we worked on: using [LibAFL](https://github.com/AFLplusplus/LibAFL)
as the fuzzing engine for Jazzer instead of LibFuzzer. **LibAFL** is an
awesome project that can be summarized as a fuzzer-library. Instead of an
end-to-end fuzzer, you code the bits of glue that deliver your fuzzing payload
and provide feedback and in return you get a fast performant fuzzer.

Importantly for us, LibAFL contains a sub-project called [libafl_libfuzzer](https://github.com/AFLplusplus/LibAFL/tree/main/crates/libafl_libfuzzer).
This is meant to be a drop-in replacement for LibFuzzer that can use harnesses
and binaries built for LibFuzzer but fuzz them using LibAFL. This seemed like a
great thing to try out for us to get the advanced features in LibAFL for free.
As some of our past work like [autofz](https://github.com/sslab-gatech/autofz) has
demonstrated, ensembling a bunch of different fuzzers with varying characteristics
tends to yield great results when fuzzing.

### Implementation

It wasn't quite a drop-in replacement experience for us: it turned out
that Jazzer actually used a fork for LibFuzzer with some changes made and
libafl_libfuzzer wasn't entirely feature-complete. However, a few days of
integration left us with a Jazzer derivative that seemed to be able to explore
code paths complimentary to the base fuzzer. Some of the notable changes we had
to make are below:

1. Jazzer added a feature to LibFuzzer to allow the fuzzing loop to stop and
   [return control](https://github.com/CodeIntelligenceTesting/llvm-project-jazzer/commit/a867910ccc85ee594c4d01d7329c1ce89316841f)
   to the caller of `LLVMFuzzerRunDriver` instead of killing the entire program.
   
   We added the [same feature](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/aab598f569ccb5cfc3bacf2a2533e817f24fe8c9/example-crs-webservice/crs-java/crs/fuzzers/jazzer-libafl/libafl_libfuzzer/runtime/src/lib.rs#L510-L518) in libafl_libfuzzer:

   ```rust
    let result = unsafe { crate::libafl_libfuzzer_test_one_input(Some(*$harness), buf.as_ptr(), buf.len()) };
    match result {
        -2 => {
            // A special value from Jazzer indicating we should stop
            // the fuzzer but not kill the whole program.
            *stop_fuzzer.borrow_mut() = true;
            eprintln!("[libafl] Received -3 from harness, setting stop.");
            ExitKind::Crash
        }
   ```

2. Sanitizers in C/C++ programs usually trigger signals to indicate an issue,
   such as AddressSanitizer (ASan) raising a SIGSEGV when it detects an error.
   Jazzer instead uses a method called [`__jazzer_set_death_callback`](https://github.com/CodeIntelligenceTesting/llvm-project-jazzer/commit/6d0cb05063599ad1c9edd16f7e88f4e0c50aa2d5)
   to indicate a corpus triggered an issue in a sanitizer. We added this 
   [same function](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/main/example-crs-webservice/crs-java/crs/fuzzers/jazzer-libafl/libafl_targets/src/libfuzzer/mutators.rs#L58-L79) to our libafl_libfuzzer.

3. As mentioned previously, LibFuzzer uses [SanCov](https://clang.llvm.org/docs/SanitizerCoverage.html)
   to gather coverage information. This isn't the only thing that SanCov
   provides though: in an effort to quickly find magic numbers like
   `0xdeadbeef` when fuzzing, SanCov also hooks onto comparisons and calls methods
   like `__sanitizer_cov_trace_cmp8` to indicate a comparison between two
   8-byte numbers. This method is implemented like so in LibFuzzer:

   ```cpp
    void __sanitizer_cov_trace_cmp8(uint64_t Arg1, uint64_t Arg2) {
        uintptr_t PC = reinterpret_cast<uintptr_t>(GET_CALLER_PC());
        fuzzer::TPC.HandleCmp(PC, Arg1, Arg2);
    }
   ```

   Notice that it uses a macro to retrieve the calling program counter. If Jazzer
   were to use these methods from the JNI directly, they would all register with
   the same program counter. Hence Jazzer adds [variants of these methods](https://github.com/CodeIntelligenceTesting/llvm-project-jazzer/commit/ea935a35f9c70a56e30fe76fbc8a6b6229de6028)
   such as `__sanitizer_cov_trace_cmp8_with_pc` that pass the program counter.

   We implemented these same [`_with_pc` SanCov functions](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/aab598f569ccb5cfc3bacf2a2533e817f24fe8c9/example-crs-webservice/crs-java/crs/fuzzers/jazzer-libafl/libafl_targets/src/sancov_cmp.c#L97-L107).

4. LibFuzzer also gathers data on comparisons performed in `strcmp`, `memcmp`
   and other common libc functions to find magic strings. This is done by
   intercepting calls to these methods in `FuzzerInterceptors.cpp`:

   ```cpp
   static void fuzzerInit() {
        ...
        REAL(memcmp) = reinterpret_cast<memcmp_type>(
            getFuncAddr("memcmp", reinterpret_cast<uintptr_t>(&memcmp)));
        ...
   }

    ATTRIBUTE_INTERFACE int memcmp(const void *s1, const void *s2, size_t n) {
        int result = REAL(memcmp)(s1, s2, n);
        void *caller_pc = GET_CALLER_PC();
        __sanitizer_weak_hook_memcmp(caller_pc, s1, s2, n, result);
        return result;
    }
   ```

   and then sending the arguments and result to functions like `__sanitizer_weak_hook_memcmp`.
   Here we encountered two issues, libafl_libfuzzer lacked implementations for
   `__sanitizer_weak_hook_memmem` and `__sanitizer_weak_hook_strstr`.
   We added [those two methods](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/aab598f569ccb5cfc3bacf2a2533e817f24fe8c9/example-crs-webservice/crs-java/crs/fuzzers/jazzer-libafl/libafl_targets/src/sancov_cmp.rs#L207-L240).

   Additionally, Jazzer had implemented a custom hook function called
   [`__sanitizer_weak_hook_compare_bytes`](https://github.com/CodeIntelligenceTesting/llvm-project-jazzer/commit/8e6065d80e4f537a965c0f0d65be237554359126)
   which we also had to [implement](https://github.com/Team-Atlanta/aixcc-afc-atlantis/blob/aab598f569ccb5cfc3bacf2a2533e817f24fe8c9/example-crs-webservice/crs-java/crs/fuzzers/jazzer-libafl/libafl_targets/src/sancov_cmp.rs#L241-L273).

There were also many other smaller changes such as making the libafl_libfuzzer
crash filenames match the filename that LibFuzzer uses. We are thankful to the
Jazzer team for having such a thorough set of unit tests and integration tests
that allowed us to be confident our fork of Jazzer would work.

### The Bugs!

During this process we found a few bugs in the `libafl_libfuzzer` drop-in
replacement. We fixed some of these locally and reported them upstream wherever
we could.

1. A build issue had caused the function interceptor hooks like `__sanitizer_weak_hook_memcmp`
   to become dead. This meant that these hooked functions were just silently
   never getting called reducing the feedback the fuzzer had to work with.

   https://github.com/AFLplusplus/LibAFL/issues/3043

2. The calls for constant comparisons such as `__sanitizer_cov_trace_cmp8` to
   represent 8-byte integer comparison had an incorrect macro implementation
   causing all comparisons to be considered as 1-byte.

   https://github.com/AFLplusplus/LibAFL/issues/3094

3. `libafl_libfuzzer` is sometimes unable to solve some simple harnesses because
   its memory-comparison hooks do not provide feedback on how close the values
   being compared are.

   https://github.com/AFLplusplus/LibAFL/issues/3042

   We reported this bug upstream but did not contribute our fix because it was
   a little hacky.


### Reference

- [Code Repo](https://github.com/Team-Atlanta/aixcc-afc-atlantis/tree/main/example-crs-webservice/crs-java/crs/fuzzers)
