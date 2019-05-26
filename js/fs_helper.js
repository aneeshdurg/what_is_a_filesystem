function inherit(A, B) {
    A.prototype = Object.create(B.prototype);
    Object.defineProperty(A.prototype, 'constructor', {
        value: A,
        enumerable: false,
        writable: true
    });
}

O_APPEND = 1;
O_CREAT = 2;
O_TRUNC = 4;
O_RDONLY = 8;
O_WRONLY = 16;
O_RDWR = O_RDONLY | O_WRONLY;

SEEK_SET = 0;
SEEK_END = 1;
SEEK_CURR = 2;

function FileDescriptor(fs, path, inode, mode) {
    this.fs = fs;
    this.path = path;
    this.inode = inode;
    this.mode = mode;
    this.offset = 0;
}

function Stat(path, inodenum, mode, is_directory, filesize) {
    this.path = path;
    this.inodenum = inodenum;
    this.mode = mode;
    this.is_directory = is_directory;
    this.filesize = filesize;
    // TODO add atim, ctim, mtim, owner, group
}

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
