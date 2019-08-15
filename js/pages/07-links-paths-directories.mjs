---
---
import {MyFS} from "{{ '/js/myfs.mjs' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.mjs' | relative_url }}"
import {Shell} from "{{ '/js/shell.mjs' | relative_url }}"


var fs = new MyFS(document.getElementById('fs_1'));
var shell = new Shell(new LayeredFilesystem(fs), document.getElementById("shell_1"));
shell.main("{{ site.baseurl }}");

var shell_2 = new Shell(new LayeredFilesystem(fs), document.getElementById("shell_2"));
shell_2.remove_container_event_listeners();
shell_2.prompt = function () { return "\n\n"; };

(async function() {
    await shell.initialized;
    shell_2.main("{{ site.baseurl }}");
})();

window.run_cat = function () {
    shell_2.simulate_input("cat /\n");
}

window.run_hexdump = function () {
    shell_2.simulate_input("hexdump /\n");
}

var shell_3 = new Shell(
  new LayeredFilesystem(null, document.getElementById('fs_3')), document.getElementById("shell_3"));
shell_3.main("{{ site.baseurl }}");
