---
layout: post
title:  "Reading/Writing with inodes"
---

Reading and writing from inodes with direct and indirect blocks can be tricky business.
Let's begin by considering the simplest cases, ones where we're reading a file that fits entirely into the direct blocks.
This time each step in the animation will advance only when you press `step`.

{% raw %}
<div id='shell_1'></div>
<canvas id='canvas_1'></canvas>
<button onclick='step_fs_1()'>Step</button>
<script>
var canvas_1 = create_canvas('canvas_1');
var fs_1 = new MyFS(canvas_1);
fs_1.animations.set_duration(10);
var shell_1 = new Shell(new LayeredFilesystem(fs_1), document.getElementById('shell_1'));
shell_1.remove_container_event_listeners();
shell_1.prompt = function () { return "\n\n"; };
shell_1.main();
var action_1 = (async function() {
    await shell_1.initialized;
    await fs_1.create("/file", 0o777);
    var content = "This data is 32 bytes..........\n";
    await fs_1.write(await fs_1.open("/file", O_WRONLY), str_to_bytes(content));
    // TODO IOCTL_SET_ANIMATION_DURATION
    fs_1.animations.set_duration(0);
    var command = [
        Array.from("cat /file"),
        ["Enter"]];
    for (i of command)
        for (c of i)
            shell_1.process_input(c, false);
})();
function step_fs_1() {
    fs_1.animations.draw();
}
</script>
{% endraw %}

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
// TODO create mirrored filesystems?
// TODO allow multiple canvases per filesystem?
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
    fs_1.animations.set_duration(10);
    var file = await setup_step_5b_read();
    var buffer = new Uint8Array(new ArrayBuffer(5));
    var bytes_read = await fs_1.read(file, buffer);
    var read_view = new Uint8Array(buffer.buffer, 0, bytes_read);
    pre.innerText += "read returned " + bytes_read + " bytes(s): '" + bytes_to_str(read_view) + "'\n";
}
</script>


