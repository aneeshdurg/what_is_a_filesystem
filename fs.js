
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

function __gen_LayeredFilesystem_callback_2_file(name) {
    eval("LayeredFilesystem.prototype." + name + "= function (file, arg2) {" +
        "  return file.fs." + name + "(file, arg2);" +
        "};");
}

function __gen_LayeredFilesystem_callback_2_resolve_1(name) {
    eval("LayeredFilesystem.prototype." + name + "= function (path, arg2) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  return resolved.fs." + name + "(resolved.relpath, arg2);" +
        "};");
}

function __gen_LayeredFilesystem_callback_2_resolve_2(name) {
    eval("LayeredFilesystem.prototype." + name + "= function (path, path2) {" +
        "  var resolved = this.resolve_fs_and_path(path);" +
        "  var resolved2 = this.resolve_fs_and_path(path2);" +
        "  if (typeof(resolved) === 'string') return resolved;" +
        "  if (typeof(resolved2) === 'string') return resolved2;" +
        "  if (resolved.fs != resolved2.fs) return 'EINVAL';" +
        "  return resolved.fs." + name + "(resolved.relpath, resolved2.relpath);" +
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

__gen_LayeredFilesystem_callback_2_file("read");
__gen_LayeredFilesystem_callback_2_file("write");

__gen_LayeredFilesystem_callback_2_resolve_1("chmod");
__gen_LayeredFilesystem_callback_2_resolve_2("link");

__gen_LayeredFilesystem_callback_3("open");

// Paths cannot have trailing / or // anywhere
// max filename length = 15
function MyFS(canvas) {
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
    if (canvas) {
        this.animations = new FSAnimator(this, canvas);
    } else {
        this.animations = null;
    }


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
            if (this.animations)
                this.animations.select_inode(0);
        } else {
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
            if (this.animations)
                this.animations.select_inode(inode);
        }

        dir_contents = [];
        var bytes_read = 0;
        while (bytes_read < inode.filesize) {
            var curr_block = Math.floor(bytes_read / this.block_size);
            var offset = bytes_read % this.block_size;

            var dirent = null;
            var block_num = this.get_nth_blocknum_from_inode(inode, curr_block);
            var disk_offset = block_num * this.block_size;
            var inodenum = new Uint8Array(this.disk, disk_offset, 1);
            var filename = new Uint8Array(this.disk, disk_offset + 1, this.dirent_size - 1);
            filename = String.fromCharCode.apply(null, filename).split("\u0000")[0];
            dir_contents.push({
                inodenum: inodenum[0],
                filename: filename,
            });

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
    console.log(file, split_filename, split_filename[0]);
    var entries = this.readdir(split_filename[0]);
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].filename == split_filename[1]) {
            return entries[i].inodenum;
        }
    }
    return "ENOENT";
};

MyFS.prototype.mount = not_implemented;
MyFS.prototype.stat = not_implemented;

// Undefined if the inode doesn't actually have n blocks.
MyFS.prototype.get_nth_blocknum_from_inode = function(inode, n) {
    var block_num = 0;
    if (n < inode.num_direct) {
        block_num = inode.direct[n];
    } else {
        var indirect_index = n - inode.num_direct;
        var disk_offset = inode.indirect[0] * this.block_size + indirect_index;
        var indirect_entry = new Uint8Array(this.disk, disk_offset, 1);
        block_num = indirect_entry[0];

        if (this.animations)
            this.animations.read_block(inode.indirect[0]);
    }

    return block_num;
}

