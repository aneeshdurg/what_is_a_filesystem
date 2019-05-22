O_APPEND = 1;
O_CREAT = 2;
O_TRUNC = 4;

function LayeredFilesystem() {
    this.mountpoints = {};
}

LayeredFilesystem.prototype.resolve_fs_and_path = function(path) {
    var mountpoint = this.get_mountpoint_of_path(path);
    var fs = this.mountpoints[mountpoint];
    if (fs == null) {
        return "ENOENT";
    }

    var relpath = path.slice(mountpoint.length)
    return {
        fs: fs,
        relpath: relpath
    };
}

LayeredFilesystem.prototype.mount = function(dir, fs) {
    //this.verify_fs(fs);
    this.mountpoints[dir] = fs;
}

function __gen_LayeredFilesystem_callback_1(name) {
    eval("LayeredFilesystem.prototype." + name + "= function (path) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath);" +
        "};");
}

// file_descriptor is an object containing the offset
function __gen_LayeredFilesystem_callback_2(name) {
    eval("LayeredFilesystem.prototype." + name + "= function (path, arg2) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath, arg2);" +
        "};");
}

function __gen_LayeredFilesystem_callback_3(name) {
    eval("LayeredFilesystem.prototype." + name + "= function (path, arg2, arg3) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath, arg2, arg3);" +
        "};");
}

__gen_LayeredFilesystem_callback_1("close");
__gen_LayeredFilesystem_callback_1("mkdir");
__gen_LayeredFilesystem_callback_1("readdir");
__gen_LayeredFilesystem_callback_1("stat");
__gen_LayeredFilesystem_callback_1("unlink");

__gen_LayeredFilesystem_callback_2("chmod");
__gen_LayeredFilesystem_callback_2("link");
__gen_LayeredFilesystem_callback_2("read");
__gen_LayeredFilesystem_callback_2("write");

__gen_LayeredFilesystem_callback_3("open");

function not_implemented() {
    // TODO errno stuff?
    return;
}

// Paths cannot have trailing / or // anywhere
// max filename length = 15
function MyFS() {
    this.block_size = 16; // block size in B
    this.dirent_size = this.block_size;
    this.num_blocks = 256; // blocks can be addressed with 1B
    this.blockmap = new Array(this.num_blocks).fill(false);
    this.disk = new ArrayBuffer(this.num_blocks * this.block_size);
    this.num_inodes = 50;

    function Inode() {
        this.num_direct = 2;
        this.num_indirect = 1;

        var directArray = new ArrayBuffer(this.num_direct);
        var indirectArray = new ArrayBuffer(this.num_indirect);

        this.direct = new Uint8Array(directArray);
        this.indirect = new Uint8Array(indirectArray);

        this.filesize = 0;
        this.permissions = 0;
        this.is_directory = false;
        this.num_links = 0;
    }
    // In reality the inodes should be part of the disk, but that's too much work to implement
    this.inodes = new Array(this.num_inodes);
    for (var i = 0; i < this.num_inodes; i++) {
        this.inodes[i] = new Inode();
    }

    // Create inode for "/"
    this.inodes[0].is_directory = true;
    this.inodes[0].num_links = 1;
    this.inodes[0].permissions = 0o755;

    this.max_filesize = (this.inodes[0].num_indirect * this.block_size + this.inodes[0].num_direct) * this.block_size;
}

function split_parent_of(child) {
    if (child == "/")
        return ["/", "/"];

    var parts = child.split("/")
    var parent_part = parts.slice(0,-1);
    if (parent_part == "")
        parent_part = "/";
    return [ parent_part, parts.slice(-1)[0] ];
}

MyFS.prototype.readdir = function (path) {
    path_arr = path.split('/');
    path_arr[0] = '/';
    path_arr = path_arr.filter((x) => x.length);

    var i = 0;
    var dir_contents = null;
    var inode = null;
    while (i < path_arr.length) {
        if (dir_contents == null) {
            inode = this.inodes[0];
            console.log("Reading root inode", i, path_arr);
        } else {
            console.log("Reading inode for non-root node");
            inode = null;
            for (var j = 0; j < dir_contents.length; j++) {
                if (dir_contents[j].filename == path_arr[i]) {
                    inode = this.inodes[dir_contents[j].inodenum];
                    break;
                }
            }

            if (inode == null) {
                return "ENOENT";
            } else if (!inode.is_directory) {
                return "ENOTDIR";
            }
        }

        dir_contents = [];
        var bytes_read = 0;
        while (bytes_read < inode.filesize) {
            var curr_block = Math.floor(bytes_read / this.block_size);
            var offset = bytes_read % this.block_size;

            var dirent = null;
            if (curr_block < inode.num_direct) {
                var disk_offset = inode.direct[curr_block] * this.block_size;
                var inodenum = new Uint8Array(this.disk, disk_offset, 1);
                var filename = new Uint8Array(this.disk, disk_offset + 1, this.dirent_size - 1);
                filename = String.fromCharCode.apply(null, filename).split("\u0000")[0];
                dir_contents.push({
                    inodenum: inodenum[0],
                    filename: filename,
                });
            }

            bytes_read += this.block_size;
        }
        i++;
    }

    return dir_contents;
};

