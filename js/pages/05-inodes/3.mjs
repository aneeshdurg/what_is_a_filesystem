---
---
import {CONSTANTS} from "{{ '/js/defs.mjs' | relative_url }}"

import {fs_2, setup_2} from "./2.mjs"

(async function() {
    await setup_2;
    var file = await fs_2.open("/file", CONSTANTS.O_RDONLY);
    var indirect = fs_2._inodes[file.inodenum].indirect[0];
    var disk_offset = indirect * fs_2.block_size;
    var disk_block = new Uint8Array(fs_2.disk, disk_offset, fs_2.block_size);
    var block_contents = Array.from(disk_block)
        .map(x => x.toString(16).padStart(2, '0'))
        .join(' ');
    var info_str =
        "Inode " + file.inodenum + ":\n" +
        "\tfilesize: " + fs_2._inodes[file.inodenum].filesize + "\n" +
        "\tindirect: " + indirect + "\n" +
        "\tcontents: " + block_contents + "\n";
    document.getElementById('info').textContent = info_str;
})();
