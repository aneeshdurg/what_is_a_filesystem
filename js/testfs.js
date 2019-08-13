import {DefaultFS} from './fs.js'

export class TestFS extends DefaultFS {}
function TestFSSetup() {
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
TestFSSetup();
