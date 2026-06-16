---
title: "OSS-CRS Tutorial"
meta_title: ""
description: ""
date: 2026-06-15T12:00:00Z
image: ""
categories: [""]
author: "Andrew Chin, Brian Lee"
tags: [""]
draft: true
---

This June, Team Atlanta presented an OSS-CRS tutorial at SVCC 2026 in San Jose. The session covered the basic setup process, gave participants a chance to run OSS-CRS themselves, and shared our experience building a personalized CRS. Because the tutorial showed both why CRS development matters and how anyone can contribute to OSS-CRS, we decided to make it publicly available for anyone interested in learning more.

## Setup

**Goal:** Prepare the basic environment for the labs.

OSS-CRS is designed to run on Linux. If you are using Windows, we recommend WSL. On macOS, we were able to reproduce the tutorial locally, but we recommend enabling Docker Desktop → Settings → General → "Use containerd for pulling and storing images".

For the official setup and preparation instructions, refer to the documentation in the OSS-CRS repository. We prepared a subset of CRSBench projects for the tutorial. Download it from [Google Drive](https://tinyurl.com/4nvnyxvu) and unzip it. You can unzip it anywhere, but the following commands assume that the benchmarks are inside the `oss-crs` directory.
   ```bash
   tar -xvf benchmarks.tar.gz
   ```
   
   The unzipped directory contains four entries: three tutorial benchmarks and one PoV that can be used later if Part 1 does not generate a PoV for the later parts.
## Part 1

**Goal:** Run a fuzzer-based CRS and watch it produce a crash.

**CRS-libFuzzer** is built entirely on libFuzzer, a widely used fuzzing engine. It does not use any LLM agents.

**What is fuzzing?** Fuzzing is an automated testing technique that finds bugs by repeatedly feeding a program mutated inputs and watching for abnormal behavior.

Key terms:
- **Harness** — a small adapter that turns the fuzzer's raw input bytes into real calls to the target's API.
- **Coverage** — a measure of which parts of the program an input executed. Fuzzers use coverage as feedback to identify inputs that reach new behavior. Interesting inputs become *seeds*.
- **Sanitizer** — compile-time instrumentation that adds runtime checks and aborts the moment a bug happens, acting as the crash oracle (e.g. **ASan** for memory safety, **UBSan** for undefined behavior). Crashing inputs become a **PoV**.

**Target:** `atlanta-mongoose-delta-01` — Mongoose, a small networking library for firmware/IoT devices. The harness (`fuzz`) builds a fake packet from fuzzer input and injects it into Mongoose's TCP/IP stack.

<details>
<summary>Harness of Mongoose - fuzz.c</summary>

```
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  // ...
  if (size > 0) {
    struct mip_cfg cfg = {};
    size_t pktlen = 1540;
    char t[sizeof(struct mip_if) + pktlen * 2 + 0 /* qlen */];
    struct mip_if *ifp = (struct mip_if *) t;
    struct mg_mgr mgr;
    mg_mgr_init(&mgr);
    if_init(ifp, &mgr, &cfg, &mip_driver_mock, NULL, pktlen, 0);

    // Make a copy of the random data, in order to modify it
    uint8_t pkt[size];
    struct eth *eth = (struct eth *) pkt;
    memcpy(pkt, data, size);
    if (size > sizeof(*eth)) {
      static size_t i;
      uint16_t eth_types[] = {0x800, 0x800, 0x806, 0x86dd};
      memcpy(eth->dst, ifp->mac, 6);  // Set valid destination MAC
      eth->type = mg_htons(eth_types[i++]);
      if (i >= sizeof(eth_types) / sizeof(eth_types[0])) i = 0;
    }

    mip_rx(ifp, (void *) pkt, size);
    mgr.priv = NULL;  // Don't let Mongoose free() ifp
    mg_mgr_free(&mgr);
  }

  return 0;
}
```

</details>

**Run CRS-libFuzzer:**

```bash
CRS=./example/crs-libfuzzer/compose.yaml
TARGET=benchmarks/atlanta-mongoose-delta-01 # or the path you unzipped the benchmark
HARNESS=fuzz

uv run oss-crs prepare --compose-file "$CRS"
uv run oss-crs build-target --compose-file "$CRS" --fuzz-proj-path "$TARGET"
uv run oss-crs run --compose-file "$CRS" --fuzz-proj-path "$TARGET" \
  --target-harness "$HARNESS" --timeout 300
```

When it finishes, you will see the PoVs and seeds it produced, similar to the path below. **Save the path to a PoV** — you will need it for patching in Part 2.
```
.../oss-crs/.oss-crs-workdir/crs_compose/43e5a06b0d32/address/runs/1781271789u6/crs/crs-libfuzzer/atlanta-mongoose-delta-01_6474d46de441/SUBMIT_DIR/fuzz/povs
```

**The bug it finds:** In `mip/mip.c : rx_icmp()`, the ICMP echo responder copies the payload after clamping it to the buffer length (`left`), but computes the checksum over the *raw* `pay.len`. When `pay.len` exceeds the buffer, the checksum reads past the end of the TX stack buffer, causing a **dynamic-stack-buffer-overflow**. The PoV is a ~131 KB Ethernet + IPv4 + ICMP-echo frame, with 42 B of framing plus padding.
```
static void rx_icmp(struct mip_if *ifp, struct pkt *pkt) {
  // …      
  struct ip *ip = tx_ip(ifp, 1, ifp->ip, pkt->ip->src,
                        sizeof(struct icmp) + pkt->pay.len);
  struct icmp *icmp = (struct icmp *) (ip + 1);
  size_t len = PDIFF(ifp->tx.buf, icmp + 1),
         left = ifp->tx.len - len;
  if (left > pkt->pay.len) left = pkt->pay.len;
  memset(icmp, 0, sizeof(*icmp));
  memcpy(icmp + 1, pkt->pay.buf, left);
  icmp->csum = ipcsum(icmp, sizeof(*icmp) + pkt->pay.len); // The vulnerable site
```

## Part 2

**Goal:** Run a patching CRS and confirm it fixes the vulnerability the fuzzer found.

**CRS-Claude-Code** is an LLM-based patching CRS built on the Claude Code agent. Given a PoV, it generates a patch, rebuilds the patched source through the builder/runner sidecars, and verifies that the bug no longer reproduces.

**Run it** (reuse the PoV path you saved in Part 1):

```bash
CRS=./example/crs-claude-code/compose.yaml
TARGET=benchmarks/atlanta-mongoose-delta-01
POV=<path to the PoV found in Part 1, make sure to give a specific PoV file inside the directory>
HARNESS=fuzz

uv run oss-crs prepare --compose-file "$CRS"
uv run oss-crs build-target --compose-file "$CRS" --fuzz-proj-path "$TARGET"
uv run oss-crs run --compose-file "$CRS" --fuzz-proj-path "$TARGET" \
  --target-harness "$HARNESS" --pov "$POV" --timeout 600
```

**Ground-truth patch:** The fix makes the checksum cover only the bytes that were actually copied (`left`) instead of the raw `pay.len`:

```diff
  memcpy(icmp + 1, pkt->pay.buf, left);
- icmp->csum = ipcsum(icmp, sizeof(*icmp) + pkt->pay.len);
+ icmp->csum = ipcsum(icmp, sizeof(*icmp) + left);
```

## Part 3

**Goal:** See where traditional fuzzing stalls but reasoning agents succeed.

**CRS-bug-finding-Claude-Code** is an LLM-based bug-finding CRS. Given source code, it identifies a bug, generates a PoV, builds and verifies it through the builder/runner sidecars, and repeats the process for distinct bugs within the time budget.

**Target:** `asc-nginx-delta-01` — Nginx, a high-performance web server widely used as a reverse proxy, load balancer, HTTP cache, and mail proxy.

<details>
<summary>Nginx harness - smtp_harness.c</summary>

The fuzzer input is injected into a fake socket, and the input is pushed through nginx's mail state machine.
  clean.
```
extern "C"
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size)
{ 
  // ...
  while (ngx_cycle->free_connection_n != 3) {
    ngx_process_events_and_timers((ngx_cycle_t *)ngx_cycle);

    if (process_counter == 25) {
      fprintf(stdout, "[ERROR] Bailing out of mail harness due to hitting counter maximum\n");
      fflush(stdout);

      // Get the set of existing connections
      c = ngx_cycle->connections;

      // Loop through the connections and release them
      for (int i = 0; i < cycle->connection_n; i++) {

        if (c[i].fd != -1 && c[i].fd != http_listen_fd) {
          ngx_close_connection(&c[i]);
          }
      }
    } else {
      process_counter += 1;
    }
  }
  // ...
```

</details>

**Run the reasoning CRS:**

```bash
CRS=./example/crs-bug-finding-claude-code/compose.yaml
TARGET=benchmarks/asc-nginx-delta-01
HARNESS=smtp_harness

uv run oss-crs prepare --compose-file "$CRS"
uv run oss-crs build-target --compose-file "$CRS" --fuzz-proj-path "$TARGET"
uv run oss-crs run --compose-file "$CRS" --fuzz-proj-path "$TARGET" \
  --target-harness "$HARNESS" --timeout 1200
```

(You can also point `crs-libfuzzer` at the same target to see how a plain fuzzer stalls on it.)

**The bug:** In `ngx_mail_smtp_handler.c : ngx_mail_smtp_noop()`, the SMTP NOOP handler should do nothing except reply `250 OK`. However, its bogus "more than 10 args" guard both destroys `c->pool`, freeing the session `s` and `s->buffer`, and returns `NGX_ERROR` to the dispatcher, which later reuses the freed frame. The result is a **heap-use-after-free**. The PoV is a 27-byte SMTP line with eleven space-separated arguments: `NOOP f f f f f f f f f f f \n`.
```
static ngx_int_t
ngx_mail_smtp_noop(ngx_mail_session_t *s, ngx_connection_t *c) {
  if (s->args.nelts > 10) {
    ngx_str_set(&s->out, smtp_invalid_argument);
    ngx_mail_close_connection(c); // destroys s and s->buffer
    return NGX_ERROR;
  }
  ngx_str_set(&s->out, smtp_noop);
  return NGX_OK;
}
```
```
rc = ngx_mail_smtp_noop(s, c); // call site of the destroyer
if (s->buffer->pos < s->buffer->last) // use-after-free
    s->blocked = 1;
```

## Part 4

**Goal:**
