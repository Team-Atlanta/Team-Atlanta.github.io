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

The steps below cover the setup used in the tutorial. For the official setup and preparation instructions, refer to the documentation in the OSS-CRS repository.

1. **Install prerequisites**
   `uv` and `docker` must be installed, `systemd` should be the init system, and sudo access is required. You also need the Docker plugins, especially on WSL, where they are not installed by default.
   ```bash
   sudo apt install docker-buildx
   sudo apt install docker-compose-v2
   ```

2. **Clone OSS-CRS**
   
   Clone OSS-CRS. Most of the tutorial will run from inside the cloned directory.
   ```bash
   git clone https://github.com/ossf/oss-crs.git
   cd oss-crs
   ```

3. **Download and unzip the target projects**:
   
   We prepared a subset of CRSBench projects for the tutorial. Download it from [Google Drive](https://tinyurl.com/4nvnyxvu) and unzip it. You can unzip it anywhere, but the commands below assume that the benchmarks are inside the `oss-crs` directory.
   ```bash
   tar -xvf benchmarks.tar.gz
   ```
   
   The unzipped directory contains four entries: three tutorial benchmarks and one PoV that can be used later if Part 1 does not generate a PoV for the later parts.

4. **Set up OSS-CRS**

   Run the setup command in `oss-crs`. This installs the basic files and modules needed to run a CRS.
   ```bash
   uv run oss-crs setup
   ```
    > **Troubleshooting:** If you hit a `cgroup.subtree_control: No such file or directory` error, enable the `cpuset` controller:
    >
    > ```bash
    > echo "+cpuset" | sudo tee /sys/fs/cgroup/user.slice/cgroup.subtree_control
    > echo "+cpuset" | sudo tee /sys/fs/cgroup/user.slice/user-1000.slice/cgroup.subtree_control
    > ```
    > If this still does not work, you can ignore the cgroup setting for this tutorial. It is used to run the CRS more efficiently, but the tutorial tasks are not heavy enough to require it.


5. **Set up LiteLLM keys.** 

   If you have a LITELLM proxy, put the key and base URL in `.env`:

   ```
   EXTERNAL_LITELLM_API_KEY=<received key>
   EXTERNAL_LITELLM_API_BASE=https://goldbug.gtisc.gatech.edu:41414
   ```

   If you prefer to use your own AI subscription, configure `.env` with the appropriate environment variable names.

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
#define MG_ENABLE_SOCKET 0
#define MG_ENABLE_LOG 0
#define MG_ENABLE_LINES 1
#define MG_ENABLE_MIP 1

#include "mongoose.c"

#include "driver_mock.c"

#ifdef __cplusplus
extern "C" int LLVMFuzzerTestOneInput(const uint8_t *, size_t);
#else
int LLVMFuzzerTestOneInput(const uint8_t *, size_t);
#endif

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
  mg_log_set(MG_LL_NONE);

  struct mg_dns_message dm;
  mg_dns_parse(data, size, &dm);
  mg_dns_parse(NULL, 0, &dm);

  struct mg_http_message hm;
  mg_http_parse((const char *) data, size, &hm);
  mg_http_parse(NULL, 0, &hm);

  struct mg_str body = mg_str_n((const char *) data, size);
  char tmp[256];
  mg_http_get_var(&body, "key", tmp, sizeof(tmp));
  mg_http_get_var(&body, "key", NULL, 0);
  mg_url_decode((char *) data, size, tmp, sizeof(tmp), 1);
  mg_url_decode((char *) data, size, tmp, 1, 1);
  mg_url_decode(NULL, 0, tmp, 1, 1);

  struct mg_mqtt_message mm;
  mg_mqtt_parse(data, size, 0, &mm);
  mg_mqtt_parse(NULL, 0, 0, &mm);
  mg_mqtt_parse(data, size, 5, &mm);
  mg_mqtt_parse(NULL, 0, 5, &mm);

  mg_sntp_parse(data, size);
  mg_sntp_parse(NULL, 0);

  char buf[size * 4 / 3 + 5];  // At least 4 chars and nul termination
  mg_base64_decode((char *) data, (int) size, buf);
  mg_base64_decode(NULL, 0, buf);
  mg_base64_encode(data, (int) size, buf);
  mg_base64_encode(NULL, 0, buf);

  mg_globmatch((char *) data, size, (char *) data, size);

  struct mg_str k, v, s = mg_str_n((char *) data, size);
  while (mg_commalist(&s, &k, &v)) k.len = v.len = 0;

  int n;
  mg_json_get(mg_str_n((char *) data, size), "$", &n);
  mg_json_get(mg_str_n((char *) data, size), "$.a.b", &n);
  mg_json_get(mg_str_n((char *) data, size), "$[0]", &n);

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

```
// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////////
extern "C" {
#include <ngx_config.h>
#include <ngx_core.h>
#include <ngx_event.h>
#include <ngx_mail.h>
#include <ngx_http.h>
#include <ngx_mail_pop3_module.h>
#include <ngx_process_cycle.h>
#include <string.h>
#include <sys/sendfile.h>
}

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <stdint.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <grp.h>
#include <pwd.h>
#include <sys/ioctl.h>
#include <sys/epoll.h>
#include <sys/syscall.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/select.h>
#include <errno.h>
#include <sys/uio.h>

static char configuration[] =
"events {\n"
"    worker_connections 4;\n"
"    multi_accept off;\n"
"    accept_mutex off;\n"
"}\n"
"daemon off;\n"
"mail {\n"
"    error_log stderr emerg;\n"
"    # Specify the authentication server\n"
"    auth_http localhost:9999;\n"
"    server {\n"
"        listen 80;\n"
"        protocol smtp;\n"
"        smtp_auth plain;\n"
"    }\n"
"}\n";

static ngx_cycle_t *cycle;
static ngx_log_t ngx_log;
static ngx_open_file_t ngx_log_file;
static char *my_argv[2];
static char arg1[] = {0, 0xA, 0};

extern char **environ;

int http_auth_fd = -1;
int auth_done = 0;

int mail_proxy_fd = -1;
int start_send = 0;
int received_quit = 0;
int final_ok_sent = 0;

int http_listen_fd = -1;
int http_client_fd = -1;

static const char *config_file = "/tmp/http_config.conf";

int pipefd[2];

// Opens a pipe, dupes that over the opened client socket and writes the fuzz data there
int setup_pipe_data(const uint8_t *data, size_t size)
{
  ssize_t numBytes;
  int flags;

  // If the client isn't connected then that is bad
  if (http_client_fd == -1) {
    exit(-1);
  }

  if (pipe(pipefd) == -1) {
    perror("pipe");
    exit(-1);
  }

  // Write the data then close the write end of the pipe
  numBytes = write(pipefd[1], data, size);
  if (numBytes == -1) {
    perror("write");
    exit(-1);
  }

  // Set the read end of the pipe to non-blocking
    flags = fcntl(pipefd[0], F_GETFL, 0);
    if (flags == -1) {
        perror("fcntl F_GETFL");
        exit(-1);
    }

    if (fcntl(pipefd[0], F_SETFL, flags | O_NONBLOCK) == -1) {
        perror("fcntl F_SETFL");
        exit(-1);
    }

  // Dup the read end of the pipe over the client fd
  if (dup2(pipefd[0], http_client_fd) == -1) {
        perror("dup2");
        exit(-1);
    }

  return 0;

}

// Create a base state for Nginx without starting the server
extern "C" int InitializeNginx(void)
{
  ngx_log_t *log;
  ngx_cycle_t init_cycle;
  ngx_core_conf_t  *ccf;

  ngx_debug_init();

  // Just output logs to stderr
  ngx_log.file = &ngx_log_file;
  ngx_log.log_level = NGX_LOG_EMERG;
  ngx_log_file.fd = ngx_stderr;
  log = &ngx_log;

  ngx_memzero(&init_cycle, sizeof(ngx_cycle_t));
  init_cycle.log = log;
  ngx_cycle = &init_cycle;

  init_cycle.pool = ngx_create_pool(1024, log);

  // Set custom argv/argc
  my_argv[0] = arg1;
  my_argv[1] = NULL;
  ngx_argv = ngx_os_argv = my_argv;
  ngx_argc = 0;

  if (ngx_strerror_init() != NGX_OK) {
    fprintf(stdout, "[ERROR] !!Failed to ngx_strerror_init\n");
    exit(-1);
  }

  ngx_time_init();

  ngx_regex_init();
  
  // Weird trick to free a leaking buffer always caught by ASAN
  // We basically let ngx overwrite the environment variable, free the leak and
  // restore the environment as before.
  char *env_before = environ[0];
  environ[0] = my_argv[0] + 1;

  if (ngx_os_init(log) != NGX_OK) {
    return 1;
  }

  free(environ[0]);
  environ[0] = env_before;

  ngx_crc32_table_init();

  ngx_slab_sizes_init();

  ngx_preinit_modules();

  FILE *fptr = fopen(config_file, "w");
  fprintf(fptr, "%s", configuration);
  fclose(fptr);
  init_cycle.conf_file.len = strlen(config_file);
  init_cycle.conf_file.data = (unsigned char *) config_file;

  cycle = ngx_init_cycle(&init_cycle);

  if ( cycle == NULL ) {
    fprintf(stdout, "[ERROR] init cycle failed probably bad config\n");
    exit(-1);
  }
  ngx_os_status(cycle->log);

  ngx_cycle = cycle;

  ccf = (ngx_core_conf_t *) ngx_get_conf(cycle->conf_ctx, ngx_core_module);
  
  if (ccf->master && ngx_process == NGX_PROCESS_SINGLE) {
    ngx_process = NGX_PROCESS_MASTER;
  }


  if (ngx_create_pidfile(&ccf->pid, cycle->log) != NGX_OK) {
    fprintf(stdout, "[ERROR] !!Failed to ngx_create_pidfile\n");
    exit(-1);
  }
  
  if (ngx_log_redirect_stderr(cycle) != NGX_OK) {
    fprintf(stdout, "[ERROR] !!Failed to ngx_log_redirect_stderr\n");
    exit(-1);
  }

  ngx_event_flags = 1;
  ngx_queue_init(&ngx_posted_accept_events);
  ngx_queue_init(&ngx_posted_next_events);
  ngx_queue_init(&ngx_posted_events);
  ngx_event_timer_init(cycle->log);

  for (int i = 0; cycle->modules[i]; i++) {
    if (cycle->modules[i]->init_process) {
      if (cycle->modules[i]->init_process(cycle) == NGX_ERROR) {
        //fatal
        exit(2);
      }
    }
  }

  return 0;
}

extern "C"
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size)
{ 
  static int init = InitializeNginx();
  if(init != 0) {
    fprintf(stdout, "[ERROR] Init failed\n");
    exit(0);
  }

  ngx_connection_t  *c;

  // Counter to ensure that no input can trigger an infinite loop
  int process_counter = 0;
  
  // This being here triggers a call to accept. The wrappers will handle the call
  //  and create the first socket.
  ngx_process_events_and_timers((ngx_cycle_t *)ngx_cycle);

  // Create the pipe that will allow nginx to read the data as if it were a socket.
  setup_pipe_data( data, size );

  // The accept takes a connection, which drops the free connection count to 2. There
  //    could also be a connection to the http auth server which takes up a connection
  //    as well as a connection to the mail proxy. The auth server connection will likely
  //    be disconnected prior to the proxy. Once all these connections are done it means
  //    that there is no additional data in the pipe previously set up so it is time to bail.
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

  // Clean up the pipes
  close(pipefd[0]);
  close(pipefd[1]);

  // Make sure that all of the global state variables are reset.
  auth_done = 0;
  mail_proxy_fd = -1;
  start_send = 0;
  received_quit = 0;
  final_ok_sent = 0;

  http_client_fd = -1;

  return 0;
}

/*************
 * The code below here are wrappers that mimic the network traffic expected
 * of a mail proxy. They will be specific to each fuzzer and so must be
 * included in the fuzzer itself. Initially, when there was just the single
 * http fuzzer these were separate but with additional fuzzers comes the
 * need for individualized wrappers.
 * ************/
extern "C" typeof (writev) __real_writev;

extern "C"
ssize_t __wrap_writev(int fd, const struct iovec *iov, int iovcnt)
{ 
  return __real_writev(fd, iov, iovcnt);
}

extern "C"
int __wrap_ioctl(int fd, unsigned long request, ...) {
  return 0;
}

extern "C"
int __wrap_connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen)
{
  struct sockaddr_in *sin = (struct sockaddr_in*)addr;

  // This is for the auth connection
  if (ntohs(sin->sin_port) == 9999 ) {
    http_auth_fd = sockfd;
    return 0;
  } else if (ntohs(sin->sin_port) == 9998 ) {
    mail_proxy_fd = sockfd;

    received_quit = 0;
    final_ok_sent = 0;

    return 0;
  }

  return 0;
}

extern "C"
ssize_t __wrap_recv(int sockfd, void *buf, size_t len, int flags)
{
  ssize_t count;
  ssize_t res;
  char c;

  // This is a workaround for a wierd behavior of nginx. I don't know if it is a bug or not
  // It is in the ngx_unix_recv. If the length returned is equal to the size requested
  //   the rev->ready is not set to 0. This causes the select event to be deleted and
  //   it will stop reading from the socket. I am probably doing something wrong but this
  //   is an ok work around for the moment.
  size_t max_len = len - 1;

  // Specific handler for the auth connection
  if (sockfd == http_auth_fd && !auth_done) {
    auth_done = 1;
    strncpy((char*)buf, 
      "HTTP/1.1 200 OK\r\nAuth-Status: OK\r\nAuth-Server: 127.0.0.1\r\nAuth-Port: 9998\r\n\r\n",
      max_len);
    return strlen((char*)buf);

  } else if (sockfd == http_auth_fd ) {
    strncpy((char*)buf, "250 Ok\r\n", max_len);
    return strlen((char*)buf);
  }
  
  // Handle the commands that are proxied in
  if ( sockfd == mail_proxy_fd && !start_send) {
    start_send = 1;
    strncpy((char*)buf, "220 smtp.aixcc.com ESMTP\r\n", max_len);
    return strlen((char*)buf);
  } else if (sockfd == mail_proxy_fd ) {
    // If the proxy has received a QUIT then it is time to start closing down
    // Send the final ok then close it out
    if ( received_quit == 1 ) {
      final_ok_sent = 1;
    }

    if ( received_quit == 1 && final_ok_sent == 1 ) {
      return 0;
    }

    strncpy((char*)buf, "250 Ok\r\n", max_len);


    return strlen((char*)buf);
  }

  if (sockfd == http_client_fd ) {
    count = 0;

      while ( count < max_len ) {
        res = syscall(SYS_read, sockfd, &c, 1);

        if (res == 0 ) {
          return -1;
        } else if ( res < 0 ) {
          close(sockfd);

          return res;
        }
        
        ((char *)buf)[count++] = c;

        if ( c == '\n') {
          return count;
        }
      }

      return count;
  }

  return len;
}

extern "C"
int __wrap_bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen) {
  http_listen_fd = sockfd;

  return 0;
}

extern "C"
int __wrap_open(const char *pathname, int flags, mode_t mode)
{
  int fd = syscall(SYS_open, pathname, flags, mode);

  return fd;
}

extern "C"
int __wrap_close(int sockfd) {
  if (sockfd == http_auth_fd ) {
    http_auth_fd = -1;
    auth_done = 0;
  }

  if (sockfd == mail_proxy_fd ) {
    mail_proxy_fd = -1;

    start_send = 0;
    received_quit = 0;
    final_ok_sent = 0;
  }

  if (sockfd == http_client_fd ) {
    http_client_fd = -1;
  }

  if ( sockfd != 255 && sockfd != 256 && sockfd != 257 ) {
    return syscall(SYS_close, sockfd);
  }

  return 0;
}

extern "C"
ssize_t __wrap_send(int sockfd, const void *buf, size_t len, int flags)
{

  if ( sockfd == http_auth_fd ) {
  } else if ( sockfd == mail_proxy_fd ) {

    // When QUIT\r\n is received it is time to end the proxy connection
    if ( memcmp( buf, "QUIT\r\n", 6) == 0) {
      received_quit = 1;

    }
  } else if (sockfd == http_client_fd ) {
  } else {
  }

  for( size_t i = 0; i < len; i++) {
  }

  return len;
}

extern "C"
int __wrap_select(int nfds, fd_set *readfds, fd_set *writefds,
                  fd_set *exceptfds, struct timeval *timeout)
{
  int count = 0;

  if ( readfds ) {
    if ( http_auth_fd != -1) {
      FD_SET(http_auth_fd, readfds);

      count++;
    }

    if ( http_client_fd != -1) {
      FD_SET(http_client_fd, readfds);

      count++;
    }

    if ( mail_proxy_fd != -1) {
      FD_SET(mail_proxy_fd, readfds);

      count++;
    }

    if ( http_listen_fd != -1) {
      FD_SET(http_listen_fd, readfds);

      count++;
    }
  }

  if ( writefds ) {
    if ( http_auth_fd != -1) {
      FD_SET(http_auth_fd, writefds);

      count++;
    }

    if ( http_client_fd != -1) {
      FD_SET(http_client_fd, writefds);

      count++;
    }

    if ( mail_proxy_fd != -1) {
      FD_SET(mail_proxy_fd, writefds);

      count++;
    }
  }

  return count;
}

extern "C"
ssize_t __wrap_read(int fd, void *buf, size_t count)
{
  return 0;
}

extern "C"
int __wrap_epoll_create(int size) {
  return 256;
}

extern "C"
int  __wrap_epoll_create1(int flags) {
  return 256;
}

extern "C"
int __wrap_epoll_ctl(int epfd, int op, int fd, struct epoll_event *event) {
  return 0;
}

extern "C"
int __wrap_epoll_wait(int epfd, struct epoll_event *events,
                      int maxevents, int timeout) {
  events[0].data.fd = 255; // Use this fd everywhere
  return 1;
}

extern "C"
int __wrap_accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen) {
  struct sockaddr_in * sin = (struct sockaddr_in *)addr;

  // If this is the accept to take in the fake client then give it a valid socket
  if ( sockfd == http_listen_fd && http_client_fd == -1) {
    http_client_fd = syscall(SYS_socket, AF_INET, SOCK_STREAM, 0);

    sin->sin_family = AF_INET;
    sin->sin_port = htons(9999);
    sin->sin_addr.s_addr = 0x0100007f; // "127.0.0.1"

    return http_client_fd;
  }

  // We don't actually want to accept new connections aside from the main one
  // This causes the accept to return but then bails out of the ngx_accept_event() call quickly
  errno = 11; // NGX_EAGAIN
  
  return -1;
}

extern "C"
int __wrap_accept4(int sockfd, struct sockaddr *addr, socklen_t *addrlen, int flags) {
  return 0;
}

extern "C"
int __wrap_shutdown(int socket, int how)
{ 
  return 0; 
}

extern "C"
ssize_t __wrap_listen(int fd, int backlog)
{ 
  return 0; 
}

extern "C"
int __wrap_setsockopt(int fd, int level, int optname, const void *optval,
                      socklen_t optlen) {
  return 0;
}

extern "C"
int __wrap_getsockopt(int sockfd, int level, int optname,
                      void *optval, socklen_t *optlen)
{
  int *n = (int*)optval;

  *n = SOCK_STREAM;

  return 0;
}

extern "C"
int __wrap_chmod(const char *pathname, mode_t mode){
  return 0;
}

extern "C"
int __wrap_chown(const char *pathname, uid_t owner, gid_t group){
  return 0;
}

struct passwd pwd;
struct group grp;

extern "C"
struct passwd *__wrap_getpwnam(const char *name){
  pwd.pw_uid = 1;
  return &pwd;
}

extern "C"
struct group *__wrap_getgrnam(const char *name){
  grp.gr_gid = 1;
  return &grp;
}

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
