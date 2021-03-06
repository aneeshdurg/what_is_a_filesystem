// requires fs.mjs
import {DefaultFS} from './fs.mjs'
import {MyFS} from './myfs.mjs'
import {CONSTANTS} from './defs.mjs'

export class LayeredFilesystem extends DefaultFS {
    constructor(rootfs, canvas) {
        super();
        this.mountpoints = {};

        if (!rootfs)
            rootfs = new MyFS(canvas);
        this.mountpoints["/"] = rootfs;
    }

     get_mountpoint_of_path(path) {
        if (this.mountpoints[path])
            return path;

        for (var i = 1; i < path.length; i++){
            var prefix = path.slice(0, -1 * i);
            if (this.mountpoints[prefix])
                return prefix;
        }
    }

     resolve_fs_and_path(path) {
        var mountpoint = this.get_mountpoint_of_path(path);
        var fs = this.mountpoints[mountpoint];
        if (fs == null) {
            return "ENOENT";
        }

        var relpath = path.slice(mountpoint.length)
        if (!relpath.length || relpath[0] != "/")
            relpath = "/" + relpath;

        return {
            fs: fs,
            relpath: relpath
        };
    }

    async mount(dir, fs) {
        if (!(fs instanceof DefaultFS))
            return "EINVAL";

        var info = await this.stat(dir);
        if(!info.is_directory)
            return "ENOTDIR";

        this.mountpoints[dir] = fs;
        return 0;
    }

    async umount(dir) {
        if (!this.mountpoints[dir])
            return "EINVAL";

        this.mountpoints[dir] = null;
        return 0;
    }

    async close(fd) {
      return fd.fs.close(fd);
    }
}

/**
 * The following are methods for/generated by generating wrapper methods on the LFS class
 * that just call a method on a mounted filesystem
 *
 * TODO refactor these to be more readable
 */
function __gen_LayeredFilesystem_callback_1(name) {
    eval("LayeredFilesystem.prototype." + name + "= async function (path) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath);" +
        "};");
}

function __gen_LayeredFilesystem_callback_2_file(name) {
    eval("LayeredFilesystem.prototype." + name + "= async function (file, arg2) {" +
        "  return file.fs." + name + "(file, arg2);" +
        "};");
}

function __gen_LayeredFilesystem_callback_2_resolve_1(name) {
    eval("LayeredFilesystem.prototype." + name + "= async function (path, arg2) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath, arg2);" +
        "};");
}

function __gen_LayeredFilesystem_callback_2_resolve_2(name) {
    eval("LayeredFilesystem.prototype." + name + "= async function (path, path2) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  var resolved2 = this.resolve_fs_and_path(path2);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  if (typeof(resolved2) === 'string') return resolved2;" +
        "  if (resolved.fs != resolved2.fs) return 'EINVAL';" +
        "  return resolved.fs." + name + "(resolved.relpath, resolved2.relpath);" +
        "};");
}
function __gen_LayeredFilesystem_callback_3_resolve_1(name) {
    eval("LayeredFilesystem.prototype." + name + "= async function (path, arg2, arg3) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath, arg2, arg3);" +
        "};");
}

function __gen_LayeredFilesystem_callback_3_file(name) {
    eval("LayeredFilesystem.prototype." + name + "= async function (fd, arg2, arg3) {" +
        "  return fd.fs." + name + "(fd, arg2, arg3);" +
        "};");
}

__gen_LayeredFilesystem_callback_1("readdir");
__gen_LayeredFilesystem_callback_1("stat");
__gen_LayeredFilesystem_callback_1("unlink");

__gen_LayeredFilesystem_callback_2_file("read");
__gen_LayeredFilesystem_callback_2_file("write");

__gen_LayeredFilesystem_callback_2_resolve_1("chmod");
__gen_LayeredFilesystem_callback_2_resolve_1("create");
__gen_LayeredFilesystem_callback_2_resolve_1("mkdir");
__gen_LayeredFilesystem_callback_2_resolve_1("truncate");

__gen_LayeredFilesystem_callback_2_resolve_2("link");

__gen_LayeredFilesystem_callback_3_file("ioctl");

__gen_LayeredFilesystem_callback_3_resolve_1("open");
