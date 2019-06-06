---
layout: post
title:  "Inodes and File Metadata"
---

<blockquote><div markdown="1">
In this section we'll be interacting with the filesystem visualizer.
If you'd like to slow down or speed up the visualizations, please see the [first post]({{ '/pages/01-intro.html#speed_selector' | relative_url }}).
</div></blockquote>

We need to come up with a way to represent a file on disk.
At a minimum we need to know two things:

+ the block indicies occupied by the file
+ the size of the file

While the first attribute may be obvious, the second is equally important as it lets us know if we should only read a portion of a block.
To keep things simple and efficient, we'll enforce that a block must be completely full of the user's data before a file can request another block.
Note that some filesystems don't impose such constraints and instead implement a _sparse file_, although we won't discuss them here.

To satisfy our requirements, we define a struct that we call an `inode`.
The etymology of `inode` is somewhat murky, with a popular belief that the name is a contraction of `index` and `node` [(at least, that's what wikipedia says)](https://en.wikipedia.org/wiki/Inode).

For the sake of simplicity and efficient access, some filesystems have a fixed set of inodes, or inode-esque structures.
You can see examples such as the [ext4 Inode Table](https://ext4.wiki.kernel.org/index.php/Ext4_Disk_Layout#layout) or the [NTFS Master File Table](http://www.ntfs.com/ntfs_basics.htm).
(Since we want to stay in UNIX-land we'll continue to use terms such as
`inode`, `inode table` and `blocks` as opposed to the corresponding windows terminology `record`, `master file table`, and `extent`).
One downside of this approach is that a limited number of inodes places a limit on the total number of files you can ever have on that filesystem.
Luckily for us, this number is usually high enough that it's unlikely you'd ever actually reach the limit before running out of disk space (assuming you're actually using the files you create).

 When we say that we are "formatting" a disk for a particular filesystem, what we really mean is that we are creating the inode table and recording things such as the size of each block.
 In order to track filesystem/disk-wide metadata, we also create a special object which we'll refer to as a `superblock`.
 This is where we'd store the disk offset (like an address, but the word offset makes it clear that not all disks support efficient random access),
 of the inode table, the length of the inode table, a bit map indicated whether an inode with a given index is being used or not, and a similar bit map describing all the data blocks.

Let's take a look at an example.
 
<canvas id="canvas_1"></canvas>
<script>
var canvas_1 = create_canvas('canvas_1');
var fs_1 = new MyFS(canvas_1);
fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});
(async function() {
    await fs_1.create("/file", 0o777);
    await fs_1.truncate("/file", 32);
    var file = await fs_1.open("/file", O_RDONLY);
    await fs_1.ioctl(file, IOCTL_SELECT_INODE);
})();
</script>

In this filesystem each block is 16B.
The inode table is represented by the smaller slots on the left and the larger blocks on the right are regular disk blocks.
Here we see an inode that describes a file of length 32B.
You can see that it occupies You might have also noticed the `direct` and `indirect` fields.
These refer to the structures that store the block indicies used by this file.

Here you can see another example where we have a file who's contents are not contiguously stored on disk.
<canvas id="canvas_2"></canvas>
<script>
var canvas_2 = create_canvas('canvas_2');
var fs_2 = new MyFS(canvas_2);
fs_2.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});

var setup_2 = (async function() {
    await fs_2.create("/file", 0o777);
    await fs_2.truncate("/file", 16);

    await fs_2.create("/file1", 0o777);
    await fs_2.truncate("/file1", 16);

    await fs_2.truncate("/file", 48);
    var file = await fs_2.open("/file", O_RDONLY);
    await fs_2.ioctl(file, IOCTL_SELECT_INODE);
})();
</script>

When reading from this non-contiguous file, the `read` command will give us access to a stream of data and
will create the illusion that the file is one continous entity by seamlessly (ignoring disk performance) concatenating the data from one block with the data from the next block.
We'll provide a in-depth example of how reads/writes work in the next section.

Let's take a closer look at how we're keeping track of block indicies in the inode.
From the diagram above you can see that every inode occupies a fixed amount of space.
This would seem to imply that each inode can only store a very small, constant number of block indicies.
However, we can leverage the power of indirection to overcome this!

<blockquote>
“All problems in computer science can be solved by another level of indirection.” - David Wheeler
</blockquote>

An inode does store a few block indicies in the struct itself.
In our toy filesystem this number is just 2 (at 16B a block this represents 32B).
However the file highlighted above is a whopping 48 bytes!
This means that we're using an indirect block.

## Indirect blocks

To overcome the limitation of a fixed number of direct blocks, we used an indirect block.
An indirect block is just a normal disk block, but instead of storing the user's data in the block, we store a special kind of metadata.
We treat the entire block as an array of disk block addresses and store data inside it.
In our filesystem, each block index is just 1 byte so an indirect block can store a total of 16 addresses.

Let's take a look at how the indirect block of our 48 byte file above looks.

<pre id="info">Loading...</pre>
<script>
(async function() {
    await setup_2;
    var file = await fs_2.open("/file", O_RDONLY);
    var indirect = fs_2._inodes[file.inodenum].indirect[0];
    var disk_offset = indirect * fs_2.block_size;
    var disk_block = new Uint8Array(fs_2.disk, disk_offset, fs_2.block_size);
    var block_contents = Array.from(disk_block)
        .map(x => x.toString(16).padStart(2, '0'))
        .join(' ');
    var info_str =
        "Inode " + file.inodenum + ":\n" +
        "\tfilesize: " + fs_2._inodes[file.inodenum].filesize + "\n" +
        "\tindirect: " + indirect + "\n" +
        "\tcontents: " + block_contents + "\n";
    document.getElementById('info').textContent = info_str;
})();
</script>

