---
layout: post
title: "Miscellaneous"
---

You've reached the end of this website!
Congratulations!

However, the journey does not end here.
There are many concepts in filesystems that we didn't cover here.
Hopefully in the future, we'll have more content and visualizations on filesystem, but for now, here are some topics you should keep an eye out for.

+ Pipes/Named Pipes
   * Pipes are objects that can be used to pass around data between processes using the file interface.

+ RAID/error correction
    * See the [coursebook](https://github.com/illinois-cs241/coursebook/wiki/Filesystems#raid---redundant-array-of-inexpensive-disks)

+ Multithreading in filesystems
   * You might have noticed, but all our filesystems are single threaded.
    What should happen if two programs try to write or read from the same file at
     once?
     How can we define ways for programs to gain exclusive access to a file?
     To learn more, look up concepts such as file locking and multithreaded filesystems.

+ Distributed/networked filesystems
    * We briefly discussed having multiple users on one filesystem, but what if
      our users are on different machines?
      What if we need to share data amongst a cluster of machines?
    * Protocols like NFS and SAMBA allow for accessing a filesystem over the network.


+ Mount Namspaces/Containers
    * How do services like `Docker` manage their filesystems?
    How can we create containers that can share parts of the filesystem but not others?

+ Defining `MMAP`
    * How does `mmap` interact with the filesystem?
    How can we take advantage of the `MMU`?

+ NTFS
    * The design of NTFS is very different from the ext/minix family of filesystems.

+ Defragmentation
    * How are defragmentation operations carried out?
