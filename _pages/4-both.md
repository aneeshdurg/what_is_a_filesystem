---
layout: post
title: shell and filesystem
---
<style>
html, body{
    height: 100%;
    width: 100%;
}
.shell{
    max-height: 500px;
    overflow: scroll;
}

</style>
This is our shell + filesystem:
<div id="shell_parent"></div>
<canvas id="myCanvas"></canvas>

<script>
create_canvas("myCanvas");
canvas = document.getElementById('myCanvas');
var fs = new LayeredFilesystem(canvas);
var shell = new Shell(fs, document.getElementById("shell_parent"));
shell.main();

async function creator() {
    for (var i = 0; i < 18; i++) {
        await fs.create("/newfile" + i, 0o777);
    }
}
async function destroyer() {
    for (var i = 17; i >= 0; i--) {
        await fs.unlink("/newfile" + i);
    }
}
</script>

<div>
<button onclick="creator()">create files</button>
<button onclick="destroyer()">unlink files</button>
</div>
