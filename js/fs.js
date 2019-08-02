class DefaultFS {
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
    mount(dir, fs) { return not_implemented(); }
    umount(dir) { return not_implemented(); }
    readdir(dir) { return not_implemented(); }
    stat(path) { return not_implemented(); }
    unlink(path) { return not_implemented(); }
    create(path, mode) { return not_implemented(); }
    truncate(path, size) { return not_implemented(); }
    open(path, flags, mode) { return not_implemented(); }
    close(fd) { return not_implemented(); }
    chmod(path, mode) { return not_implemented(); }
    ioctl(fd, request, data) { return not_implemented(); }
    link(src_path, dst_path) { return not_implemented(); }
    mkdir(path, mode) { return not_implemented(); }
    write(fd, buffer) { return not_implemented(); }
    read(fd, buffer) { return not_implemented(); }
    async seek(fd, offset, whence) {
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

}
