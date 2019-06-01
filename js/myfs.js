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

        this.atim = 0;
        this.mtim = 0;
        this.ctim = 0;
        // TODO implement sticky bits and user/group model
    }

    Inode.prototype.update_atim = function () {
        this.atim = Date.now();
    }
    Inode.prototype.update_mtim = function () {
        this.mtim = Date.now();
    }
    Inode.prototype.update_ctim = function () {
        this.ctim = Date.now();
    }

    // In reality the inodes should be part of the disk, but that's too much work to implement
    this._inodes = new Array(this.num_inodes);
    for (var i = 0; i < this.num_inodes; i++) {
        this._inodes[i] = new Inode();
    }

    // Create inode for "/"
    this._inodes[0].is_directory = true;
    this._inodes[0].num_links = 1;
    this._inodes[0].permissions = 0o755;

    this.max_filesize = (this._inodes[0].num_indirect * this.block_size + this._inodes[0].num_direct) * this.block_size;
    if (canvas) {
        this.animations = new FSAnimator(this, canvas);
    } else {
        this.animations = null;
    }
}
inherit(MyFS, DefaultFS);

MyFS.prototype.mount = not_implemented;

MyFS.prototype.readdir = async function (path) {
    path_arr = path.split('/');
    path_arr[0] = '/';
    path_arr = path_arr.filter((x) => x.length);

    var i = 0;
    var dir_contents = null;
    var inode = null;
    var inodenum = -1;
    var parent_inodenum = -1;
    while (i < path_arr.length) {
        if (dir_contents == null) {
            inodenum = 0;
            parent_inodenum = 0;
            inode = this._inodes[inodenum];
        } else {
            inode = null;
            // skip '.' and '..'
            for (var j = 2; j < dir_contents.length; j++) {
                if (dir_contents[j].filename == path_arr[i]) {
                    parent_inodenum = inodenum;
                    inodenum = dir_contents[j].inodenum;
                    inode = this._inodes[inodenum];
                    break;
                }
            }

            if (inode == null) {
                return "ENOENT";
            } else if (!inode.is_directory) {
                return "ENOTDIR";
            }
        }

        inode.update_atim();

        dir_contents = [
            new Dirent(inodenum, '.'),
            new Dirent(parent_inodenum, '..'),
        ];
        var bytes_read = 0;
        var filedes = new FileDescriptor(
            this, "", inodenum, inode, O_RDONLY | O_DIRECTORY);

        var buffer = new Uint8Array(new ArrayBuffer(this.block_size));
        while ((bytes_read = await this.read(filedes, buffer))) {
            var filename = new Uint8Array(buffer.buffer, 1, this.dirent_size - 1);
            filename = bytes_to_str(filename).split("\u0000")[0];
            dir_contents.push(new Dirent(buffer[0],  filename));
        }
        i++;
    }

    return dir_contents;
};

MyFS.prototype.inode_of = async function (file){
    if (file == "/")
        return 0;

    var split_filename = split_parent_of(file);
    var entries = await this.readdir(split_filename[0]);
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].filename == split_filename[1]) {
            return entries[i].inodenum;
        }
    }
    return "ENOENT";
};

MyFS.prototype.stat = async function(file) {
    var inodenum = await this.inode_of(file);
    if (typeof(inodenum) === 'string')
        return inodenum;
    var inode = this._inodes[inodenum];
    inode.update_atim();
    var info = new Stat(
        file,
        inodenum,
        inode.permissions,
        inode.is_directory,
        inode.filesize,
        inode.atim,
        inode.mtim,
        inode.ctim);
    return info;
};

// Undefined if the inode doesn't actually have n blocks.
MyFS.prototype.get_nth_blocknum_from_inode = async function(inode, n) {
    var block_num = 0;
    if (n < inode.num_direct) {
        block_num = inode.direct[n];
    } else {
        var indirect_index = n - inode.num_direct;
        var disk_offset = inode.indirect[0] * this.block_size + indirect_index;
        var indirect_entry = new Uint8Array(this.disk, disk_offset, 1);
        block_num = indirect_entry[0];

        if (this.animations)
            await this.animations.read_block(inode.indirect[0]);
    }

    return block_num;
}

