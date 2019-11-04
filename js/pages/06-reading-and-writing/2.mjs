---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.mjs' | relative_url }}"
import {Shell} from "{{ '/js/shell.mjs' | relative_url }}"

import {create_file_from_remote, run_cat_on_shell} from "./1.mjs"

var fs_2 = new MyFS(document.getElementById('fs_2'));
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

    fs_2.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 0,
        save: false,
    });

    run_cat_on_shell(shell_2);
})();

window.step_fs_2 = function () {
    fs_2.animations.draw();
}