MyFS.prototype.unlink = function(path) {
    var inodenum = this.inode_of(path);
    if (typeof(inodenum) == 'string')
        return inodenum;

    if (inodenum == 0)
        return "EPERM";

    inode = this.inodes[inodenum];
    if (this.animations)
        this.animations.select_inode(inode);

    inode.num_links--;
    if (inode.num_links == 0) {
        this.empty_inode(inodenum);
        if (this.animations)
            this.animations.deregister_inode(inodenum);
    }

    var split_filename = split_parent_of(path);
    var parent_inodenum = this.inode_of(split_filename[0]);
    var parent_inode = this.inodes[parent_inodenum];
    if (this.animations)
        this.animations.select_inode(parent_inodenum);

    // Find block number of dirent to be removed
    // This loop is gauranteed to find the inode since the case where the file
    // does not exist is handled in the inode_of call above.
    var currblock = 0;
    var num_blocks = Math.floor(parent_inode.filesize / this.dirent_size);
    while (currblock < num_blocks) {
        var block_num = this.get_nth_blocknum_from_inode(parent_inode, currblock);
        var disk_offset = block_num * this.block_size;
        if (this.animations)
            this.animations.read_block(block_num);

        var inode_of_dirent = new Uint8Array(this.disk, disk_offset, 1);
        if (inode_of_dirent[0] == inodenum)
            break;

        currblock++;
    }

    // Erase currblock
    var disk_offset = this.get_nth_blocknum_from_inode(parent_inode, currblock) * this.block_size;
    var dirent_block = new Uint8Array(this.disk, disk_offset, this.dirent_size);
    dirent_block.fill(0);

    // Now we have to move all blocks after the current one back by 1 block
    var prevblock = currblock;
    currblock++;
    while (currblock < num_blocks) {
        var prevblock_num = this.get_nth_blocknum_from_inode(parent_inode, prevblock);
        var currblock_num = this.get_nth_blocknum_from_inode(parent_inode, currblock);

        var prevblock_offset = prevblock_num * this.block_size;
        var currblock_offset = currblock_num * this.block_size;

        var prevdirent = new Uint8Array(this.disk, prevblock_offset, this.dirent_size);
        var currdirent = new Uint8Array(this.disk, currblock_offset, this.dirent_size);

        if (this.animations) {
            this.animations.read_block(currblock_num);
            this.animations.read_block(prevblock_num);
        }


        for (var i = 0; i < this.dirent_size; i++)
            prevdirent[i] = currdirent[i];

        prevblock = currblock;
        currblock++;
    }

    // decrement size and remove last block
    var lastblock_num = this.get_nth_blocknum_from_inode(parent_inode, num_blocks - 1);
    this.release_block(lastblock_num);
    if ((num_blocks - 1) < parent_inode.num_direct)
        this.release_block(parent_inode.indirect[0]);

    parent_inode.filesize -= this.block_size;
    return 0;
};

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
    this.blockmap[block] = false;

    if (this.animations)
        this.animations.deregister_block(block);
};

MyFS.prototype.create = function (filename, mode, inode) {
    if (typeof(this.inode_of(filename)) != 'string')
        return "EEXISTS";

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
    // if inode is 0 or undefined then we need to grab a fresh inode
    if (!inode) {
        for (var i = 1; i < this.num_inodes; i++) {
            if (this.inodes[i].num_links == 0) {
                found_inode = i;
                break;
            }
        }
        if (found_inode == -1)
            return "ENOSPC: inode";

        if (this.animations)
            this.animations.register_inode(found_inode);
    } else {
        found_inode = inode;
    }

    if (this.animations)
        this.animations.select_inode(inode);

    // time to append to the directory
    // We'll take advantage of the fact that dirent_size == block_size
    var new_block = this.get_new_block();
    if (typeof(new_block) === 'string')
        return new_block;

    // we know that curr_block isn't on the inode by our assumption
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
            if (this.animations)
                this.animations.register_block_to_inode(parent_inodenum, indirect_block);

            parent_inode.indirect[0] = indirect_block;
        }

        if (this.animations)
            this.animations.read_block(parent_inode.indirect[0]);

        var disk_offset = parent_inode.indirect[0] * this.block_size + curr_block;
        var curr_entry = new Uint8Array(this.disk, disk_offset, 1);
        curr_entry[0] = new_block;
    }
    if (this.animations)
        this.animations.register_block_to_inode(parent_inodenum, new_block);

    var disk_offset = new_block * this.block_size;

    var dirent_inodenum = new Uint8Array(this.disk, disk_offset, 1);
    dirent_inodenum[0] = found_inode;

    var dirent_filename = new Uint8Array(this.disk, disk_offset + 1, this.dirent_size - 1);
    for(var i = 0; i < split_filename[1].length; i++)
        dirent_filename[i] = split_filename[1].charCodeAt(i);
    for(var i = split_filename[1].length; i < (this.dirent_size - 1); i++)
        dirent_filename[i] = 0;

    parent_inode.filesize += this.dirent_size;

    // Mark inode as used
    this.inodes[found_inode].num_links += 1;
    this.inodes[found_inode].permissions = mode;
    return found_inode;
};

