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
<div id='cache_container' style="display:none;">
<p id='cache_contents'></p>
<br>
<button onclick="increase_cache()">Increase cache size</button>
<button onclick="decrease_cache()">Decrease cache size</button>
</div>
<br>
<button onclick='setup()'>Reset</button>
<button id='cache_btn' onclick='enable_cache()'>Enable Cache</button>
<button onclick='defragment()'>Defragment</button>
<script src="{{ '/js/pages/disk_latency.js' | relative_url }}"></script>

For example, try measuiring the difference between the time taken to read
`goodfile` (`cat goodfile`) versus reading `badfile` (`cat badfile`).

See how we have to keep re-reaading the indirect block
(if you missed this, use `inodeinfo` to point out the indirect blocks of each file)?
What if we could somehow remember the contents of that block?
We could make use of a cache. Click `Enable cache` to turn on a basic `LRU` cache.

Try playing around with the cache size to see how different cache sizes affect performance.
In real life this cache would be taking up valuable memory space and wouldn't always be availible.

You might have noticed that in this demo the disk pointer is never moving to the inode table.
That's because we're assuming that all inodes are cached in memory.
In reality this may not always be the case, but it's a relatively harmless assumption for our purposes.

What if we didn't have a cache?
Another solution could be to defragment the disk.
<!-- (TODO make a way to turn of animations temporarily)-->
The last potential solution would be to change the storage medium to something
that has good random access performace, like SSDs.
<!--(TODO provide programs to run the myfs ioctls)-->
