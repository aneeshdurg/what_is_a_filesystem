function check_test_case(test) {
    return expect(test.actual).toBe(test.expected);
}

async function get_shell(fs) {
    if (!fs) {
      fs = new LayeredFilesystem();
    }

    var shell = new Shell(fs, null);
    // jasmine hosts the project source at __src__
    await shell.init("__src__");
    return shell;
}
