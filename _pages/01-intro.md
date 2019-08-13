---
layout: post
title:  "Introduction"
---

<script type="module" src="{{ '/js/pages/01-intro.js' | relative_url }}"></script>

Welcome to `what is a filesystem`!
The purpose of this interactive book is to help you learn and understand filesystems concepts.
We will be following the content in UIUC's CS241's [coursebook](https://github.com/illinois-cs241/coursebook/wiki).
Like the coursebook, we will constrain our discussion and definitions to be relevant primarily to linux, and to POSIX compliant operating systems unless otherwise specified.

To kick things off let's take a look at the shell.
Hopefully you've used some kind of shell before (`bash`, `zsh`, etc).
For our purposes, we've implemented an in-browser shell for you to use.
You can try it out below:

<div id="shell_parent"></div>
<br>

Try clicking on the shell and typing `echo hello world!` to run your first command!

Through the course of this book, you will be able to interact with filesystems by running various programs inside this shell.
Note that any changes you make to the filesystem will be gone when you reload the page, or naviagte to the next page.
We try to match the syntax of commands that you might already be used to
(e.g. `echo`, `cat`, `ls`, `mkdir`, `touch`), but we are not 100% compatible with the command line options presented by the GNU coreutils.
You can use `>` and `>>` to redirect output to and append output to a file.
For programs that take input like `cat`, `ctrl+d` will close stdin.
You can also use the up and down arrow keys to repeat commands you've run before.
Don't worry if all of this sounds unfamiliar to you!
We will explain more about how these commands work as we go along.

You can see a full list of our commands and their usages by typing `help` into the command line.

Below you can see our visulization for how a filesystem interacts with a disk.
It may look daunting now, but it will be demystified in further chapters as we learn more about filesystems and disks.
Try running some commands in the shell below and see how/if they interact with the disk!

<div id="shell_fs_parent"></div>
<br>
<canvas id="fs_vis"></canvas>

You can change the speed of the animations here:

<div id="speed_selector_container" style="display:none;">
<select id="speed_selector">
<option value="">default</option>
</select>
<button onclick='change_speed()'>Change Speed!</button>
</div>

Changing the speed here will change the speed of all animations on this website.

When you're done playing with the shell above, click `Next Chapter` or press the right arrow key to advance to the next page!
