describe("Test Shell Commands", function () {
    it("tests cat", async function() {
        // create file with some expected contents
        var shell = await get_shell();
        var expected_str = "Hello data!";
        var fd = await shell.filesystem.open("/test_file", O_CREAT | O_WRONLY, 0o777);
        expect(typeof(fd)).not.toBe('string');

        var error = await shell.filesystem.write(fd, str_to_bytes(expected_str));
        expect(typeof(error)).not.toBe('string');

        await shell.run_command(new Command("cat /test_file"));

        var output = shell.output.get();
        expect(output).toContain(expected_str);
    });

    it ("tests cd", async function() {
        // change directory and check relative path
        var shell = await get_shell();
        await shell.filesystem.mkdir("/newdir", 0o777);
        await shell.run_command(new Command("cd /newdir"));

        expect(shell.current_dir).toBe("/newdir");

        return shell;
    });

    xit ("test_run_command_chmod", async function () {
    });

    xit ("test_run_command_exec", async function () {
    });

    xit ("test_run_command_hexdump", async function () {
    });

    xit ("test_run_command_link", async function () {
    });

    xit ("test_run_command_ls", async function () {
    });

    xit ("test_run_command_mkdir", async function () {
    });

    xit ("test_run_command_mount", async function () {
    });

    xit ("test_run_command_read", async function () {
    });

    xit ("test_run_command_replace", async function () {
    });

    xit ("test_run_command_rm", async function () {
    });

    xit ("test_run_command_stat", async function () {
    });

    xit ("test_run_command_touch", async function () {
    });

    xit ("test_run_command_truncate", async function () {
    });

    xit ("test_run_command_umount", async function () {
    });
});
