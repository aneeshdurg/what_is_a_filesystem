---
---
// Import definitions of various structs/constants
import {
    get_unused_ioctl_num, // function for generating ioctl numbers (we won't be using it)
    IOCTL_IS_TTY, // ioctl used by various shell utilities (we won't be using it)
    IOCTL_SELECT_INODE, // ioctl used by inodeinfo (we won't be using it)
    CONSTANTS, // Collection of constants (like permission flags)
    FileDescriptor, // Constructor for the object returned by open
    Dirent, // Constructor for the objects returned by readdir
    Stat, // Constructor for the object returned by stat
} from "{{ '/js/defs.js' | relative_url }}"

// Some useful filesystem-agnostic helper functions
import {
    split_parent_of,
    not_implemented,
    bytes_to_str,
    str_to_bytes,
} from "{{ '/js/fs_helper.js' | relative_url }}"

import {DefaultFS} from "{{ '/js/fs.js' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.js' | relative_url }}"
import {Shell} from "{{ '/js/shell.js' | relative_url }}"

function get_merged_input(el) {
     var clone = el.cloneNode(true);
     var text_box = clone.children[0];
     var content = document.createTextNode(text_box.value);
     text_box.parentElement.replaceChild(content, text_box);
     return clone.textContent;
 }

function get_all_inputs() {
    var data = "";
    for (let el of document.querySelectorAll("[id$='_memfs']")) {
        var node = get_merged_input(el);
        data += "\n" + node;
    }
    return data;
}

function get_all_solns() {
    var data = "";
    for (let el of document.querySelectorAll("[id$='_soln']")) {
        data += "\n" + el.textContent;
    }
    return data;
}

function get_memfs_from_inputs(use_solution) {
    var source = null;
    if (use_solution)
        source = get_all_solns();
    else
        source = get_all_inputs();
    source = "(function gen_memfs() {" +
        "class MemFS extends DefaultFS {" +
        "        constructor() { super(); this.setup_root(); }\n" +
        "}\n" +
        source +
        "\n" +
        "return MemFS;" +
        "})";

    try {
        var gen_fs = eval(source);
        return gen_fs();
    } catch (e) {
        alert(e);
        return null;
    }
}

window.load_memfs = function (use_soln) {
    var MemFS = get_memfs_from_inputs(use_soln);
    if (MemFS) {
        var lfs = new LayeredFilesystem(new MemFS());
        document.getElementById("shell_parent").innerHTML = "Loading...";
        setTimeout(function() {
            document.getElementById("shell_parent").innerHTML = "";
            var shell = new Shell(lfs, document.getElementById("shell_parent"));
            shell.main("{{ site.baseurl }}");

            var title = document.getElementById("shell_type");
            if (use_soln)
              title.innerHTML = "(Loaded from solution)";
            else
              title.innerHTML = "(Loaded from input)";
        }, 250); // Delaying for 250ms to make it seem like something is happening
    }
}
