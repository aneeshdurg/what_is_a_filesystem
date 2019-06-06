function DefaultFS(){};

/**
 * Naming conventions:
 *
 * dir - a path that should point to a directory
 * fs - an instance of DefaultFS or a file containing a program returning an
 *      instance of DefaultFS
 * path - a path on the filesystem relative to the root of the filesystem
 *      paths must not end in trailing '/'s
 * mode - a number describing file permissions
 * fd - an instance of FileDescriptor
 * buffer - an instance of Uint8Array
 */
DefaultFS.prototype.mount = function (dir, fs) { return not_implemented(); }
DefaultFS.prototype.umount = function (dir) { return not_implemented(); }
DefaultFS.prototype.readdir = function (dir) { return not_implemented(); }
DefaultFS.prototype.stat = function (path) { return not_implemented(); }
DefaultFS.prototype.unlink = function (path) { return not_implemented(); }
DefaultFS.prototype.create = function (path, mode) { return not_implemented(); }
DefaultFS.prototype.truncate = function (path, size) { return not_implemented(); }
DefaultFS.prototype.open = function (path, flags, mode) { return not_implemented(); }
DefaultFS.prototype.close = function (fd) { return not_implemented(); }
DefaultFS.prototype.chmod = function (path, mode) { return not_implemented(); }
DefaultFS.prototype.ioctl = function (fd, request, data) { return not_implemented(); }
DefaultFS.prototype.link = function (src_path, dst_path) { return not_implemented(); }
DefaultFS.prototype.mkdir = function (path) { return not_implemented(); }
DefaultFS.prototype.write = function (fd, buffer) { return not_implemented(); }
DefaultFS.prototype.read = function (fd, buffer) { return not_implemented(); }
DefaultFS.prototype.seek = async function (fd, offset, whence) {
    var info = await fd.fs.stat(fd.path);
    if (typeof(info) == 'string')
        return "EBADF"

    if (whence == SEEK_SET)
        fd.offset = offset;
    else if (whence == SEEK_CURR)
        fd.offset += offset;
    else if (whence == SEEK_END)
        fd.offset = info.filesize + offset;
    else
        return "EINVAL";

    return 0;
};
