/**
 * IOCTL numbers need to be unique, this is a good way of ensuring that (up to overflow).
 * Arguably, this is overkill, since they only need to be unique *per* filesystem.
 */
var __ioctl_counter = 0;
export function get_unused_ioctl_num() { return __ioctl_counter++; }
export const IOCTL_IS_TTY = get_unused_ioctl_num();
export const IOCTL_SELECT_INODE = get_unused_ioctl_num();

export class CONSTANTS {
    static get O_ACCESS() {
      return 0;
    }

    static get O_APPEND() {
      return 1;
    }

    static get O_CREAT() {
      return 2;
    }

    static get O_TRUNC() {
      return 4;
    }

    static get O_RDONLY() {
      return 8;
    }

    static get O_WRONLY() {
      return 16;
    }

    static get O_RDWR() {
      return CONSTANTS.O_RDONLY | CONSTANTS.O_WRONLY;
    }

    static get O_DIRECTORY() {
      return 32;
    }

    static get SEEK_SET() {
      return 0;
    }

    static get SEEK_END() {
      return 1;
    }

    static get SEEK_CURR() {
      return 2;
    }
}

export class FileDescriptor {
    constructor(fs, path, inodenum, inode, mode) {
        this.fs = fs;
        this.path = path;
        this.inodenum = inodenum;
        this.inode = inode;
        this.mode = mode;
        this.offset = 0;
    }
}

export class Dirent {
    constructor(inodenum, filename) {
        this.inodenum = inodenum;
        this.filename = filename;
    }
}

/**
 * Stat - a class that describes the output of a `stat` call.
 * This class is generated dynamically from the list below
 */
const _stat_params = [
    "path",
    "inodenum",
    "mode",
    "is_directory",
    "filesize",
    "atim",
    "mtim",
    "ctim",
];
function _gen_stat() {
    var stat_src = "(function (" + _stat_params.join(",") + ") {";
    for (let param of _stat_params)  {
        // this.param = param;
        stat_src += "this." + param + " = " + param + ";";
    }
    stat_src += "});"
    return eval(stat_src);
}
export const Stat = _gen_stat();