MyFS.prototype.inode_of = function (file){
    if (file == "/")
        return 0;

    var split_filename = split_parent_of(file);
    var entries = this.readdir(split_filename[0]);
    for (var i = 0; i < entries.length; i++) {
        if (entires[i].filename == split_filename[1]) {
            return entries[i].inodenum;
        }
    }
    return "ENOENT";
};

MyFS.prototype.mount = not_implemented;

MyFS.prototype.get_new_block = function (block) {
    var found_block = -1;
    for (var i = 0; i < this.blockmap.length; i++) {
        if (!this.blockmap[i]) {
            found_block = i;
            break;
        }
    }

    if (found_block == -1)
        return "ENOSPC";

    this.blockmap[found_block] = true;
    return found_block;
};

MyFS.prototype.release_block = function (block) {
    this.blockmap[found_block] = false;
};

MyFS.prototype.create = function (filename, flags, mode) {
    if (mode == null)
        return "EINVAL";

    var split_filename = split_parent_of(filename);
    if (split_filename[1].length > (this.dirent_size - 1))
        return "EINVAL";

    var parent_inodenum = this.inode_of(split_filename[0]);
    if (typeof(parent_inodenum) === 'string')
        return "ENOENT";

    var parent_inode = this.inodes[parent_inodenum];
    if (!parent_inode.is_directory)
        return "ENOTDIR";

    if (parent_inode.filesize > (this.max_filesize - this.dirent_size))
        return "ENOSPC";

    var found_inode = -1;
    for (var i = 1; i < this.num_inodes; i++) {
        if (this.inodes[i].num_links == 0) {
            found_inode = i;
            break;
        }
    }
    if (found_inode == -1)
        return "ENOSPC";

    // time to append to the directory
    // We'll take advantage of the fact that dirent_size == block_size
    var new_block = this.get_new_block();
    if (typeof(new_block) === 'string')
        return new_block;

    var curr_block = Math.floor(parent_inode.filesize / this.block_size);
    console.log("Curr block", curr_block);
    if (curr_block < parent_inode.num_direct) {
        console.log("Appending to direct\n");
        parent_inode.direct[curr_block] = new_block;
    } else {
        console.log("Appending to indirect\n");
        curr_block -= parent_inode.num_direct;
        if (!curr_block) {
            var indirect_block = this.get_new_block();
            if (typeof(indrect_block) === 'string') {
                this.release_block(new_block);
                return indirect_block;
            }
            parent_inode.indirect_block[0] = indirect_block;
        }

        var disk_offset = inode.indirect[0] * this.block_size + curr_block;
        var curr_entry = new Uint8Array(this.disk, disk_offset, 1);
        curr_entry[0] = new_block;
    }

    var disk_offset = new_block * this.block_size;
    var dirent_inodenum = new Uint8Array(this.disk, disk_offset, 1);
    dirent_inodenum[0] = found_inode;
    var dirent_filename = new Uint8Array(this.disk, disk_offset + 1, this.dirent_size - 1);
    for(var i = 0; i < split_filename[1].length; i++)
        dirent_filename[i] = split_filename[1].charCodeAt(i);
    parent_inode.filesize += this.dirent_size;

    // Mark inode as used
    this.inodes[found_inode].num_links += 1;
    this.inodes[found_inode].permissions = mode;
    return found_inode;
};

MyFS.prototype.open = function (filename, flags, mode) {
    var inodenum = null;
    if ((flags & O_CREAT) && this.inode_of(filename) === 'ENOENT') {
        console.log("Creating");
        inodenum = this.create(filename, flags, mode);
        console.log(inodenum);
    }
};

MyFS.prototype.close = not_implemented;

MyFS.prototype.chmod = not_implemented;
MyFS.prototype.link = not_implemented;
MyFS.prototype.mkdir = not_implemented;
MyFS.prototype.read = not_implemented;

MyFS.prototype.stat = not_implemented;
MyFS.prototype.unlink = not_implemented;
MyFS.prototype.write = not_implemented;
