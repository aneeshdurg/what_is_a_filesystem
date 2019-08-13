---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {CONSTANTS} from "{{ '/js/defs.mjs' | relative_url }}"

var canvas_3 = create_canvas('canvas_3');
var fs_3 = new MyFS(canvas_3);
var setup_3 = (async function() {
    fs_3.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 10,
        save: false,
    });
    await fs_3.create("/file", 0o777);
    await fs_3.truncate("/file", fs_3.max_filesize);
    fs_3.animations.reload_duration();
})();

var running = false;
window.run_disk_read = async function run_disk_read() {
    if (running)
        return;
    running = true;
    await setup_3;
    var buffer = new Uint8Array(new ArrayBuffer(fs_3.max_filesize));
    var file = await fs_3.open("/file", CONSTANTS.O_RDONLY);
    await fs_3.read(file, buffer);
    running = false;
};
