---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.js' | relative_url }}"
import {CONSTANTS, IOCTL_SELECT_INODE} from "{{ '/js/defs.js' | relative_url }}"

var canvas_2 = create_canvas('canvas_2');

// Make fs_2 global
window.fs_2 = new MyFS(canvas_2);
fs_2.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});

window.setup_2 = (async function() {
    await fs_2.create("/file", 0o777);
    await fs_2.truncate("/file", 16);

    await fs_2.create("/file1", 0o777);
    await fs_2.truncate("/file1", 16);

    await fs_2.truncate("/file", 48);
    var file = await fs_2.open("/file", CONSTANTS.O_RDONLY);
    await fs_2.ioctl(file, IOCTL_SELECT_INODE);
})();
