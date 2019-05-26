---
layout: post
title: Shell
---

This is our shell:
<div id="shell_parent"></div>
<script>
var fs = new LayeredFilesystem();
var shell = new Shell(fs, document.getElementById("shell_parent"));
shell.main();
</script>
