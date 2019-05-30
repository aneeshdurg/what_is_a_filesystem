// requires fs_helper.js
function DefaultFS(){};
// TODO implement access, rename, chown
DefaultFS.prototype.mount = not_implemented;
DefaultFS.prototype.umount = not_implemented;
DefaultFS.prototype.readdir = not_implemented;
DefaultFS.prototype.stat = not_implemented;
DefaultFS.prototype.unlink = not_implemented;
DefaultFS.prototype.create = not_implemented;
DefaultFS.prototype.truncate = not_implemented;
DefaultFS.prototype.open = not_implemented;
DefaultFS.prototype.close = not_implemented;
DefaultFS.prototype.chmod = not_implemented;
DefaultFS.prototype.ioctl = not_implemented; // function ioctl(fd, request(, obj_data))
DefaultFS.prototype.link = not_implemented;
DefaultFS.prototype.mkdir = not_implemented;
DefaultFS.prototype.write = not_implemented;
DefaultFS.prototype.read = not_implemented;
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
