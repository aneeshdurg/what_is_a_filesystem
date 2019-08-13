---
---
import {LayeredFilesystem} from "{{ '/js/lfs.mjs' | relative_url }}"
import {MyFS} from "{{ '/js/myfs.mjs' | relative_url }}"
import {Shell} from "{{ '/js/shell.mjs' | relative_url }}"

window.onload = async function() {
    var fs = new MyFS();

    var shell_containers = document.querySelectorAll('[id^="shell_"]');
    var prev_shell_init = null;
    for (let shell_el of shell_containers) {
        await prev_shell_init;
        var shell = new Shell(new LayeredFilesystem(fs), shell_el);
        shell.main("{{ site.baseurl }}");
        prev_shell_init = shell.initialized;
    }
};