MyFS.prototype.unlink = async function(path) {
    var inodenum = await this.inode_of(path);
    if (typeof(inodenum) == 'string')
        return inodenum;

    if (inodenum == 0)
        return "EPERM";

    inode = this._inodes[inodenum];

    inode.update_atim();
    inode.update_mtim();

    inode.num_links--;
    if (inode.num_links == 0) {
        await this.empty_inode(inodenum);
        if (this.animations)
            await this.animations.deregister_inode(inodenum);
    }

    var split_filename = split_parent_of(path);
    var parent_inodenum = await this.inode_of(split_filename[0]);
    var parent_inode = this._inodes[parent_inodenum];

    parent_inode.update_atim();
    parent_inode.update_mtim();

    // Find block number of dirent to be removed
    // This loop is gauranteed to find the inode since the case where the file
    // does not exist is handled in the inode_of call above.
    var currblock = 0;
    var num_blocks = Math.floor(parent_inode.filesize / this.dirent_size);
    while (currblock < num_blocks) {
        var block_num = await this.get_nth_blocknum_from_inode(parent_inode, currblock);
        var disk_offset = block_num * this.block_size;
        if (this.animations)
            await this.animations.read_block(block_num);

        var inode_of_dirent = new Uint8Array(this.disk, disk_offset, 1);
        if (inode_of_dirent[0] == inodenum)
            break;

        currblock++;
    }

    // Erase currblock
    var disk_offset = await this.get_nth_blocknum_from_inode(parent_inode, currblock) * this.block_size;
    var dirent_block = new Uint8Array(this.disk, disk_offset, this.dirent_size);
    dirent_block.fill(0);

    // Now we have to move all blocks after the current one back by 1 block
    var prevblock = currblock;
    currblock++;
    while (currblock < num_blocks) {
        var prevblock_num = await this.get_nth_blocknum_from_inode(parent_inode, prevblock);
        var currblock_num = await this.get_nth_blocknum_from_inode(parent_inode, currblock);

        var prevblock_offset = prevblock_num * this.block_size;
        var currblock_offset = currblock_num * this.block_size;

        var prevdirent = new Uint8Array(this.disk, prevblock_offset, this.dirent_size);
        var currdirent = new Uint8Array(this.disk, currblock_offset, this.dirent_size);

        if (this.animations) {
            await this.animations.read_block(currblock_num);
            await this.animations.read_block(prevblock_num);
        }


        for (var i = 0; i < this.dirent_size; i++)
            prevdirent[i] = currdirent[i];

        prevblock = currblock;
        currblock++;
    }

    // decrement size and remove last block
    var lastblock_num = await this.get_nth_blocknum_from_inode(parent_inode, num_blocks - 1);
    await this.release_block(lastblock_num);
    if ((num_blocks - 1) == parent_inode.num_direct)
        await this.release_block(parent_inode.indirect[0]);

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

MyFS.prototype.release_block = async function (block) {
    this.blockmap[block] = false;

    if (this.animations)
        await this.animations.deregister_block(block);
};

MyFS.prototype.append_block_to_inode = async function(inode) {
    var curr_block = Math.floor(inode.filesize / this.block_size);
    if ((inode.filesize % this.block_size) == 0)
        curr_block++;
    var new_blocks = await this.ensure_min_blockcount(inode, curr_block);
    if (typeof(new_blocks) === 'string')
        return new_blocks;

    return new_blocks[0];
}

MyFS.prototype.create = async function (filename, mode, inode) {
    if (typeof(await this.inode_of(filename)) != 'string')
        return "EEXISTS";

    if (mode == null)
        return "EINVAL";

    var split_filename = split_parent_of(filename);
    if (split_filename[1].length > (this.dirent_size - 1))
        return "EINVAL";

    var parent_inodenum = await this.inode_of(split_filename[0]);
    if (typeof(parent_inodenum) === 'string')
        return "ENOENT";

    var parent_inode = this._inodes[parent_inodenum];
    if (!parent_inode.is_directory)
        return "ENOTDIR";

    if (parent_inode.filesize > (this.max_filesize - this.dirent_size))
        return "ENOSPC";

    var found_inode = -1;
    // if inode is 0 or undefined then we need to grab a fresh inode
    if (!inode) {
        for (var i = 1; i < this.num_inodes; i++) {
            if (this._inodes[i].num_links == 0) {
                found_inode = i;
                break;
            }
        }
        if (found_inode == -1)
            return "ENOSPC: inode";

        if (this.animations)
            await this.animations.register_inode(found_inode);
    } else {
        found_inode = inode;
    }

    // time to append to the directory using write
    // TODO wrap around this with a function open_inode()
    var filedes = new FileDescriptor(
        this, "", parent_inodenum, parent_inode, O_WRONLY | O_APPEND | O_DIRECTORY);
    filedes.offset = filedes.inode.filesize;

    var dirent_str = "\u0000"; // space for the inodenum
    dirent_str += split_filename[1]; // filename
    dirent_str = dirent_str.padEnd(this.dirent_size, "\u0000"); // Add any necessary padding to meet the desired size.
    var dirent = str_to_bytes(dirent_str);
    var error = await this.write(filedes, dirent);

    if (typeof(error) == 'string')
        return error;

    return found_inode;
};

MyFS.prototype.truncate = async function (path, length) {
    var inodenum = await this.inode_of(path);
    if (typeof(inodenum) == 'string')
        return inodenum;

    var inode = this._inodes[inodenum];
    if (length > inode.filesize) {
        var file = await this.open(path, O_WRONLY | O_APPEND);
        if (typeof(file) === 'string')
            return file;

        console.log("got file");

        var zero_bytes = new Uint8Array(new ArrayBuffer(length - inode.filesize));
        zero_bytes.fill(0);
        console.log("Adding", zero_bytes.length, "bytes");
        return this.write(file, zero_bytes);
    } else if (length < inode.filesize) {
        while ((length - inode.filesize) > this.block_size) {
            var num_blocks = Math.floor(inode.filesize / this.dirent_size);
            var lastblock_num = await this.get_nth_blocknum_from_inode(inode, num_blocks - 1);
            await this.release_block(lastblock_num);
            if ((num_blocks - 1) == inode.num_direct)
                await this.release_block(inode.indirect[0]);
            inode.filesize -= this.block_size;
        }
        inode.filesize = length;
        inode.update_atim();
        inode.update_mtim();
    }

    return 0;
};

MyFS.prototype.empty_inode = async function (inodenum) {
    var had_indirect = false;
    var blocknum = 0;
    while (this._inodes[inodenum].filesize > 0) {
        if (blocknum < this._inodes[inodenum].num_direct) {
            await this.release_block(this._inodes[inodenum].direct[blocknum]);
        } else {
            had_indirect = true;
            var indirect_block = this._inodes[inodenum].indirect[0];

            var indirect_index = blocknum - this._inodes[inodenum].num_direct;
            var disk_offset = indirect_block * this.block_size + indirect_index;

            var indirect_entry = new Uint8Array(this.disk, disk_offset, 1);
            await this.release_block(indirect_entry[0]);
        }
        this._inodes[inodenum].filesize -= Math.min(this._inodes[inodenum].filesize, this.block_size);
        blocknum++;
    }

    if (had_indirect)
        await this.release_block(this._inodes[inodenum].indirect[0]);
}

MyFS.prototype.open = async function (filename, flags, mode) {
    // TODO check permissions
    var inodenum = null;
    if ((flags & O_CREAT) && (await this.inode_of(filename)) === 'ENOENT') {
        inodenum = await this.create(filename, mode);
    } else {
        inodenum = await this.inode_of(filename);
        if (typeof(inodenum) == 'string')
            return inodenum;
    }

    var inode = this._inodes[inodenum];
    inode.update_atim();
    // TODO check permissions (might not do this)
    if ((flags & O_TRUNC) && (flags & O_WRONLY)) {
        await this.empty_inode(inodenum);
        inode.filesize = 0;
    }

    if (flags & O_APPEND)
        flags |= O_WRONLY;

    var filedes = new FileDescriptor(
        this, filename, inodenum, inode, flags & O_RDWR);
    if (flags & O_APPEND)
        filedes.offset = filedes.inode.filesize;

    return filedes;
};

MyFS.prototype.close = (filedes) => {};

MyFS.prototype.chmod = async function(path, permissions) {
    var inodenum = await this.inode_of(path);
    if (typeof(inodenum) == 'string')
        return inodenum;
    var inode = this._inodes[inodenum];
    inode.permissions = permissions;
    inode.update_atim();
    inode.update_mtim();
    inode.update_ctim();

    return 0;
};

// hardlinks only
MyFS.prototype.link = async function(path1, path2) {
    var inodenum = await this.inode_of(path1);
    if (typeof(inodenum) == 'string')
        return inodenum;

    var inode = this._inodes[inodenum];
    // atim/mtim/ctim managed  by create
    return this.create(path2, this._inodes[inodenum].permissions, inodenum);
};

MyFS.prototype.mkdir = async function(name, mode) {
    var new_inode = await this.create(name, mode);
    if (typeof(new_inode) == 'string')
        return new_inode;

    this._inodes[new_inode].is_directory = true;
    return new_inode;
};

MyFS.prototype.ensure_min_blockcount = async function (inode, blockcount) {

    var inodenum = this._inodes.findIndex((x) => x == inode);

    var currblocks = Math.ceil(inode.filesize / this.block_size);

    var added_blocks = [];
    var blocks_to_add = blockcount - currblocks;
    if (blocks_to_add <= 0)
        return added_blocks;

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
            var new_block = this.get_new_block();
            inode.direct[currblocks] = new_block;
            added_blocks.push(new_block);
            if (this.animations)
                await this.animations.register_block_to_inode(inodenum, new_block);

        } else {
            if (!initialized_indirect) {
                inode.indirect[0] = this.get_new_block();
                if (this.animations)
                    await this.animations.register_block_to_inode(inodenum, inode.indirect[0]);
                initialized_indirect = true;
            }

            var indirect_index = currblocks - inode.num_direct;
            var disk_offset = inode.indirect[0] * this.block_size + indirect_index;
            var curr_entry = new Uint8Array(this.disk, disk_offset, 1);
            if (this.animations)
                await this.animations.read_block(inode.indirect[0]);

            curr_entry[0] = this.get_new_block();
            added_blocks.push(curr_entry[0]);
            if (this.animations)
                await this.animations.register_block_to_inode(inodenum, curr_entry[0]);
        }

        currblocks++;
        blocks_to_add--;
    }

    return added_blocks;
};

