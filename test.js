window.onload = main;

function assert(cond) {
    if (!cond)
        throw Error("Assertion failed!");
}

function run_test(test) {
    var return_val = null;
    try {
        return_val = test();
    } catch (err) {
        console.log(err);
    }

    if (return_val)
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

function main() {
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