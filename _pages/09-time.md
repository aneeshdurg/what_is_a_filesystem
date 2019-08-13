---
layout: post
title:  "Tracking time in files"
---

You might have wondered how programs like `make` work by checking the time a file was last modified.
In most filesystems, there's usually some kind of mechanism for determining when a file was last accessed, last modified, and last changed (more on this last one later).
Some filesystems even have the ability to tell you when a file was created.

So where should this time data be stored?
You guessed it, in the inode - where all the other metadata is stored.
Time is usually stored as an integer describing the number of milliseconds since epoch time in three varaibles:

+ `atim` - time of last access
+ `mtim` - time of last modification
+ `ctim` - time of last meta data change

While the first two are relatively straight forward, `ctim` is often a bit elusive.

Essentially, `ctim` tracks when the file's metadata was changed, as opposed to the contents of the file.
Operations like `chmod` and `chown` would update `ctim` but not `mtim`.
`write` would update `mtim` but not `ctim`.

In the shell below, use `stat` to view the time stamps.
Try the following experiment:
+ Create a new file and check it's timestamps with `stat`
+ Call `chmod` on the file with some set of permissions including write permissions and check the timestamps afterwards.
+ Using `edit` or `cat` modify the file contents and then check the timestamps again.

<div id='shell'></div>
<script type="module">
import {LayeredFilesystem} from "{{ '/js/lfs.js' | relative_url }}"
import {Shell} from "{{ '/js/shell.js' | relative_url }}"
var shell = new Shell(new LayeredFilesystem(), document.getElementById("shell"));;
shell.main("{{ site.baseurl }}");
</script>
