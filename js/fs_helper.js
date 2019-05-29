function inherit(A, B) {
    A.prototype = Object.create(B.prototype);
    Object.defineProperty(A.prototype, 'constructor', {
        value: A,
        enumerable: false,
        writable: true
    });
}

const O_ACCESS = 0;
const O_APPEND = 1;
const O_CREAT = 2;
const O_TRUNC = 4;
const O_RDONLY = 8;
const O_WRONLY = 16;
const O_RDWR = O_RDONLY | O_WRONLY;

const SEEK_SET = 0;
const SEEK_END = 1;
const SEEK_CURR = 2;

const IOCTL_IS_TTY = 0;
const IOCTL_SELECT_INODE = 1;

function FileDescriptor(fs, path, inodenum, inode, mode) {
    this.fs = fs;
    this.path = path;
    this.inodenum = inodenum;
    this.inode = inode;
    this.mode = mode;
    this.offset = 0;
}

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
    for (param of _stat_params)  {
        // this.param = param;
        stat_src += "this." + param + " = " + param + ";";
    }
    stat_src += "});"
    return eval(stat_src);
}
const Stat = _gen_stat();

function Dirent(inodenum, filename) {
    this.inodenum = inodenum;
    this.filename = filename;
}

function split_parent_of(child) {
    if (child == "/")
        return ["/", "/"];

    var parts = child.split("/")
    var parent_part = parts.slice(0,-1).join("/");
    if (parent_part == "")
        parent_part = "/";
    return [ parent_part, parts.slice(-1)[0] ];
}

function not_implemented() {
    return "EIMPL";
}

function bytes_to_str(bytes) {
    return String.fromCharCode.apply(null, bytes);
}

function str_to_bytes(str) {
    return new Uint8Array(Array.from(str).map(x => x.charCodeAt(0)));
}
