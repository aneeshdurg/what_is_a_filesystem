---
layout: post
title:  "Storing Data on a Disk"
---

Now that we know *what* a filesystem should do, we can start asking ourselves _how_ to accomplish these goals.
When it comes to storing data, we have a variety of options in today's world.
There's a plethora of storage mediums, from the slow relics of the past such as magnetic tape, to speedy solid-state drives that we all know and love.
Each storage medium comes with it's own pros and cons, for example, SSDs allow for fast random access,
but can endure less read/write cycles than their HDD counterparts, which are fine for sequential access, but have terrible performance when it comes to random access.
When implementing a filesystem, developers try to take the hardware into account to allow for certain optimizations, or otherwise prevent behaviors that could be damaging to the disk's longevity.
For our purposes, we will be assuming that our disk presents itself as a contiguous region of data and,
accessing any byte in this region is just as fast (or slow) as accessing any other byte in the region.

Typically, we think of the disk as a contiguous region composed of many smaller subregions called disk blocks.
This abstraction makes it easy to deal with files, which need to be discrete entities that store some data.
Let's take a look at what would happen if we didn't have this abstraction.

Suppose we have a disk of 100B and we store a file of 25B on it.

<canvas id="no_disk_blocks"></canvas>
<script>
function set_up_canvas(id) {
    var c = document.getElementById(id);
    c.width = c.parentElement.offsetWidth;
    c.height = 100;
    var ctx = c.getContext("2d");
    return ctx;
}

function draw_disk(ctx) {
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.stroke();
}

function draw_file(ctx, offset, filesize, color) {
    ctx.beginPath();
    ctx.rect(
        ctx.canvas.width * offset / 100,
        0,
        ctx.canvas.width * filesize / 100,
        ctx.canvas.height);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
}

var ctx = set_up_canvas('no_disk_blocks');
draw_disk(ctx);
draw_file(ctx, 0, 25, 'blue');
</script>

Let's say a user comes along and wants to add another 5 bytes.
That's no problem, we can just append it on the end of the file.

<canvas id="no_disk_blocks_1"></canvas>
<script>
var ctx = set_up_canvas('no_disk_blocks_1');
draw_disk(ctx);
draw_file(ctx, 0, 30, 'blue');
</script>

Now let's say the user creates a new file and writes 5B to it.
<canvas id="no_disk_blocks_2"></canvas>
<script>
var ctx = set_up_canvas('no_disk_blocks_2');
draw_disk(ctx);
draw_file(ctx, 0, 30, 'blue');
draw_file(ctx, 30, 5, 'red');
</script>

If the user then wants to append 5B to the first (blue) file again, we need to create a way to keep track of regions of memory owned by the file.
This is to avoid requiring a continguous region on disk which will either be expensive as we'll have to move entire files around periodidcally or impossible
when we have many programs operating on many files at once.
Suppose we had such a mechanism, we can then satisfy the request to get:
<canvas id="no_disk_blocks_3"></canvas>
<script>
var ctx = set_up_canvas('no_disk_blocks_3');
draw_disk(ctx);
draw_file(ctx, 0, 30, 'blue');
draw_file(ctx, 30, 5, 'red');
draw_file(ctx, 35, 5, 'blue');
</script>

Let's say that the user then goes back and forth writing 5B at a time to each file alternatingly.
After a while our disk would look like this:
<canvas id="no_disk_blocks_4"></canvas>
<script>
var ctx = set_up_canvas('no_disk_blocks_4');
draw_disk(ctx);
draw_file(ctx, 0, 30, 'blue');
var offset = 30;
var idx = 0;
while (offset < 100) {
    draw_file(ctx, offset, 5, (idx % 2) ? 'blue' : 'red');
    offset += 5;
    idx++;
}
</script>

So far there doesn't seem to be an issue.
We've filled up the disk with no problems right?
Let's revisit the problem of tracking what regions of disk are used by which file.
We need some kind of list of tuples of start and end indicies for every block of every file.
This leads to a couple grievences:

1. Accessing the `n`th byte of a file is an `O(b)` operation where `b` is the number of tuples stored by the file
2. In the worst case scenario, we have a lot of tuples describing very small ranges for every file
3. For disks that prefer sequential reads over random access (like HDDs) this scheme could lead to bad performance as reading one file could require a lot of jumping around the disk
4. In the worst case scenario, appending to a file requires moving all the way to the end of the disk from some arbitrary location, and reserving some space there

Problem `2` is especially catastrophic since we need to store these file descriptions somewhere.
Since we'd generally like our disk to retain it's data even after the machine has been powered down and the RAM has been lost, we need to store these file descriptions on the disk as well.
For now, we'll just constrain our thinking to only keep in mind that it would be nice to have small and neat file descriptions and we'll tackle the details of storing them later.

If you haven't guessed already, disk blocks help us overcome these problems.
By thinking about the disk as a collection of fixed size blocks (with a reasonable block size),
we have a neat way of tracking what regions of disk are used by a fiel by only tracking the indicies of the blocks it uses.
Since the blocks are homogenous in size, it's relatively straightforward to calculate which block index corresponds to a particular byte in a file in `O(1)`.
We also won't be as plagued by problem `2` and instead we have a good lower bound per region.
Similarly, while it doesn't completely prevent against problem `3` , in the worst case we know that we can at least read `sizeof(disk block)` number of bytes contiguously.
This also implies that for appending a small amount of data,
we might be able to use leftover space from the last used block, and don't necessarily need to go grab a new block, thus alleviating problem `4`.

Re-considering the above scenario with disk blocks of size 10, we see:

<canvas id="with_disk_blocks"></canvas>
<script>
var ctx = set_up_canvas('with_disk_blocks');
draw_disk(ctx);
draw_file(ctx, 0, 10, 'blue');
draw_file(ctx, 10, 10, 'blue');
draw_file(ctx, 20, 10, 'blue');
var offset = 30;
var idx = 0;
while (offset < 100) {
    draw_file(ctx, offset, 10, (idx % 2) ? 'blue' : 'red');
    offset += 10;
    idx++;
}
</script>

Which is neater and requires less metadata overall.

Using disk blocks does bring about 2 disadvantages though.
The first is that unlike in the case without disk blocks, large regions of contiguous data require tracking multiple data block numbers.
If your filesystem needs to be optimized for large files, you may want to come up with a clever way to represent this.
The second is that it enforces that the amount of disk used by a file will always be a perfect multiple of the size of a disk block.
This means that you might occasionally end up wasting space.

For example, consider 10B disk blocks as above, but suppose that we have a file that's 11B.

<canvas id="with_disk_blocks_wastage"></canvas>
<script>
var ctx = set_up_canvas('with_disk_blocks_wastage');
draw_disk(ctx);
draw_file(ctx, 0, 10, 'blue');
draw_file(ctx, 10, 10, 'white');
ctx.beginPath();
ctx.rect(
    ctx.canvas.width * 10 / 100,
    0,
    ctx.canvas.width * 1 / 100,
    ctx.canvas.height);
ctx.fillStyle = 'blue';
ctx.strokeStyle = 'blue';
ctx.fill();
ctx.stroke();
</script>

In this case, we only use 1 of the 10 availible bytes in the last block and thus waste 9B unless we append to the file later.

In the next section we'll explore how we can set up a way to describe a file and the blocks it will occupy.
