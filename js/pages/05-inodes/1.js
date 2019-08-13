---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.js' | relative_url }}"
import {CONSTANTS, IOCTL_SELECT_INODE} from "{{ '/js/defs.js' | relative_url }}"

var canvas_1 = create_canvas('canvas_1');

var fs_1 = new MyFS(canvas_1);
fs_1.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});

(async function() {
    await fs_1.create("/file", 0o777);
    await fs_1.truncate("/file", 32);
    var file = await fs_1.open("/file", CONSTANTS.O_RDONLY);
    await fs_1.ioctl(file, IOCTL_SELECT_INODE);
})();


