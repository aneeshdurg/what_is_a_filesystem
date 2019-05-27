---
layout: post
title:  "Navigating the File Tree"
---
<script>
window.onload = function() {
    var fs = new MyFS();
    
    var shell_1 = new Shell(new LayeredFilesystem(fs), document.getElementById("shell_1"));
    shell_1.main();
    
    var shell_2 = new Shell(new LayeredFilesystem(fs), document.getElementById("shell_2"));
    shell_2.main();
};
</script>

These shells are linked:

<div id="shell_1"></div>
<br>
<div id="shell_2"></div>

Each example can now build up off of the state from the previous one.
