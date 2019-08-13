describe("Test Shell", function () {
    async function imports() {
      await _import({
            src: '/__src__/js/defs.js',
            name: ['CONSTANTS']});

        await _import({
            src: '/__src__/js/lfs.js',
            name: 'LayeredFilesystem'});

        await _import({
            src: '/__src__/js/shell.js',
            name: 'Shell'});

        await _import({
            src: '/__src__/js/fs_helper.js',
            name: 'bytes_to_str'});
    }

    beforeAll((done) => {
        imports().then(done);
    });

    it("tests shellfs existence", async function() {
        var shell = await get_shell();

        var stdinfd = shell.filesystem.open("/.shellfs/stdin", 0);
        var stdoutfd = shell.filesystem.open("/.shellfs/stdout", 0);
        var stderrfd = shell.filesystem.open("/.shellfs/stderr", 0);

        expect(typeof(stdinfd)).not.toBe('string');
        expect(typeof(stdoutfd)).not.toBe('string');
        expect(typeof(stderrfd)).not.toBe('string');
    });

    it("tests that stdin blocks on read until input", async function () {
        // expected output of read
        const expected_str = "1234567890\n";
        var expected_idx = 0;

        // loose upper bound on total time needed for detecting timeout
        const DELAY = 50;
        const TOTAL_TIME = expected_str.length * DELAY;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = TOTAL_TIME;

        // Setup shell without UI
        var shell = await get_shell();

        var fd = await shell.filesystem.open("/.shellfs/stdin", CONSTANTS.O_RDONLY);
        expect(typeof(fd)).not.toBe('string');

        var buffer = new Uint8Array(new ArrayBuffer(expected_str.length));

        // asynchronously pass in input
        (function on_timeout() {
            shell.simulate_input(expected_str[expected_idx++]);
            if (expected_idx < expected_str.length)
                setTimeout(on_timeout, DELAY);
        })();

        // perform blocking read
        await (async function read_and_block() {
            await shell.filesystem.read(fd, buffer);
        })();

        expect(bytes_to_str(buffer)).toEqual(expected_str);
    });

    it("tests joining paths", async function () {
        var shell = await get_shell();
        var tests = [
            {
                actual: shell.path_join("1234", "5678"),
                expected: "1234/5678",
            },
            {
                actual: shell.path_join("/1234/", "/5678/"),
                expected: "/1234/5678/",
            },
            {
                actual: shell.path_join("1234/", "/5678"),
                expected: "1234/5678",
            }
        ];

        tests.map(check_test_case);
    });

    it("tests path expansion", async function() {
        var shell = await get_shell();
        var test_1 = {
          actual: shell.expand_path("/asdf/../1234/./../final_dir"),
          expected: "/final_dir",
        }
        check_test_case(test_1);

        shell.current_dir = "/final_dir";
        var test_2 = {
            actual: shell.expand_path("newfile"),
            expected: "/final_dir/newfile",
        }
        check_test_case(test_2);
    });
});