MyFS.prototype.empty_inode = function (inodenum) {
    console.log("Invoked empty_inode");
    var had_indirect = false;
    var blocknum = 0;
    while (this.inodes[inodenum].filesize > 0) {
        if (blocknum < this.inodes[inodenum].num_direct) {
            this.release_block(this.inodes[inodenum].direct[blocknum]);
        } else {
            had_indirect = true;
            var indirect_block = this.inodes[inodenum].indirect[0];

            var indirect_index = blocknum - this.inodes[inodenum].num_direct;
            var disk_offset = indirect_block * this.block_size + indirect_index;

            var indirect_entry = new Uint8Array(this.disk, disk_offset, 1);
            this.release_block(indirect_entry[0]);
        }
        this.inodes[inodenum].filesize -= Math.min(this.inodes[inodenum].filesize, this.block_size);
        blocknum++;
    }

    if (had_indirect)
        this.release_block(this.inodes[inodenum].indirect[0]);

    console.log("Finished empty_inode");
}

MyFS.prototype.open = function (filename, flags, mode) {
    var inodenum = null;
    if ((flags & O_CREAT) && this.inode_of(filename) === 'ENOENT') {
        console.log("Creating");
        inodenum = this.create(filename, mode);
        console.log(inodenum);
    } else {
        inodenum = this.inode_of(filename);
        if (typeof(inodenum) == 'string')
            return inodenum;
    }

    // TODO check permissions (might not do this)
    if ((flags & O_TRUNC) && (flags & O_WRONLY))
        this.empty_inode(inodenum);

    if (flags & O_APPEND)
        flags |= O_WRONLY;

    var filedes = new FileDescriptor(this, filename, this.inodes[inodenum], flags & O_RDWR);
    if (flags & O_APPEND)
        filedes.offset = filedes.inode.filesize;

    return filedes;
};

MyFS.prototype.close = (filedes) => {};

MyFS.prototype.chmod = function(path, permissions) {
    var inodenum = this.inode_of(path);
    if (typeof(inodenum) == 'string')
        return inodenum;
    this.inodes[inodenum].permissions = permissions;

    if (this.animations)
        this.animations.select_inode(inodenum);
    return 0;
};

// hardlinks only
MyFS.prototype.link = function(path1, path2) {
    var inodenum = this.inode_of(path1);
    if (typeof(inodenum) == 'string')
        return inodenum;

    if (this.animations)
        this.animations.select_inode(inodenum);

    return this.create(path2, this.inodes[inodenum].permissions, inodenum);
};

MyFS.prototype.mkdir = function(name, mode) {
    var new_inode = this.create(name, mode);
    if (typeof(new_inode) == 'string')
        return new_inode;

    this.inodes[new_inode].is_directory = true;
    return new_inode;
};

