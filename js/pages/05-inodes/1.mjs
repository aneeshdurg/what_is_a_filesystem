---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {CONSTANTS, IOCTL_SELECT_INODE} from "{{ '/js/defs.mjs' | relative_url }}"

var fs_1 = new MyFS(document.getElementById('fs_1'));
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
