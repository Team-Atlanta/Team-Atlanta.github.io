---
title: "Hacking Redefined: How LLM Agents Took on University Hacking Competition"
meta_title: ""
description: "Atlantis in CTF competitions"
date: 2024-12-01T12:15:00Z
image: "/images/blog/tkctf2024/ai-vs-human.png"
categories: ["Milestone"]
author: "Hanqing Zhao"
tags: ["Atlantis CRS"]
draft: true
---

For the first time, 
we deployed our hybrid system powered by LLM agents, [Atlantis](/blog/post-atl), 
to participate in Georgia Tech’s flagship CTF competition, 
[TKCTF 2024](https://tc.gts3.org/cs6265/2024-fall/ctf.html).
During the competition, 
Atlantis focused on two key areas: 
vulnerability analysis and automatic vulnerability remediation. 
Impressively, our system identified 10 vulnerabilities and 
generated 7 sound patches[^1], 
demonstrating the effectiveness of our approach in a real-world 
hacking competition.

In this blog, 
I’ll share some interesting observations and key lessons we learned during the CTF. 
Notably, following the AIxCC competition, 
we plan to open-source all the details of our system, 
in line with AIxCC competition rules.

While this might seem like just another step forward for CTF competitions, 
it represents a significant milestone in our journey toward advancing LLM-based security research. 
The achievements of Atlantis at TKCTF would not have been possible without 
the dedication and expertise of our incredible team:
[Andrew Chin](/authors/andrew-chin),
[Jiho Kim](/authors/jiho-kim/),
[Gyejin Lee](/authors/gyejin-lee/),
[Seunggi Min](/authors/seunggi-min/),
[Kevin Stevens](/authors/kevin-stevens/),
[Woosun Song](/authors/woosun-song/), and
[Hanqing Zhao](/authors/hanqing-zhao/),

We invite you to follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
to stay updated on our work at the intersection of AI and security.

[^1]: Fully sound patches not only address the actual root causes
but also keep the correct behaviors.

## AIxCC, Atlantis CRS, and CTF

AI Cyber Challenge (AIxCC) is a two year competition that 
aims to advance the state of the art in AI-based security research.
We, Team Atlanta, are one of the 7 final teams, proposing a new cyber reasoning system, 
[Atlantis CRS](/blog/post-atl).

The core idea of our system is simple:
to emulate the mindset of experienced security researchers and 
hackers through LLM agents, 
enhanced with advanced program analysis techniques.

As decade-long veterans of CTF competitions, 
we inherently want to bring AI and LLMs to CTF competitions.
This time, we directly run our system along with human players, focusing on
analyzing the source code repos and patching discovered vulnerabilities.


{{< image src="images/blog/tkctf2024/dashboard.png" caption="" alt="alter-text" height="" width="600" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}

Overall,
we run the CRS on 12 different CTF challenges,
each with ~4 hours.
Finally, it identified 10 vulnerabilities and generated 7 sound patches.


## Interesting Challenges Solved by Atlantis

As an 

### Maze Puzzles

### Discovering unintended vulnerabilities

Apart from the intended vulnerabilities,
Atlantis also discovered two unintended vulnerabilities.

### Undiscovered vulnerabilities due to logic flaws


<details>
  <summary>Click me to show the maze puzzle </summary>

```shell
./target 
                                               
                                               
                                               
   #########################################   
   #P*       *       * *       *         * #   
   # *** ***** * *** * *** *** * ******* * #   
   #   *       *   * * * * *     *     *   #   
   #** ***** ***** * * * * *********** *** #   
   #   *   * *     * * * *   * *         * #   
   # *** * *** ***** *** *** * * * ******* #   
   # *   *   * *   *   *   * *   *         #   
   # *** *** * * * *** *** * * ************#   
   #     * * *   *   * * * * *         *   #   
   #****** * ******* *** *** ********* * * #   
   #       *   *     * *   * *       * * * #   
   # * ******* * ***** *** * * ******* *** #   
   # *           *     *     *            G#   
   #########################################   
                                               
                                               
                                               
Steps: 0
=========


# another run

./target
                                               
                                               
                                               
   #########################################   
   #P  *   *     *   * *       *         * #   
   #** * * * *** * *** ***** * * ***** * * #   
   #   * * * *   * *   *   * * * * *   *   #   
   # *** * * * *** * *** * * * * * * ***** #   
   #     * * *     * * * *   * * * *   *   #   
   #****** * ******* * * ******* * *** * **#   
   #     * * *         * *     *   * * *   #   
   # * *** * * ********* * *** *** * * *** #   
   # *     *       *   * * * *       * *   #   
   # ******* ***** * * * * * ******* * *** #   
   # *     * *   * * * *     *     * *   * #   
   # * *** *** * *** * ******* *** ***** * #   
   #   *       *     * *       *         *G#   
   #########################################   
                                               
                                               
                                               
Steps: 0
=========

```
</details>


## Case Studies: How Atlantis Patches Vulnerabilities

One of the key features of Atlantis is its ability to generate patches for vulnerabilities.



<details>
  <summary> Unsafe functions replaced by safer ones </summary>

```diff
diff --git a/bitcoin.c b/bitcoin.c
index 514e099..d96a44a 100755
--- a/bitcoin.c
+++ b/bitcoin.c
@@ -46,7 +46,7 @@ void UnderConstruction() {
 void vuln(){
    char buf[INPSIZE];
    printf("this file is under construction\n");
-   gets(buf);
+   fgets(buf, INPSIZE, stdin);
    printf("%s\n",buf);
    return;
 }
```

```diff
diff --git a/double_trouble.c b/double_trouble.c
index 83a693b..e8f0737 100644
--- a/double_trouble.c
+++ b/double_trouble.c
@@ -5,8 +5,9 @@
 
 void foo(char *msg) {
     char buf[80];
-    strcpy(buf, msg); // Vulnerable: No bounds checking
-    strcpy(msg, buf); // Vulnerable: No bounds checking
+    strncpy(buf, msg, sizeof(buf) - 1); // Use strncpy for bounds checking
+    buf[sizeof(buf) - 1] = '\0'; // Ensure null termination
+    strncpy(msg, buf, strlen(msg)); // Use strncpy for bounds checking
 }
```
</details>


<details>
  <summary> Add suffcient bounds checking </summary>

```diff
diff --git a/target.c b/target.c
index f512754..7f7bfef 100644
--- a/target.c
+++ b/target.c
@@ -23,9 +23,16 @@ func run_at_end = dont_print_key;
 uint32_t read_int(void) {
     char buf[10];
     ssize_t size = read(0, buf, sizeof(buf) - 1);
+    if (size <= 0) {
+        if (size == 0) {
+            printf("Error: End of input stream\n");
+        } else {
+            perror("Error: Read failed");
+        }
+        return 0; // or handle error as needed
+    }
     buf[size] = '\0';
     uint32_t res = atoi(buf);
-    return res;
 }
```

```diff
diff --git a/ymca.c b/ymca.c
index 5bf7de7..ca10ea1 100644
--- a/ymca.c
+++ b/ymca.c
@@ -87,7 +87,10 @@ bool is_in_array(int step, int arr[], int size) {
 void vulnerable() {
     char buffer[64];
     printf("Enter your Steps of the YMCA Song:\n");
-    read(STDIN_FILENO, buffer, 1000); 
+    ssize_t bytes_read = read(STDIN_FILENO, buffer, sizeof(buffer) - 1);
+    if (bytes_read > 0) {
+        buffer[bytes_read] = '\0'; // Null-terminate the buffer
+    }
}
```

```diff
diff --git a/rop.c b/rop.c
index 5df7c9c..c858436 100644
--- a/rop.c
+++ b/rop.c
@@ -83,7 +83,7 @@ int main(int argc, char** argv) {
     fgets(buf, sizeof(buf), stdin);
     // make newline null terminator
     int input_len = strlen(buf);
-    if (buf[input_len - 1] == '\n') {
+    if (input_len > 0 && buf[input_len - 1] == '\n') {
         buf[input_len - 1] = '\0';
     }
```

</details>


<details>
  <summary> Safe rewrite of the entire function </summary>

```diff
diff --git a/target.c b/target.c
index c364280..712ac08 100755
--- a/target.c
+++ b/target.c
@@ -14,25 +14,27 @@ int null_pos = -1;
 int newline_pos = -1;
 
 void copy_buffer(unsigned char* buf) {
-	null_pos = -1;
-	newline_pos = -1;
-	int i = 0;
-	while (i < BUF_SIZE) {
-		if (newline_pos < 0 && gbuf[i] == 0xa) {
-			newline_pos = i;
-		}
-		if (null_pos < 0 && gbuf[i] == 0x0) {
-			null_pos = i;
-		}
-		gbuf[i] = (gbuf[i] ^ key[i]) & 0xff;
-		i++;
-	}
-	int j = 0;
-	while (j < min(null_pos, newline_pos)) {
-		buf[j] = gbuf[j];
-		j++;
-	}
-	printf("Copied %d of %d bytes!\n", min(null_pos, newline_pos), strlen(gbuf));
+    null_pos = BUF_SIZE;
+    newline_pos = BUF_SIZE;
+    int i = 0;
+    while (i < BUF_SIZE) {
+        if (newline_pos == BUF_SIZE && gbuf[i] == 0xa) {
+            newline_pos = i;
+        }
+        if (null_pos == BUF_SIZE && gbuf[i] == 0x0) {
+            null_pos = i;
+        }
+        gbuf[i] = (gbuf[i] ^ key[i]) & 0xff;
+        i++;
+    }
+    int j = 0;
+    int copy_len = min(null_pos, newline_pos);
+    copy_len = min(copy_len, 20); // Ensure we don't exceed buf size
+    while (j < copy_len) {
+        buf[j] = gbuf[j];
+        j++;
+    }
+    printf("Copied %d of %d bytes!\n", copy_len, BUF_SIZE);
 }
```
</details>


<details>
  <summary> Add error handling </summary>

```diff
diff --git a/stackmachine.c b/stackmachine.c
index 7b95b62..d00d75f 100644
--- a/stackmachine.c
+++ b/stackmachine.c
@@ -88,11 +88,11 @@ void push(int *values, int *idx, int elt) {
 int pop(const int *values, int *idx) {
     if (*idx <= START) {
         myerrno = -1;
-        return 0;
+        return INT_MIN; // Return a special error code
     }
     (*idx)--;
-    int ret = values[*idx];
-    return ret;
+    return values[*idx];
+}
 }
 
 void main_loop();
@@ -144,9 +144,13 @@ void print_utf8(wchar_t *wcs) {
  */
 void ret(int *values, int *idx) {
     r1 = pop(values, idx);
-    if (myerrno != 0) { return; }
+    if (myerrno != 0 || r1 == INT_MIN) { 
+        puts("Error: Attempted to pop from an empty stack.");
+        return; 
+    }
     printf("%d\n", r1);
 }
+}
```
</details>

Honestly, the patches are far from demonstrating the potential of Atlantis,
as the challenges are not sophisticated enough. 
(check our [SQLite3 zero day](/blog/post-asc-sqlite) for more sophisticated ones)
Since then, our system has gone through multiple rounds of improvements,
and we will open-source all the details of our system after AIxCC competition.

### Unsound patches

Atlantis failed to patch three of the challenges.
Two of them are due to the puzzle-like nature of the challenges.
For example, 
the `maze` challenge only requires finding the path through the maze, 
a patch that fixes the vulnerability changes the intended behavior.

Also, the `shellcode-golf` challenge requires finding 
a special shellcode to pass the check.
A patch that fixes the vulnerability changes the check logic,
thus changes the intended behavior.

Another one is due to the complexity of inter-procedural logics.

<details>
  <summary> Click me to show the pseudo code </summary>

```c
uint32_t foo(void) {
    char buf[10];
    ssize_t size = read(0, buf, sizeof(buf) - 1);
    buf[size] = '\0';
    uint32_t res = atoi(buf);
    return res;
}

void main_loop() {
    while (1) 
        foo();
}
```
</details>

When read fails due to the empty input, 
size becomes -1 and stack-underflow occurs. 
Our patch system fixes this root cause and prevent from asan crash, 
but it loops infinitely due to lack of handling empty input in main loop. 
In this way, we consider this patch is unsound.



## Team Atlanta's Next Steps
Frankly,
Atlantis still has a long way to go to be a seamless autonomous CTF competitor,
which is also one of our team's goals.

Specifically,
we are working on the following improvements for creating a seamless autonomous CTF pwner agent:
- Binary analysis for better vulnerability understanding:
Currently, Atlantis can only support source code repos,
which limits its capability in CTF competitions.
- Automatic Exploit Generation; 
At the moment, Atlantis can only generate Proof-of-Concept (PoC) code to trigger vulnerabilities,
which is far from a real exploit.
- Customized LLM models:
We're working on customizing LLM models for better security analysis purpose,
which can, ideally, reduce the requirements of sophisticated prompts and
reduce the complexity of our system, and thus make it faster and more accessible.



## The Author's Conclusion


Follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
if you're interested in AI or security.
