describe("Test MyFS", function() {

    it("test_readdir", async function () {
        var fs = new MyFS();
        expect((await fs.readdir("/")).length).toBe(2);

        await fs.open("/asdf", O_CREAT, 0o777);
        expect((await fs.readdir("/")).length).toBe(3);
    });

    it("test_write", async function (){
        const expected = 'This is a string of length 32...';
        expect(expected.length).toBe(32);

        const ABS_FILENAME = "/asdf";
        const REL_FILENAME = "asdf";

        fs = new MyFS();
        var file = await fs.open(ABS_FILENAME, O_CREAT, 0o777);
        expect(typeof(file)).not.toBe('string');

        var dir_contents = await fs.readdir("/");
        expect(dir_contents.pop().filename).toBe(REL_FILENAME);

        file = await fs.open(ABS_FILENAME, O_WRONLY);
        expect(typeof(file)).not.toBe('string');

        var data = str_to_bytes(expected);
        var bytes_written = await fs.write(file, data);
        expect(bytes_written).toBe(32);

        await fs.close(file);

        file = await fs.open("/asdf", O_RDONLY);
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

        var file = await fs.open(ABS_FILENAME, O_CREAT, 0o777);
        expect(typeof(file)).not.toBe('string');

        var dir_contents = await fs.readdir("/");
        expect(dir_contents.pop().filename).toBe(REL_FILENAME);

        file = await fs.open(ABS_FILENAME, O_WRONLY);
        expect(typeof(file)).not.toBe('string');

        var bytes_written = await fs.write(file, expected_data);
        expect(bytes_written).toBe(expected_data.length);

        await fs.close(file);

        file = await fs.open("/asdf", O_RDONLY);
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

        var file = await fs.open("/newdir/newfile", O_CREAT, 0o777);
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
        var file1 = await fs.open("/newfile", O_CREAT, 0o777);
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
        var fd = await fs.open("/", O_RDONLY);

        expect(typeof(await fs.ioctl(fd, IOCTL_SELECT_INODE))).not.toBe('string');
        expect(typeof(await fs.ioctl(fd, IOCTL_IS_TTY))).toBe('string');
    });

    it("test_seek", async function () {
        var expected_str = "Hello data!";
        var wrong_str = "Jello data!";

        var fs = new MyFS();
        await fs.create("/newfile", 0o777);
        var fd = await fs.open("/newfile", O_RDWR);
        await fs.write(fd, str_to_bytes(wrong_str));
        await fs.seek(fd, 0, SEEK_SET);
        await fs.write(fd, str_to_bytes("H"));
        await fs.seek(fd, 0, SEEK_SET);
        var data = new Uint8Array(new ArrayBuffer(expected_str.length));
        await fs.read(fd, data);

        expect(bytes_to_str(data)).toBe(expected_str);
    });
})
