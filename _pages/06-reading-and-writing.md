---
layout: post
title:  "Reading/Writing with inodes"
---

# Reading data

Reading and writing from inodes with direct and indirect blocks can be tricky business.
Let's begin by considering the simplest cases, ones where we're reading a file that fits entirely into the direct blocks.
This time each step in the animation will advance only when you press `step`.

<div id='shell_1'></div>
<canvas id='canvas_1'></canvas>
<button onclick='step_fs_1()'>Step</button>
<script>
var canvas_1 = create_canvas('canvas_1');
var fs_1 = new MyFS(canvas_1);
fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});
var shell_1 = new Shell(new LayeredFilesystem(fs_1), document.getElementById('shell_1'));
shell_1.remove_container_event_listeners();
shell_1.prompt = function () { return "\n\n"; };
shell_1.main("{{ site.baseurl }}");
async function create_file_from_remote(fs, remote, local) {
    var request = await fetch(remote);
    var reader = request.body.getReader();
    var file = await fs.open(local, O_WRONLY | O_CREAT, 0o777);
    console.log(file);
    while (true) {
        var result = await reader.read();
        console.log(result);
        if (result.done)
            break;
        await fs.write(file, result.value);
    }
}
function run_cat_on_shell(shell) {
    var command = [
        Array.from("cat /file"),
        ["Enter"]];
    for (i of command)
        for (c of i)
            shell.process_input(c, false);
}
var action_1 = (async function() {
    await shell_1.initialized;
    await create_file_from_remote(fs_1, "{{ '/assets/32b.txt' | relative_url}}", "/file");
    fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 0,
        save: false,
    });
    run_cat_on_shell(shell_1);
})();
function step_fs_1() {
    fs_1.animations.draw();
}
</script>

Notice how we read one block at a time?
Many programs attempt to optimize read/write performance by always trying to access data the size of a block.
What if we try reading some number of bytes that's not divisible by the size of a block?
Let's try reading 5 bytes at a time.

Note that running this example prevents the _step_ button above from working.
To re-run the above example after running this one, reload the page.

<pre id='5b_read'></pre>
<button onclick='step_5b_read()'>read 5b</button>
<script>
var pre = document.getElementById('5b_read');
var setup_done = false;
var fd = null;
async function setup_step_5b_read() {
    if (!setup_done) {
        await action_1;
        fd = await fs_1.open("/file", O_RDONLY);
        setup_done = true;
    }
    return fd;
}
async function step_5b_read() {
    fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 10,
        save: false,
    });
    var file = await setup_step_5b_read();
    var buffer = new Uint8Array(new ArrayBuffer(5));
    var bytes_read = await fs_1.read(file, buffer);
    var read_view = new Uint8Array(buffer.buffer, 0, bytes_read);
    pre.innerText += "read returned " + bytes_read + " bytes(s): '" + bytes_to_str(read_view) + "'\n";
}
</script>


Note how read returns us 5 bytes as if this weird structure of storing data in blocks could have been replaced by one continous storage mechanism?
This is the motivation behind defining a filesystem as a series of callbacks - we can use familiar interfaces that are agnostic of the actual mechanism that stores the data.

By convention, read will return 0 when it know that we've read past the end of the file. But how does read keep track of how many bytes it's read?
Enter the offset.
Back in the [third section](/pages/03-file-api.html) we saw that in FUSE, read and write take an offset that they must update to indicate how many bytes of the file they have operated.
The filesystem callbacks for read and write can use this offset parameter to control what data they should return.
(e.g. in our reading example above, at the end of each read, we should increment the offset by 5, so the next read will give us data we haven't read before)

Let's take a look at a slightly more involved example, one where the size of the file is equal to the maximum filesize.
As we calculated in the [previous section](/pages/05-inodes.html), the maximum size of a file is `288B`.

<div id='shell_2'></div>
<canvas id='canvas_2'></canvas>
<button onclick='step_fs_2()'>Step</button>
<script>
var canvas_2 = create_canvas('canvas_2');
var fs_2 = new MyFS(canvas_2);
fs_2.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 10,
        save: false,
});
var shell_2 = new Shell(new LayeredFilesystem(fs_2), document.getElementById('shell_2'));
shell_2.remove_container_event_listeners();
shell_2.prompt = function () { return "\n\n"; };
shell_2.main("{{ site.baseurl }}");
var action_2 = (async function() {
    await shell_2.initialized;
    await create_file_from_remote(fs_2, "{{ '/assets/288b.txt' | relative_url }}", "/file");
    // TODO IOCTL_SET_ANIMATION_DURATION
    fs_2.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 0,
        save: false,
    });
    run_cat_on_shell(shell_2);
})();
function step_fs_2() {
    fs_2.animations.draw();
}
</script>

Notice how in this example, as you step through we access block 5 frequently.
Can you guess why?

Block 5 is the indirect block for the file `/file`.
This implies that every time we need to read data stored in a block pointed to by the indirect array, we need to first read the indirect block to find the right block number.
Can you think of situations when this would be bad?

If we're using a traditional spinning disk that has a high cost to jumping around the disk, frequently reading the indirect block and then having to jump to some far-away block could be very expensive!
Fortunately this usually isn't much of an issue thanks to the fact that most filesystems can take advantage of caching reads in memory.
The contents of the indirect block are usually cached in memory to avoid having to do additional disk reads to access data.
Our visulation above has no such optimizations and follows a relatively naive approach.

# Writing data

The key difference between reading and writing are the number of ways a write can fail.
Writes can fail when we run out of disk space, or when we attempt to increase the filesize beyond what the filesystem supports, or if we try writing to a file we don't have write permissions to.
This makes writing a slightly more complex operation, but the underlying principles are the same as reading.

We can simulate arbitrary sized writes of buffers full of null bytes with the command `truncate`, which is named after the file system operation of the same name.
This operation is provided by the filesystem for two reasons.
Primarily, `truncate` is the only mechanism by which we can decrease the filesize and release blocks back to the disk for other files to use.
The other reason is that `truncate` can sometimes be used to create [sparse files](https://en.wikipedia.org/wiki/Sparse_file), a file that contains large segments of contiguous zeros.
We won'te cover sparse files in detail in this website, and in our filesystem, `truncate` either releases blocks or writes `0`s until the file has the requested size.

In the shell below, create a file with `touch`, and then use `truncate [filename] [filesize]` to simulate writes. Note how the indirect block is accessed when we start writing more than `32` bytes.

For example, try the following sequence of commands:

+ `touch newfile`
+ `truncate newfile 32`
+ `truncate newfile 64`
+ `truncate newfile 288`
+ `truncate newfile 0`

And watch how the disk is accessed in each case.
(If you'd like to slow down or speed up the animations, please refer to the [first post]({{ '/pages/01-intro.html#speed_selector' | relative_url }}))

<div id='shell_3'></div>
<canvas id='canvas_3'></canvas>
<script>
var canvas_3 = create_canvas('canvas_3');
var fs_3 = new MyFS(canvas_3);
var shell_3 = new Shell(new LayeredFilesystem(fs_3), document.getElementById('shell_3'));
shell_3.main("{{ site.baseurl }}");
</script>
