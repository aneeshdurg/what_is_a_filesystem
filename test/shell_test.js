async function get_shell(fs) {
    if (!fs) {
      fs = new LayeredFilesystem();
    }

    var shell = new Shell(fs, null);
    await shell._init("..");
    return shell;
}

async function test_shellfs_existence() {
    var shell = await get_shell();

    var stdinfd = shell.filesystem.open("/.shellfs/stdin", 0);
    var stdoutfd = shell.filesystem.open("/.shellfs/stdout", 0);
    var stderrfd = shell.filesystem.open("/.shellfs/stderr", 0);

    assert(typeof(stdinfd) !== 'string');
    assert(typeof(stdoutfd) !== 'string');
    assert(typeof(stderrfd) !== 'string');
    return shell;
}

// reasons for why the test is over
const SUCCESS_STR = "SUCCESS";
const TIMEOUT_STR = "TIMEOUT";
async function with_timeout(callback, timeout) {
    // p is resolved when the test is over, either due to success or timeout
    var resolve = null;
    var p = new Promise(r => { resolve = r; });

    // output tells us why the test was resolved
    var output = null;
    function do_resolve(result) {
        if (!output) {
            resolve();
            output = result;
        }
    }

    // Block on the read
    (async function do_callback(do_resolve) {
        var result = await callback();
        do_resolve(result);
    })(do_resolve);

    // resolve on timeout
    setTimeout(() => { do_resolve(TIMEOUT_STR); }, timeout);

    // wait for test to complete
    await p;
    return output;
}

async function test_shellfs_blocking_read() {
    // expected output of read
    const expected_str = "1234567890";
    var expected_idx = 0;
    // loose upper bound on total time needed for detecting timeout
    const TOTAL_TIME = 11 * 100;

    // Setup shell without UI
    var shell = await get_shell();

    var fd = await shell.filesystem.open("/.shellfs/stdin", O_RDONLY);
    assert(typeof(fd) !== 'string', fd);

    var buffer = new Uint8Array(new ArrayBuffer(10));
        // Block on the read
    async function read_and_block() {
        await shell.filesystem.read(fd, buffer);
        return SUCCESS_STR;
    }

    // asynchronously pass in input
    (function on_timeout() {
        shell.process_input(expected_str[expected_idx++], false);
        if (expected_idx < expected_str.length)
            setTimeout(on_timeout, 100);
        else
            shell.process_input("Enter", false); // flush input
    })();
    var output = await with_timeout(read_and_block, TOTAL_TIME);


    assert(output === SUCCESS_STR, output);
    assert(bytes_to_str(buffer) === expected_str, bytes_to_str(buffer));
    return shell;
}

async function test_path_join() {
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

    tests.map(assert_test_case);
    return shell;
}

async function test_expand_path() {
    var shell = await get_shell();
    var test_1 = {
      actual: shell.expand_path("/asdf/../1234/./../final_dir"),
      expected: "/final_dir",
    }
    assert_test_case(test_1);

    shell.current_dir = "/final_dir";
    var test_2 = {
        actual: shell.expand_path("newfile"),
        expected: "/final_dir/newfile",
    }
    assert_test_case(test_2);

    return shell;
}

async function test_run_command_cat() {
    // create file with some expected contents
    var shell = await get_shell();
    var expected_str = "Hello data!";
    var fd = await shell.filesystem.open("/test_file", O_CREAT | O_WRONLY, 0o777);
    assert(typeof(fd) !== 'string', fd);

    var error = await shell.filesystem.write(fd, str_to_bytes(expected_str));
    assert(typeof(error) !== 'string', error);

    await shell.run_command("cat /test_file");

    var output = shell.output.innerText;
    assert(output.indexOf(expected_str) >= 0, output);
    return shell;
}

async function test_run_command_cd_and_paths() {
    // change directory and check relative path
    var shell = await get_shell();
    await shell.filesystem.mkdir("/newdir", 0o777);
    await shell.run_command("cd /newdir");
    assert(shell.current_dir == "/newdir");

    return shell;
}

async function test_run_command_chmod() {
}

async function test_run_command_exec() {
}

async function test_run_command_hexdump() {
}

async function test_run_command_link() {
}

async function test_run_command_ls() {
}

async function test_run_command_mkdir() {
}

async function test_run_command_mount() {
}

async function test_run_command_read() {
}

async function test_run_command_replace() {
}

async function test_run_command_rm() {
}

async function test_run_command_stat() {
}

async function test_run_command_touch() {
}

async function test_run_command_truncate() {
}

async function test_run_command_umount() {
}
