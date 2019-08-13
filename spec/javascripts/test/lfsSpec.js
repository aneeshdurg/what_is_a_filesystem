describe("Test LFS", function() {
    async function imports() {
        await _import({
            src: '/__src__/js/defs.mjs',
            name: ['CONSTANTS', 'FileDescriptor']});

        await _import({
            src: '/__src__/js/lfs.mjs',
            name: 'LayeredFilesystem'});

        await _import({
            src: '/__src__/js/testfs.mjs',
            name: 'TestFS'});

        await _import({
            src: '/__src__/js/myfs.mjs',
            name: 'MyFS'});
    }

    beforeAll((done) => {
        imports().then(done);
    });

    it("test_layered_fns", async function () {
        console.log(TestFS);
        var testfs = new TestFS();
        var lfs = new LayeredFilesystem();
        await lfs.mkdir("/test", 0o755);
        await lfs.mount("/test", testfs);

        lfs.readdir("/test");
        expect(Boolean(testfs.readdir_called)).toBe(true);
        expect(testfs.readdir_called[0]).toBe("/");

        lfs.stat("/test/newfile");
        expect(Boolean(testfs.stat_called)).toBe(true);
        expect(testfs.stat_called[0]).toBe("/newfile");

        lfs.unlink("/test/newfile");
        expect(Boolean(testfs.unlink_called)).toBe(true)
        expect(testfs.unlink_called[0]).toBe("/newfile");

        lfs.create("/test/newfile", 0);
        expect(Boolean(testfs.create_called)).toBe(true);
        expect(testfs.create_called[0]).toBe("/newfile");
        expect(testfs.create_called[1]).toBe(0);

        lfs.truncate("/test/newfile", 0);
        expect(Boolean(testfs.truncate_called)).toBe(true)
        expect(testfs.truncate_called[0]).toBe("/newfile");

        lfs.chmod("/test", 0o777);
        expect(Boolean(testfs.chmod_called));
        expect(testfs.chmod_called[0]).toBe("/");
        expect(testfs.chmod_called[1]).toBe(0o777);

        lfs.link("/test/newfile", "/test/newfile1");
        expect(Boolean(testfs.link_called)).toBe(true);
        expect(testfs.link_called[0]).toBe("/newfile");
        expect(testfs.link_called[1]).toBe("/newfile1");

        lfs.mkdir("/test/newdir")
        expect(Boolean(testfs.mkdir_called)).toBe(true)
        expect(testfs.mkdir_called[0]).toBe("/newdir");

        lfs.open("/test", CONSTANTS.O_RDONLY);
        expect(Boolean(testfs.open_called)).toBe(true);
        expect(testfs.open_called[0]).toBe("/");

        var fd = new FileDescriptor(testfs, "", 0, null, 0);
        lfs.ioctl(fd, 0, null);
        expect(Boolean(testfs.ioctl_called)).toBe(true);
        expect(testfs.ioctl_called[0]).toBe(fd);
        expect(testfs.ioctl_called[1]).toBe(0);
        expect(testfs.ioctl_called[2]).toBe(null);


        lfs.close(fd);
        expect(Boolean(testfs.close_called)).toBe(true);
        expect(testfs.close_called[0]).toBe(fd);

        var data = new Uint8Array([1, 2, 3, 4, 5]);
        lfs.write(fd, data);
        expect(Boolean(testfs.write_called)).toBe(true);
        expect(testfs.write_called[0]).toBe(fd);
        expect(testfs.write_called[1]).toBe(data);

        lfs.read(fd, data);
        expect(Boolean(testfs.read_called)).toBe(true);
        expect(testfs.read_called[0]).toBe(fd);
        expect(testfs.read_called[1]).toBe(data);
        return lfs;
    });

    it("test_layered_mounts", async function () {
        var lfs = new LayeredFilesystem();
        var tmp = new MyFS();
        await lfs.mkdir("/tmp", 0o777);
        await lfs.mount("/tmp", tmp);

        await lfs.create("/asdf", 0o777);
        expect((await lfs.readdir("/")).length).toBe(4);
        expect((await lfs.readdir("/tmp")).length).toBe(2);

        await lfs.create("/tmp/asdf", 0o777);
        expect((await lfs.readdir("/tmp")).length).toBe(3);
        expect((await tmp.readdir("/")).length).toBe(3);
        return lfs;
    });
})
