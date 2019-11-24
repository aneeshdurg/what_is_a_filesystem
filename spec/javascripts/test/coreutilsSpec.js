async function imports() {
    await _import({
        src: '/__src__/js/defs.mjs',
        name: ['CONSTANTS']});

    await _import({
        src: '/__src__/js/lfs.mjs',
        name: 'LayeredFilesystem'});

    await _import({
        src: '/__src__/js/shell.mjs',
        name: ['Shell', 'Command', 'possible_commands']});

    await _import({
        src: '/__src__/js/fs_helper.mjs',
        name: 'str_to_bytes'});
}

describe("Test Shell Commands", function () {
    beforeAll(async () => {
        await imports();
    });

    it("smoke tests all commands", async () => {
        const shell = await get_shell();
        const errors = {};
        const command_tests = possible_commands.filter((command) => {
            // ignoring these tests because they assume stdin as first arg and
            // would fail this test
            return !(["cat", "hexdump", "read"].includes(command.name));
        }).map((command) => {
            return [command.name, new Promise((r, e) => {
                setTimeout(() => { e(`${command.name} timed out!`) }, 500);
                shell.run_command(new Command(command.name)).then(r);
            })]
        });
        for (const c in command_tests) {
            const test = command_tests[c];
            try {
                await test[1];
            } catch (e) {
                errors[test[0]] = e;
            }
        }

        expect(errors).toEqual({});
    })

    it("tests cat", async function() {
        // create file with some expected contents
        var shell = await get_shell();
        var expected_str = "Hello data!";
        var fd = await shell.filesystem.open("/test_file", CONSTANTS.O_CREAT | CONSTANTS.O_WRONLY, 0o777);
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
