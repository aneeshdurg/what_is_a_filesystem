---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {CONSTANTS, IOCTL_SELECT_INODE} from "{{ '/js/defs.mjs' | relative_url }}"

// Make fs_2 global
export const fs_2 = new MyFS(document.getElementById('fs_2'));
fs_2.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
    duration: 10,
    save: false,
});

export const setup_2 = (async function() {
    await fs_2.create("/file", 0o777);
    await fs_2.truncate("/file", 16);

    await fs_2.create("/file1", 0o777);
    await fs_2.truncate("/file1", 16);

    await fs_2.truncate("/file", 48);
    var file = await fs_2.open("/file", CONSTANTS.O_RDONLY);
    await fs_2.ioctl(file, IOCTL_SELECT_INODE);
})();
