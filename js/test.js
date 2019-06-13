window.onload = main;

function assert(cond, msg) {
    if (!cond) {
        var error_msg = "Assertion failed!";
        if (msg) {
            error_msg += "\n" + msg;
            console.log(msg);
        }
        throw Error(error_msg);
    }
}

function assert_test_case(testcase) {
  assert(
    testcase.actual === testcase.expected,
    testcase.actual + " != " + testcase.expected);
}

var _test_result = null;
async function run_test(test) {
    _test_result = null;
    try {
        _test_result = await test();
    } catch (err) {
        console.log(err);
    }

    if (_test_result)
        document.body.appendChild(
            document.createTextNode(test.name + ": Success!"));
    else
        document.body.appendChild(
            document.createTextNode(test.name + ": Failed"));

    document.body.appendChild(document.createElement("br"));
}

function gen_run_test(name) {
    return () => { run_test(window[name]); };
}

function TestFS() {};
function TestFSSetup() {
    inherit(TestFS, DefaultFS);
    function _gen_TestFS_attr(attr) {
        return "TestFS.prototype." + attr + "= function() { " +
            "this." + attr + "_called = arguments;" +
            "};";
    }
    var ignore = new Set(["constructor", "mount", "umount", "seek"]);
    var callbacks = Object.getOwnPropertyNames(DefaultFS.prototype).filter(x => !ignore.has(x));
    for (name of callbacks) {
        if (name === "constructor")
            continue;
        eval(_gen_TestFS_attr(name));
    }
}

function main() {
    TestFSSetup();
    var testnames =
        Object.getOwnPropertyNames(window).filter(
            (x) => x.startsWith("test_"));
    for (t in testnames) {
        test_runner = document.createElement("button");
    test_runner.onclick = gen_run_test(testnames[t]);
            test_runner.appendChild(document.createTextNode(testnames[t]));
        document.body.appendChild(test_runner);
    }
    document.body.appendChild(document.createElement("br"));
}