MyFS.prototype.ensure_min_blockcount = function (inode, blockcount) {

    var inodenum = this.inodes.findIndex((x) => x == inode);

    console.log("invoked ensure_min_blockcount", inode);
    var currblocks = Math.ceil(inode.filesize / this.block_size);

    var blocks_to_add = blockcount - currblocks;
    if (blocks_to_add <= 0)
        return 0;

    var needs_indirect = false;
    var total_disk_blocks_needed = blocks_to_add;
    // increment if we're also adding an indrect block
    if (currblocks == inode.num_direct) {
        needs_indirect = true;
        total_disk_blocks_needed++;
    }

    var free_blocks = this.blockmap.map((x) => !x).reduce((x, y) => x + y);
    if (total_disk_blocks_needed > free_blocks)
        return "ENOSPC";

    var initialized_indirect = (currblocks > inode.num_direct);
    while (blocks_to_add) {
        if (currblocks < inode.num_direct) {
            inode.direct[currblocks] = this.get_new_block();
            if (this.animations)
                this.animations.register_block_to_inode(inodenum, inode.direct[currblocks]);

        } else {
            if (!initialized_indirect) {
                inode.indirect[0] = this.get_new_block();
                if (this.animations)
                    this.animations.register_block_to_inode(inodenum, inode.indirect[0]);
                initialized_indirect = true;
            }

            var indirect_index = currblocks - inode.num_direct;
            var disk_offset = inode.indirect[0] * this.block_size + indirect_index;
            var curr_entry = new Uint8Array(this.disk, disk_offset, 1);
            if (this.animations)
                this.animations.read_block(inode.indirect[0]);

            curr_entry[0] = this.get_new_block();
            if (this.animations)
                this.animations.register_block_to_inode(inodenum, curr_entry[0]);
        }

        currblocks++;
        blocks_to_add--;
    }

    return 0;
};

MyFS.prototype.read_or_write = function (filedes, buffer, is_read) {
    console.log("invoked read_or_write");
    if (buffer.BYTES_PER_ELEMENT != 1)
        return "EINVAL";

    if (is_read && !(filedes.mode & O_RDONLY))
        return "EBADF";
    else if (!is_read && !(filedes.mode & O_WRONLY))
        return "EBADF"

    var total_bytes = buffer.length;
    var final_filesize = null;
    if (!is_read) {
        final_filesize = Math.max(filedes.inode.filesize, total_bytes + filedes.offset);
        console.log("Final filesize will be", final_filesize, total_bytes, filedes.offset);
        if (final_filesize > this.max_filesize)
            return "ENOSPC";

        var success = this.ensure_min_blockcount(filedes.inode, Math.ceil(final_filesize / this.block_size));
        if (typeof(success) === 'string')
            return success;
    } else {
        if (filedes.offset >= filedes.inode.filesize)
            return 0;
        total_bytes = Math.min(filedes.inode.filesize - filedes.offset, total_bytes);
    }
    console.log("finished setup");


    var currblock = Math.floor(filedes.offset / this.block_size);
    var blockoffset = filedes.offset % this.block_size;
    var bytes_written = 0;
    if (blockoffset) {
        var block = this.get_nth_blocknum_from_inode(filedes.inode, currblock);
        var bytes_to_process = Math.min(this.block_size - blockoffset, total_bytes);
        var disk_offset = block * this.block_size + blockoffset;
        var target = new Uint8Array(this.disk, disk_offset, bytes_to_process);
        if (this.animations)
            this.animations.read_block(block);

        for (var i = 0; i < bytes_to_process; i++) {
            if (is_read)
                buffer[i + bytes_written] = target[i];
            else
                target[i] = buffer[i + bytes_written];
        }

        bytes_written += bytes_to_process;
        total_bytes -= bytes_to_process;
        currblock++;
    }
    console.log("copied remainder");

    while (total_bytes) {
        console.log("copying block", currblock);
        var block = this.get_nth_blocknum_from_inode(filedes.inode, currblock);
        var bytes_to_process = Math.min(this.block_size, total_bytes);
        var disk_offset = block * this.block_size;
        var target = new Uint8Array(this.disk, disk_offset, bytes_to_process);
        if (this.animations)
            this.animations.read_block(block);

        for (var i = 0; i < bytes_to_process; i++) {
            if (is_read)
                buffer[i + bytes_written] = target[i];
            else
                target[i] = buffer[i + bytes_written];
        }

        bytes_written += bytes_to_process;
        total_bytes -= bytes_to_process;
        currblock++;
    }

    filedes.offset += bytes_written;
    if (!is_read)
        filedes.inode.filesize = final_filesize;

    return bytes_written;
};

MyFS.prototype.write = function (filedes, buffer) {
    return this.read_or_write(filedes, buffer, false);
};

MyFS.prototype.read = function (filedes, buffer) {
    return this.read_or_write(filedes, buffer, true);
};