As we can see, the indirect block contains 16 entries of which one is set to be block 6.
Note that 0 is a valid block number and the only way we can tell whether a block is filled in or not is to use the filesize.
In this case the filesize is `48 = 16 * 3` so we need 3 blocks to store the file.
Since there's only two direct blocks, we make use of the indirect block to find the third.

### Indirect block performance

Note that every time we want to access data that lives on a block that's recorded in an indirect block we'll have to read the indirect block.
On most systems this cost isn't very high if you're accessing the data relatively frequently since disk reads are cached (typically, in the kernel, filesystems are built close to the MMU).

Let's see this in action.
For this demo you may want to set your animation speed to the default speed if you've changed it.
See the [first post]({{ '/pages/1-intro.html' | relative_url }}) for instructions.

Every time a disk block is read it will flash. Try to guess which block is the indirect block.

<canvas id="canvas_3"></canvas>
<br>
<button onclick="run_disk_read()">Read file</button>
<script>
var canvas_3 = create_canvas('canvas_3');
var fs_3 = new MyFS(canvas_3);
var setup_3 = (async function() {
    fs_3.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 10,
        save: false,
    });
    await fs_3.create("/file", 0o777);
    await fs_3.truncate("/file", fs_3.max_filesize);
    fs_3.animations.reload_duration();
})();
var running = false;
async function run_disk_read() {
    if (running)
        return;
    running = true;
    await setup_3;
    var buffer = new Uint8Array(new ArrayBuffer(fs_3.max_filesize));
    var file = await fs_3.open("/file", O_RDONLY);
    await fs_3.read(file, buffer);
    running = false;
};
</script>

Try running it a few times if you didn't spot it.

If you still didn't catch that it's the fourth data block.
Note how it has to be accessed for any indirect block we read.

### Multiple level indirect blocks

What if we could do better than what we've described so far?
What if we used our indirect block to store pointers to indirect blocks which store pointers to data blocks.
Under our parameters of 16B blocks and 1B addresses, this gives us `16*16*16=4096`B, all for the price of one entry in our inode! 
Such a block is called a double indirect block
Similarly you can also have a triple indirect block which store addresses to double indirect blocks.

Unfortunately our visulazation doesn't support multi-level indirection, so you'll just have to imagine it or draw it out.

## Direct/Indirect block calculation questions

Before we continue try these calculations our for yourself (press enter in the input box to check your answer):

Given the filesystem we've been using for the visualizations (16B blocks, 1B addresses, 2 direct blocks and 1 indirect block per inode), answer the following:

What's the maximum possible filesize in this configuration?
<form onsubmit="check_answer(document.getElementById('max').value, '288'); return false;">
  <input id="max"/>B
</form>
<details><summary>Hint/answer</summary>
<div markdown="1">
We have `2` direct blocks of 16B each, and `1` indirect block of 16B holding pointers of 1B each to 16B blocks.
<div style="margin-left: 5%;">
  <details> <summary> Answer </summary>
    The direct blocks can store 16*2 = 32B of data.
    The indirect block has 16/1 = 16 addresses.
    Each address could point to a data block of 16B, so thats 16 * 16 = 256B of data.
    Add the values up to get 256 + 32 = 288B of data.
  </details>
</div>
</div>
</details>
<br>

What's the minimum possible disk usage for a file with a non-zero filesize in this configuration?
<form onsubmit="check_answer(document.getElementById('min').value, '16'); return false;">
  <input id="min"/>B
</form>
<details><summary>Hint/answer</summary> Each block is 16B, so the answer is 16B.  </details>
<br>

What's the total number of disk blocks used to represent a file of size 33B?
<form onsubmit="check_answer(document.getElementById('usage').value, '4'); return false;">
  <input id="usage"/>B
</form>
<details><summary>Hint/answer</summary>
32B is the maximum file size that can fit entirely inside the direct blocks, so our number is at least 2.
Since we're using at least 1 block in the indirect array, we have to consider not only the block that's storing that extra 1B,
but also the cost of the indirect block itself.
This brings the total up to 4.
</details>
<br>

Given a filesystem that has 16B blocks, 1B addresses, 2 direct blocks and 1 indirect block, and 1 double indirect per inode, answer the following:

What's the maximum possible filesize in this configuration?
<form onsubmit="check_answer(document.getElementById('max').value, '4384'); return false;">
  <input id="max"/>B
</form>
<details><summary>Hint/answer</summary>
<div markdown="1">
We can reuse the calculation we did for the max file above and only need to add the data addressed by the double indirect block.
<div style="margin-left: 5%;">
  <details> <summary> Answer </summary>
    with a double indirect block we can store an addition 4096B. `4096 + 288 = 4384`B.
  </details>
</div>
</div>
</details>
<br>

How much data can a triple indirect block point to it by itself (assuming 16B blocks/1B addresses)?
<form onsubmit="check_answer(document.getElementById('max').value, Math.pow(16, 4).toString()); return false;">
  <input id="max"/>B
</form>
<details><summary>Hint/answer</summary>
<div markdown="1">
Try drawing it out! Remember, a triple indirect block store pointers to double indirect blocks.
<div style="margin-left: 5%;">
  <details> <summary> Answer </summary>
  Each triple indirect block can store 16 addresses to a double indirect block which can store 16 addresses to single indirect blocks which can store addresses to 16 blocks of 16B each.
  Multiplying those values together we get `16^4 = 65536`.
  </details>
</div>
</div>
</details>
<br>
