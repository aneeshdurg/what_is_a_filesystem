---
layout: post
title:  "Filesystem"
---

This is our filesystem model.


<canvas id="myCanvas"></canvas>
<br/>
<button onclick="creator()">create files</button>
<button onclick="destroyer()">unlink files</button>
<script>
create_canvas("myCanvas");
function test_basic() {
    canvas = document.getElementById('myCanvas');
    fs = new MyFS(canvas);
    return fs;
}
var fs = test_basic();
</script>

<script>
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
