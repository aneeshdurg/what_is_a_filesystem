---
layout: post
title:  "Permissions and Types"
---
In the previous section we talked about how `stat` is used to read a file's metadata.
Here, we'll be taking a closer look at the mode field on the inode and what data it actually stores.

We can check the POSIX man pages for a description of what file type and mode are by running `man inode` or going to this link: [man 7 inode](http://man7.org/linux/man-pages/man7/inode.7.html)

Below is an excerpt from the page.

```
The file type and mode
    The stat.st_mode field (for statx(2), the statx.stx_mode field) contains the file type and mode.

    POSIX  refers to the stat.st_mode bits corresponding to the mask S_IFMT (see below) as the file type, the 12 bits corresponding to the mask 07777 as the file mode bits and the least significant 9
    bits (0777) as the file permission bits.
```

There's three main things we need to consider: `type`, `mode`, and `permissions`.

## Type

The file type stores information about what kind of data the file contains.
Is it a directory? A symbolic link?
There's also more exotic options like pipes (`FIFO`), block/character devices, and UNIX sockets.
Since our toy file system only supports file and directories, those are the only two options for file type in the simulator.

What would the file type of a hard link be? (Check `man inode` for some hints!)

<form onsubmit="check_answer(document.getElementById('c').checked, true); return false;">
    <input type="radio" name="question1" id="a">a) Symbolic Link (<i>S_IFLNK</i>)<br>
    <input type="radio" name="question1" id="b">b) Hard links don't have a file type.<br>
    <input type="radio" name="question1" id="c">c) Whatever the type on the inode corresponding to the link is.<br>
    <input type="radio" name="question1" id="d">d) Block device (<i>S_IFBLK</i>)<br>
    <input type="submit" value="Check Answer">
</form>
<details><summary>Hint/answer</summary>
<div markdown="1">
The answer is `c`.

Hard links are just entries in a directory that point to a particular inode, in essence it's what we normally think of as a "file".
Thus, the file type of the hard link is a trick question that's just asking what's the file type of some entry in a directory.
</div>
</details>
<br>

## Mode

Aside from the type of a file, there's also the `mode` bits and `permission` bits.
There's three possible values for the mode bits (from `man inode`):
+ `S_ISUID     04000   set-user-ID bit`
+ `S_ISGID     02000   set-group-ID bit`
+ `S_ISVTX     01000   sticky bit`

An executable file with the `set-user-ID` bit set will change the `effective UID` of the user executing that file for the duration of the executed process.
This is how `sudo` let's you run programs as root.

The `set-group-ID` bit allows for special semantics with directories, and isn't used very commonly.
See `man inode` for details on how to use it.

The `sticky` bit prevents deletion or renaming of a file by anyone except for the file's owner and root.

In discussing these bits, we've come across a couple new concepts, namely the user ID, or `uid`, and the group ID or `gid`.
The `uid` is just a way to represent a user by a unique number, and a `gid` is a number describing a set of permissions that can be given to various users.
Users that are part of a particular group enjoy access to files created/owned by other members of the group who've set group specific permissions.

To better understand users and groups, we'll first understand how permissions work.

## Permissions

Permissions are generally defined by a triplet of octal numbers.
We'll represent octal numbers by prefixing them with `0o` to distinguish them from regular integers.

So what is an octal?
Just like how binary is a representation of numbers in base `2`, octal refers to having a base of `8`.
This implies that the number `0o10` is equivalent to `8` in decmial.

A file permission might look something like `0o644`.

What's `0o644` in decimal?
<form onsubmit="check_answer(document.getElementById('decimal').value, '420'); return false;">
  <input id="decimal"/>
</form>
<details><summary>Hint/answer</summary>
<div markdown="1">
`0o644 = 64*6 + 8*4 + 1*4 = 420`
</div>
</details>
<br>

Each octal can be represented with three bits, for example, `0o644` can be written in binary as `0b110100100`.
This corresponds to how there's three possible permissions that can be granted to a file:
+ read
+ write
+ execute

The most significant bit of each octal digit corresponds to `read` permissions (0o4),
the second bit corresponds to `write` permissions (0o2),
and the least significant bit corresponds to `execute` permissions (0o1).
By enabling or disabling these bits we can create files that restrict their usage.
For example, you may want to make a file with read-only access by only setting the read bit.
Or you  might want to ensure that files downloaded from the internet are not executable by default - forcing the user to manually enable execution if they trust the file.

You might be wondering, why do we need three octal digits to control permissions?
That's where users and groups come into play.
The first octal digit only describes what restrictions apply to the user who owns the file.
The second octal digit describes what restrictions apply to members of the group associated with the `gid` of the file.
The third octal digit describes what restrictions apply to users who are neither the owner, not part of the specified group.
We'll refer to this third set of users as `other`.
You may encounter the acronym `ugo` to describe these three digits as `user`, `group` and `other`.

For example, if I am running a pay-to-use server that allows many users to `ssh` in and access files, I might keep a list of credit card numbers of people using the service.
(This is a very bad idea, and in real life this data should not be on the same server that everyone has access to, and it should be encrypted.)
Suppose I have a list of trusted admins and I want to ensure that these only admins can read the file, and that only I can read __AND__ write to file.
One approach to accomplish this could be to create a group of admins and set the gid of the file to the gid of the group.
What is the most restrictive set of permissions I should set on the file if the uid of the file is my own and the gid is the admin group? (prefix your answer with `0o` or `0b` to answer in octal or binary instead of decmial)

<form onsubmit="check_answer(Number(document.getElementById('perm').value), 416); return false;">
  <input id="perm"/>
</form>
<details><summary>Hint/answer</summary>
<div markdown="1">
As the owner, I need to read and write to file, but I don't need to execute the file.
So the most restrictive set of permissions I should apply to the owner is `0o6`.
Note that `0o7` which enables execute also achieves read and write access, but it's not the most restrictive option.

Now for the group we want only read permissions, described by `0o4`.

And finally for other, we want no permissions, described by `0o0`.

Putting these digits together we get `0o640 = 0b110100000 = 416`.
</div>
</details>
<br>

## Changing permissions/mode

Once a file has been created, it is possible to change it's permissions and mode by the user of a utility called `chmod` (named after - you guessed it - a filesystem operation of the same name).
Our simiulator currently doesn't support all the options of the real `chmod` and doesn't support changing the mode at all.
There's also only one user on the simulator, so the group and other options are vestigial.

Try it out and use `stat` and `cat` to check/verify that permissions have been set:

<div id='shell'></div>
<script>
var shell = new Shell(new LayeredFilesystem(), document.getElementById("shell"));
shell.main("{{ site.baseurl }}");
</script>

## Executing file in the simulator

Our simulator does support marking file as executable.
An executable file is assumed to contain javascript code evaluating to a function.

TODO: insert tutorial here.
