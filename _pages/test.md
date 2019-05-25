---
layout: post
title:  "Test"
---

This is a simple test.


<canvas id="myCanvas" style="width:50%; height:20%" style="border:1px solid #d3d3d3;">

<script>
function test_basic() {
    canvas = document.getElementById('myCanvas');
    fs = new MyFS(canvas);
    return fs;
}
var fs = test_basic();
</script>
