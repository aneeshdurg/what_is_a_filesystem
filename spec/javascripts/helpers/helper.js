const base_url = "__src__";

function check_test_case(test) {
    return expect(test.actual).toBe(test.expected);
}

async function get_shell(fs) {
    if (!fs) {
      fs = new LayeredFilesystem();
    }

    var shell = new Shell(fs, null);
    await shell.init(base_url);
    return shell;
}

async function sleep(time) {
    var resolve = null;
    var wait_for_sleep = new Promise(r => { resolve = r; });
    setTimeout(resolve, time);
    await wait_for_sleep;
}
