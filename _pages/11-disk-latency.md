---
layout: post
title: "Disk Latency"
---

## Disk Latency

Up till now we've assumed that we can jump around the disk for free.
In the real world this assumption doesn't hold up for all storage mediums.
For many technologies, such as HDDs that rely on spinning disks, there is a cost to non-sequential access.
While some operating systems have certain techniques to optimize the order in which IO operations are performed to optimize disk access,
our simulations on this website model an operating system that only allows one thread, so we won't cover those techniques here.

In such scenarios, disk fragmentation becomes a rather crippling issue.
Try running some commands like `ls` and `cat` on the filesystem below.
Press `reset` to reset the state of the filesystem.

<div id='latency_container'>
</div>
<br>
<button onclick='setup()'>Reset</button>
<button onclick='enable_cache()'>Enable Cache</button>
<script src="{{ '/js/pages/disk_latency.js' | relative_url }}"></script>

For example, try measuiring the difference between the time taken to read
`goodfile` (`cat goodfile`) versus reading `badfile` (`cat badfile`).

See how we have to keep re-reaading the indirect block
(if you missed this, use `inodeinfo` to point out the indirect blocks of each file)?
What if we could somehow remember the contents of that block?
We could make use of a cache. Click `Enable cache` to turn on a basic `LRU` cache.

Another solution could be to defragment the disk.
<!-- (TODO make a way to turn of animations temporarily)-->
The last potential solution would be to change the storage medium to something
that has good random access performace, like SSDs.
<!--(TODO provide programs to run the myfs ioctls)-->
