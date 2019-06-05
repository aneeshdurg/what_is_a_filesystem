---
layout: post
title:  "Links and Paths and Directories, oh my!"
---

You might be thinking, inodes are great and all, but how does that turn into the files and directories we're used to seeing?
Is a filename just another property of the inode?

In some filesystems such as FAT, this is the case.
However, more sophisticated filesystems like the `ext` family of filesystems, `zfs`, and even the venerable `minix` don't store filenames in inodes.
This is because these filesystems all support a concept known as hardlinks.
To fully understand how hardlinks work, we must first understand how directories work.

## Directories

In all the filesystems we've talked about so far, directories are nothing more than a special type of file.
Like other files, they also have an inode that describes what direct and indirect blocks are associated with it.
However, the data stored in a directory is a kind of struct referred to as a `dirent` (short for `directory entry`).
A `dirent` must store two things, a filename and an inode number (an index into the inode table).

Try making a bunch of files and directories in the shell below and then run `ls -i` to list all files and their corresponding inode numbers.
To view information about a particular file's inode, run `inodeinfo filename` (note that in real life `inodeinfo` is not a standard utility - it's something we made to interact with the visualizations).

<div id="shell_1"></div>
<canvas id="fs_1"></canvas>
<script>
var canvas = create_canvas('fs_1');
var fs = new MyFS(canvas);
var shell = new Shell(new LayeredFilesystem(fs), document.getElementById("shell_1"));
shell.main("{{ site.baseurl }}");
</script>

Every time you run `ls`, you'll notice that all blocks of the root directory inode are read and dirents are extracted.
Similarly when you run `touch` or `mkdir` a block will be appended (in this filesystem dirents are 16B, with 1B providing an inode number and 15B for the filename).
Try running `rm`. `rm` will call the filesystem operation `unlink` underneath.
Our implementation of `unlink` is extremely inefficient as it prevents _holes_ (gaps of unused data) from forming in the directory inode in a naive way.
Try deleting files and directories above and guess what our implementation does based off of the blocks being read.
Can you think of a more efficient way we could have implemented `unlink`?

You might have noticed, but programs like `rm` and `ls` seem to know whether a given filename is a regular file or a directory.
Such programs are able to check if a file is a regular file containing data or a directory containing dirents by using the `stat` function.
You can try the command line utility `stat` in the file above to see what kind of data you get from `stat`.
Traditionally, `mode` of an inode indicates whether a file is a file or a directory and all `stat` has to do is read all fields of an inode.

So how does the data stored on our directory actually look?
Let's try doing `cat /` or `hexdump /` to view the contents of the root directory.

<div id="shell_2"></div>
<button onclick="run_cat()">Run cat</button>
<button onclick="run_hexdump()">Run hexdump</button>
<script>
var shell_2 = new Shell(new LayeredFilesystem(fs), document.getElementById("shell_2"));
shell_2.remove_container_event_listeners();
shell_2.prompt = function () { return "\n\n"; };
(async function() {
    await shell.initialized;
    shell_2.main("{{ site.baseurl }}");
})();
function run_input(input) {
    for (i of input) {
        for (c of i)
            shell_2.process_input(c, false);
    }
}
function run_cat() {
    run_input([
        Array.from("cat /"),
        ["Enter"],
    ]);
}
function run_hexdump() {
    run_input([
        Array.from("hexdump /"),
        ["Enter"],
    ]);
}
</script>

Note that when we run `cat` we don't see the inode numbers because the browser isn't rendering unprintable ascii characters.
However, `hexdump` is printing out hex bytes, so we can see the inode numbers just fine as every 16th byte, starting at the 0th byte.
Try comparing it to `ls -i`.

Also note that the entries `.` and `..` don't show up when you run `cat` or `hexdump`.
We'll detail the reasons for that in the section about paths below.

## Links

Now that we understand what directories are, let's come back to the topic of hardlinks.
A hardlink is what causes an inode to present itself as what most people normally think of as a _file_ or _directory_
(although you now know that files/directories and inodes are all the same thing - just inodes).
Simply put, a hardlink to a particular inode is a dirent in some directory that refers to that particular inode.

Now that we've abstracted the actual existenece of a file away into these structures called inodes that live in some indexed table, we can have multiple dirents that all refer to the same inode!
Try it out for yourself:

