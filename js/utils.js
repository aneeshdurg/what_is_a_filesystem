O_APPEND = 1;
O_CREAT = 2;
O_TRUNC = 4;
O_RDONLY = 8;
O_WRONLY = 16;
O_RDWR = O_RDONLY | O_WRONLY;

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
