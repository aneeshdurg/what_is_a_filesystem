describe("Test MyFS", function() {
    async function imports() {
        await _import({
            src: '/__src__/js/myfs.mjs',
            name: ['MyFS', 'IOCTL_DEFRAG']});

        await _import({
            src: '/__src__/js/defs.mjs',
            name: ['CONSTANTS', 'IOCTL_SELECT_INODE', 'IOCTL_IS_TTY']});

        await _import({
            src: '/__src__/js/fs_helper.mjs',
            name: ['bytes_to_str', 'str_to_bytes']});
    }

    beforeAll((done) => {
        imports().then(done);
    });


    it("test_readdir", async function () {
        var fs = new MyFS();
        expect((await fs.readdir("/")).length).toBe(2);

        await fs.open("/asdf", CONSTANTS.O_CREAT, 0o777);
        expect((await fs.readdir("/")).length).toBe(3);
    });

    it("test_write", async function (){
        const expected = 'This is a string of length 32...';
        expect(expected.length).toBe(32);

        const ABS_FILENAME = "/asdf";
        const REL_FILENAME = "asdf";

        fs = new MyFS();
        var file = await fs.open(ABS_FILENAME, CONSTANTS.O_CREAT, 0o777);
        expect(typeof(file)).not.toBe('string');

        var dir_contents = await fs.readdir("/");
        expect(dir_contents.pop().filename).toBe(REL_FILENAME);

        file = await fs.open(ABS_FILENAME, CONSTANTS.O_WRONLY);
        expect(typeof(file)).not.toBe('string');

        var data = str_to_bytes(expected);
        var bytes_written = await fs.write(file, data);
        expect(bytes_written).toBe(32);

        await fs.close(file);

        file = await fs.open("/asdf", CONSTANTS.O_RDONLY);
        expect(typeof(file)).not.toBe('string');

        var buffer = new ArrayBuffer(32);
        var output = new Uint8Array(buffer);
        var bytes_read = await fs.read(file, output);
        expect(bytes_read).toBe(output.length);

        await fs.close(file);
        expect(bytes_to_str(output)).toBe(expected);
    });

    it("test_write_max", async function (){
        const ABS_FILENAME = "/asdf";
        const REL_FILENAME = "asdf";

        fs = new MyFS();

        // set up expected data
        var expected_data = [];
        for (var i = 0; i < fs.max_filesize; i++) {
            expected_data.push(Math.round(Math.random() * 256));
        }
        expected_data = new Uint8Array(expected_data);

        var file = await fs.open(ABS_FILENAME, CONSTANTS.O_CREAT, 0o777);
        expect(typeof(file)).not.toBe('string');

        var dir_contents = await fs.readdir("/");
        expect(dir_contents.pop().filename).toBe(REL_FILENAME);

        file = await fs.open(ABS_FILENAME, CONSTANTS.O_WRONLY);
        expect(typeof(file)).not.toBe('string');

        var bytes_written = await fs.write(file, expected_data);
        expect(bytes_written).toBe(expected_data.length);

        await fs.close(file);

        file = await fs.open("/asdf", CONSTANTS.O_RDONLY);
        expect(typeof(file)).not.toBe('string');

        var buffer = new ArrayBuffer(fs.max_filesize);
        var output = new Uint8Array(buffer);
        var bytes_read = await fs.read(file, output);
        expect(bytes_read).toBe(output.length);

        await fs.close(file);
        expect(output).toEqual(expected_data);
    });

    it("test_mkdir", async function () {
        fs = new MyFS();
        var error = await fs.mkdir("/newdir", 0o777);
        expect(typeof(error)).not.toBe('string');

        var file = await fs.open("/newdir/newfile", CONSTANTS.O_CREAT, 0o777);
        expect(typeof(file)).not.toBe('string');

        var root_contents = await fs.readdir("/");
        expect(root_contents.length).toBe(3);
        expect(root_contents.pop().filename).toBe("newdir");

        var newdir_contents = await fs.readdir("/newdir");
        expect(newdir_contents.length).toBe(3);
        expect(newdir_contents.pop().filename).toBe("newfile");
    });

    async function test_link() {
        fs = new MyFS();
        var file1 = await fs.open("/newfile", CONSTANTS.O_CREAT, 0o777);
        var inode2 = await fs.link("/newfile", "/newfile1");

        expect((await fs.readdir("/")).length).toBe(4);
        expect(file1.inode).toBe(fs._inodes[inode2]);
        expect(typeof(i1)).not.toBe('string');

        return fs;
    }
    it("test_link", test_link);

    it("test_unlink", async function () {
        // Depends on test_link
        fs = await test_link();
        await fs.unlink("/newfile");
        dirs = await fs.readdir("/");

        expect(dirs.length).toBe(3);
        expect(dirs[2].filename).toBe("newfile1");

        await fs.unlink("/newfile1");
        dirs = await fs.readdir("/");

        expect(dirs.length).toBe(2);
    });

    it("test_create", async function () {
        fs = new MyFS();
        await fs.create("/newfile", 0o777);
        var contents = await fs.readdir("/");

        expect(contents.length).toBe(3);
        expect(contents[2].inodenum).toBe(1);
        expect(contents[2].filename).toBe("newfile");
    });

    it("test_stat", async function () {
        var fs = new MyFS();
        var info = await fs.stat("/");

        expect(info.path).toBe("/");
        expect(info.inodenum).toBe(0);
        expect(info.mode).toBe(0o755);
        expect(info.is_directory).toBe(true);
        expect(info.filesize).toBe(0);

        expect(info.atim).not.toBe(0);
        expect(info.mtim).not.toBe(0);
        expect(info.ctim).not.toBe(0);
    });

    it("test_truncate", async function () {
        var fs = new MyFS();
        var info = null;
        await fs.create("/newfile", 0o777);

        async function trunc_and_check(size) {
            var error = await fs.truncate("/newfile", size);
            info = await fs.stat("/newfile");
            expect(info.filesize).toBe(size);
        }

        await trunc_and_check(fs.block_size);
        await trunc_and_check(fs.max_filesize);
        await trunc_and_check(fs.block_size);
    });

    it("test_chmod", async function () {
        var fs = new MyFS();
        await fs.create("/newfile", 0o777);
        await fs.chmod("/newfile", 0o444);
        var info = await fs.stat("/newfile");

        expect(info.mode).toBe(0o444);
    });

    it("test_ioctl", async function () {
        var fs = new MyFS();
        var fd = await fs.open("/", CONSTANTS.O_RDONLY);

        expect(typeof(await fs.ioctl(fd, IOCTL_SELECT_INODE))).not.toBe('string');
        expect(typeof(await fs.ioctl(fd, IOCTL_IS_TTY))).toBe('string');
    });

    it("test_seek", async function () {
        var expected_str = "Hello data!";
        var wrong_str = "Jello data!";

        var fs = new MyFS();
        await fs.create("/newfile", 0o777);
        var fd = await fs.open("/newfile", CONSTANTS.O_RDWR);
        await fs.write(fd, str_to_bytes(wrong_str));
        await fs.seek(fd, 0, CONSTANTS.SEEK_SET);
        await fs.write(fd, str_to_bytes("H"));
        await fs.seek(fd, 0, CONSTANTS.SEEK_SET);
        var data = new Uint8Array(new ArrayBuffer(expected_str.length));
        await fs.read(fd, data);

        expect(bytes_to_str(data)).toBe(expected_str);
    });

    it("tests defragmentation", async function() {
        var fs = new MyFS();
        async function create(name) {
            await fs.create(name, 0o777);
            return await fs.open(name, CONSTANTS.O_RDWR);
        }

        var root = await fs.open("/", CONSTANTS.O_RDONLY);

        var f1 = await create("/1");
        var f2 = await create("/2");
        var f3 = await create("/3");
        for (var i = 0; i < 10; i++) {
            await fs.write(f1, (new Uint8Array(16)).fill(1));
            await fs.write(f2, (new Uint8Array(16)).fill(2));
            await fs.write(f3, (new Uint8Array(16)).fill(3));
        }

        async function reset_fds() {
            await fs.seek(root, 0, CONSTANTS.SEEK_SET);
            await fs.seek(f1, 0, CONSTANTS.SEEK_SET);
            await fs.seek(f2, 0, CONSTANTS.SEEK_SET);
            await fs.seek(f3, 0, CONSTANTS.SEEK_SET);
        }

        var buffer = new Uint8Array(10 * 16);
        async function verify_files() {
            await reset_fds();

            buffer.fill(0);
            var bytes_read = await fs.read(f1, buffer);
            expect(bytes_read).toBe(10 * 16);
            for (var c of buffer)
                expect(c).toBe(1);

            buffer.fill(0);
            var bytes_read = await fs.read(f2, buffer);
            expect(bytes_read).toBe(10 * 16);
            for (var c of buffer)
                expect(c).toBe(2);

            buffer.fill(0);
            var bytes_read = await fs.read(f3, buffer);
            expect(bytes_read).toBe(10 * 16);
            for (var c of buffer)
                expect(c).toBe(3);
        }


        await verify_files();

        console.log(root.inode.direct[0], root.inode.direct[1], root.inode.indirect[0]);
        console.log(f1.inode.direct[0], f1.inode.direct[1], f1.inode.indirect[0]);
        console.log(f2.inode.direct[0], f2.inode.direct[1], f2.inode.indirect[0]);
        console.log(f3.inode.direct[0], f3.inode.direct[1], f3.inode.indirect[0]);
        async function idk(fd) {
            console.log("---");
            for (var i = 0; i < 10; i++) {
                console.log(await fs.get_nth_blocknum_from_inode(fd.inode, i));
            }
        }
        await idk(f1);
        await idk(f2);
        await idk(f3);

        await fs.ioctl(null, IOCTL_DEFRAG);

        console.log(root.inode.direct);
        console.log(f1.inode.direct);
        console.log(f2.inode.direct);
        console.log(f3.inode.direct);

        await verify_files();
        await idk(f1);
        await idk(f2);
        await idk(f3);
    });
})
