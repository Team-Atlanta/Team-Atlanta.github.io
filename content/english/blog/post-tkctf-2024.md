---
title: "Hacking Redefined: How LLM Agents Took on University Hacking Competition"
meta_title: ""
description: "Atlantis in CTF competitions"
date: 2024-12-01T12:15:00Z
image: "/images/blog/tkctf2024/ai-vs-human.png"
categories: ["Milestone"]
author: "Hanqing Zhao"
tags: ["Atlantis CRS"]
draft: false
---

For the first time, we deployed our hybrid system, 
powered by LLM agents—[Atlantis](/blog/post-atl)—to compete in Georgia Tech’s flagship CTF event, 
[TKCTF 2024](https://tc.gts3.org/cs6265/2024-fall/ctf.html). 
During the competition, Atlantis concentrated on two pivotal areas: 
vulnerability analysis and automatic vulnerability remediation. 
Remarkably, the system uncovered 10 vulnerabilities and produced 7 robust patches[^1], 
showcasing the practicality and promise of our approach in a real-world hacking competition.

In this blog, I’ll delve into some fascinating insights and essential lessons from the CTF experience. 
As we prepare to open-source the full details of our system following AIxCC competition rules, 
this milestone reflects more than just a technical achievement—it embodies our commitment to advancing LLM-driven security research.

What might appear as another incremental step in CTF competitions actually marks a significant leap in our journey. 
The success of Atlantis at TKCTF was a testament to the dedication and expertise of our exceptional team: 
[Andrew Chin](/authors/andrew-chin),
[Jiho Kim](/authors/jiho-kim/),
[Gyejin Lee](/authors/gyejin-lee/),
[Seunggi Min](/authors/seunggi-min/),
[Kevin Stevens](/authors/kevin-stevens/),
[Woosun Song](/authors/woosun-song/), and
[Hanqing Zhao](/authors/hanqing-zhao/),

We invite you to follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
to stay updated on our work at the intersection of AI and security.

[^1]: Fully sound patches address root causes while preserving correct system behavior.


## AIxCC, Atlantis CRS, and CTF

<div style="display: flex; justify-content: center; gap: 10px;">
  {{< image src="images/blog/tkctf2024/aixcc-finalists.png" caption="AIxCC Finalists" alt="AIxCC Finalists" height="" width="600" position="center" option="q100" class="img-fluid" title="AIxCC Finalists" webp="false" >}}
  {{< image src="images/blog/tkctf2024/poster.jpeg" alt="TKCTF Poster" height="" width="400" position="center" option="q100" class="img-fluid" title="TKCTF Poster" webp="false" >}}
</div>

[AI Cyber Challenge (AIxCC)](https://aicyberchallenge.com/) is 
a two-year competition designed to advance the state of the art in AI-based security research. 
We, Team Atlanta, are proud to be one of the 7 finalist teams, presenting a novel cyber reasoning system, 
[Atlantis CRS](/blog/post-atl).

The concept behind our system is straightforward: 
emulate the mindset of skilled security researchers and hackers using LLM agents, 
augmented by advanced program analysis techniques.

As seasoned veterans of CTF competitions, we’ve always aspired to bring AI and LLMs into the CTF arena.
This time, we deployed our system alongside human players, concentrating on analyzing source code repositories and patching identified vulnerabilities. 
Georgia Tech’s CTF competition, TKCTF, offered the perfect setting to put our system to the test.

The challenges were designed by students and staff from Georgia Tech’s CS6265 Fall 2024 class. 
In addition to Georgia Tech participants, teams from across the University System of Georgia (USG) joined the competition. 
The winning team received a $1,000 prize.




## Recap of Atlantis's Performance

{{< image src="images/blog/tkctf2024/dashboard.png" caption="Atlantis Dashboard" alt="Atlantis Dashboard" height="" width="600" position="center" option="q100" class="img-fluid" title="Atlantis Dashboard" webp="false" >}}

Over the course of the competition, we ran Atlantis CRS on 12 different CTF challenges, 
each with a time limit of approximately 4 hours. 
By the end, our system successfully identified 10 vulnerabilities and generated 7 robust patches.

While the overall difficulty of the challenges was moderate, 
Atlantis successfully identified most of the intended memory safety vulnerabilities 
and even uncovered two unintended vulnerabilities. 
The competition also provided several interesting cases and valuable lessons, 
which I’ll share below.

### Maze Puzzles

One of the challenges was a maze puzzle. 
It generated a random maze where the intended solution required 
players to write an algorithm to parse the map and find the path through the maze.

<details>
  <summary>Click to view an example of the maze puzzle</summary>

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

Interestingly, 
Atlantis correctly navigated the maze through several runs of trial and error. 
This demonstrated the ability of LLM agents to enhance program analysis 
by “understanding” the high-level intent of a program.

### Discovering Unintended Vulnerabilities

Beyond the intended vulnerabilities, Atlantis also discovered two unintended ones:
- Floating Point Exception (FPE): A vulnerability causing stack underflow.
- Insufficient Input Validation: An unchecked empty input led to a stack buffer overflow.

Although the challenges were not overly complex, this highlights Atlantis’s potential in automated testing and vulnerability discovery.

### Undiscovered Vulnerabilities Due to Logic Flaws

Atlantis struggled with challenges involving logical flaws. For example, in the two-sum challenge:
- Challenge Details: 
The task didn’t involve memory safety issues but 
required exploiting unordered_map hash collisions to manipulate the control flow in the twoSum function.
- Missed Opportunity: Since Atlantis was tuned to prioritize memory safety issues, 
it overlooked this logic-based vulnerability.

This underscored the need to enhance Atlantis’s capabilities in analyzing logical vulnerabilities, an area we plan to focus on in future improvements.

## Case Studies: How Atlantis Patches Vulnerabilities

A standout feature of Atlantis is its capability to generate patches for discovered vulnerabilities. 
In this CTF, Atlantis produced 7 fully sound patches, 
showcasing both the system’s confidence and its ease in handling the challenges, which were relatively straightforward.

In this section, I’ll provide a summary of key cases and the patching decisions made by Atlantis’s agent system.


<details>
  <summary> Unsafe functions replaced by safer ones </summary>

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


One of the principles guiding Atlantis is avoiding the use of unsafe functions. 
For instance, in one case, 
Atlantis replaced `strcpy` with `strncpy` and added a null termination check to ensure the safety of string operations. 
Given that the C language inherently includes many unsafe functions, 
Atlantis takes a conservative approach by systematically replacing these functions with their safer counterparts wherever possible.

<details>
  <summary> Bounds checking and termination handling </summary>

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

Out-of-bounds vulnerabilities are among the most common issues in software. 
Atlantis addresses this by employing dedicated optimizations to thoroughly check array and memory bounds, 
ensuring that user inputs are constrained within a safe range. 
This proactive approach minimizes the risk of unintended memory access and enhances overall software reliability.


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


Atlantis typically aims to keep patches minimal, 
modifying the fewest possible lines to reduce the risk of altering intended code behavior or introducing unsoundness. 
However, after several iterations, if Atlantis cannot produce an optimal minimal patch, 
it will optionally rewrite the entire function to comprehensively address the vulnerability. 
This approach balances precision with robustness, ensuring both safety and functionality. 


<details>
  <summary> Error handling correction </summary>

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


For bugs involving inter-procedural logic, 
Atlantis analyzes cross-procedural data flow and incorporates error handling into its patches. 
For instance, when addressing a vulnerability in `stackmachine.c`, 
Atlantis correctly handled the error case by introducing logic to return a special error code, ensuring robust and predictable behavior.

That said, the patches produced during this competition don’t fully showcase Atlantis’s potential, 
as the challenges lacked sophistication. 
For a more advanced example, check out our work on the [SQLite3 zero-day vulnerability](/blog/post-asc-sqlite). 
Since then, Atlantis has undergone multiple rounds of improvement, 
and we remain committed to open-sourcing the full details of our system after the AIxCC competition.


### Unsound Patches

Atlantis was unable to patch three of the challenges due to unsound patches. 
Two of these failures stemmed from the puzzle-like nature of the challenges:

- **Maze Challenge:** This challenge required finding the path through a maze. 
A patch that fixes the vulnerability inadvertently altered the intended behavior, conflicting with the challenge's goals.
- **Shellcode-Golf Challenge:** This challenge demanded crafting a specific shellcode to pass a verification check. 
A patch that addressed the vulnerability ended up modifying the check logic, effectively changing the intended behavior.

The third unsound patch occurred due to the complexity of inter-procedural logic, 
which presented challenges for Atlantis in accurately resolving the issue without disrupting the intended program flow.

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

When a `read` operation fails due to empty input, the `size` variable becomes `-1`, 
leading to a stack underflow and subsequent crash. 
While Atlantis’s patch system successfully addresses the root cause and prevents an ASAN crash, 
it inadvertently introduces an infinite loop due to the lack of handling for empty input within the main loop. 
As a result, this patch is deemed unsound because it fails to fully resolve the issue in a functional and robust manner.


## Team Atlanta's Next Steps

Frankly, Atlantis still has a long way to go before becoming a seamless autonomous CTF competitor for pwnable challenges, 
which remains one of our team’s long-term goals.

To move closer to this vision, we are focusing on the following improvements to create a fully autonomous CTF pwner agent:

- **Challenge Understanding:**  
  While we concentrate on pwnable challenges, 
  modern pwnables often come in diverse formats, such as kernel drivers and patched browsers. 
  Atlantis needs to identify the challenge format and generate appropriate analysis code to handle these variations, 
  aiming for more general-purpose functionality.

- **Binary Analysis Support:**  
  Currently, Atlantis supports only source code repositories. 
  Since many CTF challenges are distributed as binaries, 
  we plan to integrate our own decompilation framework to enable binary analysis. 
  This approach will offer a tailored experience, moving beyond existing tools like IDA Pro to provide more comprehensive support.

- **Automatic Exploit Generation:**  
  At present, Atlantis can only generate Proof-of-Concept (PoC) code to trigger vulnerabilities. 
  Our goal is to enable the generation of more powerful exploits, 
  such as arbitrary read/write primitives, expanding its utility and effectiveness in real-world scenarios.

- **Customized LLM Models:**  
  We are working on customizing LLM models specifically for security analysis. 
  Tailored models could reduce the need for sophisticated prompts, simplify our system architecture, 
  and improve both speed and accessibility, making Atlantis more efficient and user-friendly.

By addressing these challenges, we aim to push the boundaries of AI in cybersecurity and bring Atlantis closer to becoming a fully autonomous and versatile competitor.

## The Ending Note

As someone from a generation that grew up learning computer science through CTF competitions, 
I can confidently say that CTFs have been instrumental in teaching us about operating systems and security. 
Looking ahead, I sincerely hope that CTFs will once again serve as a platform to teach us how to develop new language models and agents for security research.

I hope our first step in TKCTF 2024 inspires more researchers to join this vibrant and innovative community. 
If you’re passionate about AI or security, I invite you to follow us on Twitter/X ([@TeamAtlanta24](https://x.com/TeamAtlanta24)) 
and join us on this exciting journey.

<div style="display: flex; justify-content: center; gap: 10px;">
  {{< image src="images/blog/tkctf2024/1000.JPG" caption="" alt="alter-text" height="" width="500" position="center" option="q100" class="img-fluid" title="image title"  webp="false" >}}
  {{< image src="images/blog/tkctf2024/thanks.JPG" alt="alter-text" height="" width="500" position="center" option="q100" class="img-fluid" title="image title" webp="false" >}}
</div>