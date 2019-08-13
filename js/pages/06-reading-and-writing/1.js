---
---
import {CONSTANTS} from "{{ '/js/defs.js' | relative_url }}"
import {bytes_to_str} from "{{ '/js/fs_helper.js' | relative_url }}"
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.js' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.js' | relative_url }}"
import {Shell} from "{{ '/js/shell.js' | relative_url }}"

export async function create_file_from_remote(fs, remote, local) {
    var request = await fetch(remote);
    var reader = request.body.getReader();
    var file = await fs.open(local, CONSTANTS.O_WRONLY | CONSTANTS.O_CREAT, 0o777);
    console.log(file);
    while (true) {
        var result = await reader.read();
        console.log(result);
        if (result.done)
            break;
        await fs.write(file, result.value);
    }
}

export function run_cat_on_shell(shell) {
    shell.simulate_input("cat /file\n");
}


var canvas_1 = create_canvas('canvas_1');
var fs_1 = new MyFS(canvas_1);
fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});

var shell_1 = new Shell(new LayeredFilesystem(fs_1), document.getElementById('shell_1'));
shell_1.remove_container_event_listeners();
shell_1.prompt = function () { return "\n\n"; };
shell_1.main("{{ site.baseurl }}");

var action_1 = (async function() {
    await shell_1.initialized;
    await create_file_from_remote(fs_1, "{{ '/assets/32b.txt' | relative_url}}", "/file");
    fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 0,
        save: false,
    });
    run_cat_on_shell(shell_1);
})();

window.step_fs_1 = function (){
    fs_1.animations.draw();
}

var pre = document.getElementById('5b_read');
var setup_done = false;
var fd = null;
async function setup_step_5b_read() {
    if (!setup_done) {
        await action_1;
        fd = await fs_1.open("/file", CONSTANTS.O_RDONLY);
        setup_done = true;
    }
    return fd;
}

window.step_5b_read = async function () {
    fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 10,
        save: false,
    });
    var file = await setup_step_5b_read();
    var buffer = new Uint8Array(new ArrayBuffer(5));
    var bytes_read = await fs_1.read(file, buffer);
    var read_view = new Uint8Array(buffer.buffer, 0, bytes_read);
    pre.innerText += "read returned " + bytes_read + " bytes(s): '" + bytes_to_str(read_view) + "'\n";
}