MyFS.prototype.read_or_write = async function (filedes, buffer, is_read) {
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
        if (final_filesize > this.max_filesize)
            return "ENOSPC";

        var success = await this.ensure_min_blockcount(filedes.inode, Math.ceil(final_filesize / this.block_size));
        if (typeof(success) === 'string')
            return success;
    } else {
        if (filedes.offset >= filedes.inode.filesize)
            return 0;
        total_bytes = Math.min(filedes.inode.filesize - filedes.offset, total_bytes);
    }


    var currblock = Math.floor(filedes.offset / this.block_size);
    var blockoffset = filedes.offset % this.block_size;
    var bytes_written = 0;
    if (blockoffset) {
        var block = await this.get_nth_blocknum_from_inode(filedes.inode, currblock);
        var bytes_to_process = Math.min(this.block_size - blockoffset, total_bytes);
        var disk_offset = block * this.block_size + blockoffset;
        var target = new Uint8Array(this.disk, disk_offset, bytes_to_process);
        if (this.animations)
            await this.animations.read_block(block);

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

    while (total_bytes) {
        var block = await this.get_nth_blocknum_from_inode(filedes.inode, currblock);
        var bytes_to_process = Math.min(this.block_size, total_bytes);
        var disk_offset = block * this.block_size;
        var target = new Uint8Array(this.disk, disk_offset, bytes_to_process);
        if (this.animations)
            await this.animations.read_block(block);

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

    filedes.inode.update_atim();
    if (!is_read)
        filedes.inode.update_mtim();

    return bytes_written;
};

MyFS.prototype.write = async function (filedes, buffer) {
    return this.read_or_write(filedes, buffer, false);
};

MyFS.prototype.read = async function (filedes, buffer) {
    return this.read_or_write(filedes, buffer, true);
};

MyFS.prototype.ioctl = async function (filedes, request, obj) {
    filedes.inode.update_atim();
    if (request != IOCTL_SELECT_INODE)
        return "EIMPL";

    if (this.animations)
        this.animations.select_inode(filedes.inodenum, filedes.inode);

    return 0;
};
