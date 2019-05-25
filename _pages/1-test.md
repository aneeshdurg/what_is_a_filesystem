---
layout: post
title:  "Test"
---

This is a simple test.


<canvas id="myCanvas"></canvas>
<script>
create_canvas("myCanvas");
function test_basic() {
    canvas = document.getElementById('myCanvas');
    fs = new MyFS(canvas);
    return fs;
}
var fs = test_basic();
</script>