+ Create a file with `echo hi > myfile` (run `cat myfile` to verify that it has the contents "hi"). Next, we want to create a new file that has the same inode number.
+ We'll do that with the command `link` which is named after the corresponding filesystem operation. Run the command `link myfile linkedfile`.
(note that in real life, the program that does this is called `ln`. Our implementation of `link` is much simpler than all the features provided by `ln` so we gave it a different name to avoid confusion)
+ To verify that we correctly made a link, run `cat linkedfile`, and `ls -i` to check the contents and the inode number.
+ Just for fun, also run `cat >> myfile` and append some content to `myfile`. Then run `cat linkedfile` and see the appended text appear.

<div id="shell_3"></div>
<canvas id="fs_3"></canvas>
<script>
var canvas_3 = create_canvas('fs_3');
var shell_3 = new Shell(new LayeredFilesystem(null, canvas_3), document.getElementById("shell_3"));
shell_3.main("{{ site.baseurl }}");
</script>

Earlier we noted that inodes don't store their own names, and this is the reason why.
An inode could have multiple links!
We can't say which link should be the real filename, and it's not worth storing a variable length list in the inode just to account for this feature.

### Deleting files

Now that we have hardlinks, this brings up an interesting conundrum.
What should happend when we delete a file with more than 1 link?
Should all links be removed from the filesystem?
If you think about it, that could be a potentially expensive operation that requires reading the entire disk.
We could remove a dirent and leave the inode alone, which would allow other link s to continue accessing the data.
However, this leads to a unique problem of it's own, namely, how do we know when to delete the inode and free up disk space when all links are deleted?

To solve this problem, inodes store a counter tracking the number of links that reference each inode.
When a file is deleted (or `unlink`ed as the filesystem calls it), this counter in the inode is decremented.
If the counter ever reaches 0, the inode releases all blocks it was holding 
(note that it doesn't clear them! deleted data is still recoverable if you know what block numbers to read - this is how data recovery software can recover deleted files soon after they've been deleted)
and marks itself as free to store information about a new file in the future.

Try it out above and delete `myfile` with `rm myfile`.
Notice that the corresponding inodes and disk block(s) aren't marked as free until you delete `linkedfile` as well.

### Softlinks

A limitation of hardlinks is that they can only point to inodes which are on the same filesystem as the link, and every link must correspond to a valid inode.

We may want to overcome this limitation, and have a file that links to file on other disks/filesystems that might not always be accessible.
One potential solution is the use of softlinks, or symbolic links. We won't go into any detail regarding softlinks here, but the [coursebook](https://github.com/illinois-cs241/coursebook/wiki/Filesystems#linking) has a good description and even better examples. Our toy filesystem/file IO library doesn't support symbolic links.

Try writing your own filesystem that does support some kind of softlinks! You can write/test it at this link: TODO make this feature

## Paths

Now that we have directories and links, we want to be able to describe files in a way that's easy to comprehend and organize.
That's where the concept of paths come in.
A path is a string that describes a series of directories that need to be traveresed to find a dirent (link) which points us to the inode we want to access.
You've probably already encountered paths before, and now that you know what directories really are, it should be straightforward to understand how this process works.

There are a few special paths/conventions that you should be aware of.
A key convention are the directories `.` and `..`.

`.` refers to the current directory, and `..` refers to the parent of the given path of the current directory
(note that we distinguish the directory (inode) from it's path, since if there are multiple hard links to a directory there is no unique parent directory).

By convention the parent of the root directory "/" is itself.
You might have noticed this fact while running `ls -i`.
Note that `.` and `..` are returned by calls to `readdir`, be careful while writing code that attempts to traverse a file tree or it might end up looping forever.

## Breaking the file tree?

A lot of people refer to and think of filesystems as a type of tree but is that really the case?
Hardlinks turn our neat filesystem tree into a scary graph full of links that break the tree-like hierarchy.
To help alleiviate this, most filesystems usually prevent hard links to directories.

Think about a program like `rm -r` which reads a directory and tries to recursively delete all files in the directory, descending into child directories if necessary.
If hard links to directories were allowed, one could create a hard link to a directory in the directory the link references!
(e.g. consider the sequence of commands `mkdir a`, `link a a/b`, `a` and `a/b` now point to the same directory/inode)
This would cause poor `rm` to infinitely loop as it is caught in a cycle in the graph.

Rather than have programs implement a cycle detection algorithm, most filesystems just decided that linking to directories is best left to softlinks.
