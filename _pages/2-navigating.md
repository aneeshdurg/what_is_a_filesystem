---
layout: post
title:  "Navigating the File Tree"
---
<script>
window.onload = async function() {
    var fs = new MyFS();

    var shell_containers = document.querySelectorAll('[id^="shell_"]');
    var prev_shell_init = null;
    for (shell_el of shell_containers) {
        await prev_shell_init;
        var shell = new Shell(new LayeredFilesystem(fs), shell_el);
        shell.main();
        prev_shell_init = shell.initialized;
    }
};
</script>

In this section we will explore the basic shell commands that enable us to navigate a filesystem and examine some of the commands that we can use to interact with files.
If you're already familiar with most standard `sh`/`bash` built-ins and standard GNU/linux utilities, feel free to skip this section.

You've probably interacted with a filesystem before through GUI software such as `nautilus`, `explorer` and `windows explorer`.
We can perform the same actions that we do through such GUI software through command line utilities.
In our in-browser shell we support a number of commands that are either the same as, or at least very similar to, standard GNU/linux utilities.

For your convinience, all the shells you see below are connected to the same disk.
Changes you make to the filesystem on one shell will be visible to all shells in this page.

## Reading directories
For starters the command `ls` can list directory contents. Try it out below.

<div id="shell_1"></div>
<br>

To see a full list of options and other features provided by `ls`, run `ls -h` or `ls --help`.

For now, note the entries that you see when calling `ls`. We'll revisit what they are and what they mean later.

## Creating files/directories

To create directories we can use `mkdir`.
To create files we can use `touch` (there's also a few other ways which we'll discuss later).
Try running `mkdir newdir` to create a directory named `newdir`.
Try running `touch newfile` to create a file named `newfile`.

<div id="shell_2"></div>
<br>

To verify that the files you expected exist, try running `ls` again.

## Entering a directory

To enter a directory use the `cd` command.
Try running `cd newdir` to navigate inside the directory you just created.
To go back out to the directory you were initially in use `cd ..` which allows you to move up the file tree by a level.

<div id="shell_3"></div>
<br>

## Gather information about a file

To get information about the details of a file, we can use either the `file` or the `stat` command.
Try running `stat newfile` and `stat newdir`.

<div id="shell_4"></div>
<br>

Note that `stat` will tell us if a file is a regular file or a directory!

## Input content into a file

To input content, we can use a trick called [output redirection](https://www.tldp.org/LDP/abs/html/io-redirection.html).
In our shell, you can either use the syntax `command > file` to save the output of `command` in `file` or `command >> file` to append the output of `command` to `file`.

To test this out, we can use the command `cat`.
Normally `cat` will output the contents of all files passed in as arguments, but if we call it with no arguments it will read from stdin.

Let's input some content into the file we created earlier.
To do this run `cat > newfile`.
Since `cat` will read from stdin forever, close stdin with `ctrl + d` when you are done.
Note that lines are only actually sent to stdin when you press `Enter`.

Also try appending some data with `cat >> newfile`.
Once you finish, run `cat newfile` to print the contents of `newfile`.

<div id="shell_5"></div>
<br>

Note that if we run `stat` now we'll see that the filesize has increased.

# Deleting files and directories

To delete files and directories we'll use the command `rm`.

Try deleting `newfile` and `newdir`.
Run `ls` afterwards to confirm that the files have been deleted.

<div id="shell_6"></div>
<br>

`rm newdir` didn't work did it?
That's because `rm` prevents you from deleting directories unless you pass the `-r` (recursive) flag to prevent you from accidentally deleting entire projects when you only meant to delete a specific file. Try again with `rm -r newdir`.
