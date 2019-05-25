// command syntax: [args] (> file(+offset))
function Command(input, stdout_path) {
    this.input = input;

    var parts = this.input.trim().split(" ").filter(x => x.length);
    var redirect_idx = parts.findIndex(x => x == '>');
    this.output = stdout_path;
    if (redirect_idx >= 0) {
        this.output = parts[redirect_idx + 1];
        parts = parts.splice(0, redirect_idx);
    }
    this.arguments = parts;
}

function str_to_bytes(str) {
    return new Uint8Array(Array.from(str).map(x => x.charCodeAt(0)));
};

function ShellFS(shell) {
    this.shell = shell;
};
inherit(ShellFS, DefaultFS);

ShellFS.prototype.open = async function(path, mode) {
    console.log("called sfs open", path);
    if (path === "/stdout" || path === "/stdin" || path === "/stderr") {
        if (path !== "/stdin" && mode & O_RDONLY)
            return "EPERM";

        if (path === "/stdin" && mode & O_WRONLY)
            return "EPERM";

        var f = new FileDescriptor(this, path, null, mode);
        return f;
    }
    console.log("Not found:", path);
    return "ENOENT";
};
ShellFS.prototype.close = fd => {};

// TODO implement EOF on stdin
ShellFS.prototype.read = async function (file, buffer){
    // read from stdin, using this.shell.reader to block if necessary
    var bytes_to_read = buffer.length;
    var bytes_read = 0;
    while (bytes_read < bytes_to_read) {
        while (!this.shell.stdin_buffer.length) {
            var shell = this.shell;
            var p = new Promise(resolve => { shell.reader = resolve; });
            await p;
        }

        var c = this.shell.stdin_buffer.shift();
        buffer[bytes_read] = c.charCodeAt(0);
        bytes_read += 1;
    }

    return bytes_read;
};

ShellFS.prototype.write = function (file, buffer) {
    var output_as_str = String.fromCharCode.apply(null, buffer);
    this.shell.output.innerText += output_as_str;

    this.shell.container.scrollTop = this.shell.container.scrollHeight;
    return buffer.length;
};


// This shell models a single process environment
function Shell(fs, parent) {
    this.filesystem = fs;
    this.current_dir = "/";

    this.stdin_buffer = [];

    // if stdin_buffer is empty a reader can place a resolve here and wait for
    // it to be resolved
    this.reader = null;
    // TODO setup DOM rendering elements

    var that = this;
    this.container = document.createElement("div");
    this.container.tabIndex = "0";
    this.container.style.maxHeight = "500px";
    this.container.style.overflow = "scroll";
    //this.container.style.height = "20%";
    //this.container.style.overflow = "scroll";

    this.output = document.createElement("pre");
    this.container.addEventListener("click", function(e) { that.container.focus(); }, false);
    function stop_event(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    this.container.addEventListener("keyup", stop_event);
    this.container.addEventListener("keydown", function(e) {
        stop_event(e);
        that.process_input(e.key);
    }, false);
    this.container.appendChild(this.output);

    if (parent) {
        parent.appendChild(this.container);
    }

    this.prompt = (shell) => shell.current_dir + " $ ";
}

Shell.prototype._init = async function () {
    const shellfs_root = "/.shellfs";
    var s = await this.filesystem.mkdir(shellfs_root, 0o777);
    console.log("mkdir", s);
    console.log(await this.filesystem.readdir("/"));
    s = await this.filesystem.mount(shellfs_root, new ShellFS(this));
    console.log("mount", s);
    this.output_path = shellfs_root + "/stdout"
    this.error_path = shellfs_root + "/stderr"
    this.input_path = shellfs_root + "/stdin"
}

Shell.prototype.process_input = function (key) {
    var to_append = null;
    if (key.length == 1) {
        to_append = key;
    } else if (key === "Enter") {
        to_append = "\n";
    } else if (key === "Tab") {
        to_append = "\t";
    }
    // TODO implement backspace
    // this implements it visually, but the "erased" bytes may have already been
    // consumed by a reader
    // else if (key === "Backspace") {
    //     this.stdin_buffer.pop();
    //     // TODO be smarter about erasing bytes from output
    //     if (this.output.innerText.length) {
    //         this.output.innerText = this.output.innerText.slice(0, -1);
    //     }
    // }

    if (to_append) {
        this.stdin_buffer.push(to_append);
        this.output.innerText += to_append;
    }

    if (this.reader) {
        this.reader();
        this.reader = null;
    }
}

Shell.prototype.main = async function () {
    await this._init();
    while (true) {
        this.output.innerText += this.prompt(this);
        var command = "";
        var file = await this.filesystem.open(this.input_path);
        while (!command.length || (command.slice(-1) != "\n")) {
            var buffer = new Uint8Array([0]);
            await this.filesystem.read(file, buffer);
            command += String.fromCharCode(buffer[0]);
        }
        console.log(command);
        await this.run_command(command);
    }
}

Shell.prototype.run_command = async function (input) {
    command = new Command(input, this.output_path);
    console.log("opening", command.output);
    command.output = await this.filesystem.open(command.output);
    console.log("output @", command.output);

    const possible_commands = [
        "cat",
        "cd",
        "echo",
        "file",
        "link",
        "ls",
        "mkdir",
        "mount",
        "replace", // replace str1 str2 (replaces str1 in stdin with str2 in stdout)
        "rm",
        "stat",
        "touch",
        "wc",
    ]

    for (var i = 0; i < possible_commands.length; i++) {
        if (command.arguments[0] == possible_commands[i])
            return this['handle_' + possible_commands[i]](command);
    }
    return "Invalid command: `" + command.input + "`";
}

Shell.prototype.path_join = function(path1, path2) {
    if (path1.endsWith("/") && path2.startsWith("/"))
        return path1 + path2.slice(1);

    if (!path1.endsWith("/") && !path2.startsWith("/"))
        return path1 + "/" + path2.slice(1);

    return path1 + path2;
};


Shell.prototype.expand_path = function(path) {
    // TODO rewrite using path_join
    var curr_dir = this.current_dir.split("/");
    var parts = path.split("/");
    if (parts[0] == "") {
        curr_dir = [ "" ];
    }

    for (var i = 0; i < parts.length; i++) {
        if (parts[i] == ".") {
            continue;
        } else if (parts[i] == ".." ) {
            if (curr_dir.length > 1)
                curr_dir = curr_dir.slice(0, -1);
            else
                curr_dir = [""];
        } else
            curr_dir.push(parts[i]);
    }
    var expanded_path = curr_dir.join("/")
    if (expanded_path.startsWith("//")) {
        expanded_path = expanded_path.slice(1);
    }

    if (!expanded_path.length)
        expanded_path = "/";

    return expanded_path;
}

Shell.prototype.handle_cd = async function(command) {
    if (command.arguments.length > 2) {
        command.stderr = "Too many arguments to cd!";
    }

    var path = this.expand_path(command.arguments[1]);
    var info = await this.filesystem.stat(path);
    console.log("got stat", info);
    var error = null;
    if (typeof(info) === 'string') {
        error = info;
    } else if (!info.is_directory) {
        // TODO also check execute permission
        error = "ENOTDIR";

    }

    if (error) {
        await this.filesystem.write(command.output, str_to_bytes(
            "Error: " + error + "\n"));
        return;
    }

    this.current_dir = path;
}

Shell.prototype.handle_mkdir = async function (command) {
    errors = "";
    for (var i = 1; i < command.arguments.length; i++) {
        var path = this.expand_path(command.arguments[i]);
        var output = await this.filesystem.mkdir(path, 0o777);
        if (typeof(output) === 'string') {
            errors += "Error creating directory '" + command.arguments[i] + "':"
            errors += "\n\t" + output + "\n"
        }
    }

    if (errors)
        await this.filesystem.write(command.output, str_to_bytes(
            "Error: " + error + "\n"));
}

Shell.prototype.handle_ls = async function(command) {
    var argument = "";
    var output = " ";
    var show_hidden = false;
    var show_inodes = false;
    var show_detailed = false;

    async function help() {
        const help_msg =
            "ls [options...] [path]\n" +
            "\t if path is empty, the current directory will be used instead\n" +
            "\t options can be 0 or more of the following:\n" +
            "\t\t-a show all files (including hidden files)\n" +
            "\t\t-i show inode numbers\n" +
            "\t\t-l show all information\n" +
            "\t\t-h show this help message\n";
        await this.filesystem.write(command.output, str_to_bytes(help_msg));
    }

    const possible_options = {
        a: () => { show_hidden = true; },
        h: help,
        i: () => { show_inodes = true; },
        l: () => { show_detailed = true; },
    };

    if (command.arguments.length >= 2) {
        var options = command.arguments.filter((x) => x.startsWith('-'));
        options = options.map((x) => Array.from(x.substring(1))).flat();
        // Remove duplicates
        options = Array.from(new Set(options));
        for (var i = 0; i < options.length; i++) {
            if (possible_options[options[i]]) {
                await possible_options[options[i]]();
                if (options[i] == 'h')
                    return;
            }
        }
        command.arguments = command.arguments.filter((x) => !x.startsWith('-'));
    }

    if (command.arguments.length == 1) {
        command.arguments.push(".")
    }

    var path = this.expand_path(command.arguments[1]);
    console.log("Ls path:", path);
    var contents = await this.filesystem.readdir(path);
    console.log("contents", contents);

    console.log("Reading", path);
    var curr_dir = await this.filesystem.stat(path);
    if (typeof(curr_dir) === 'string') {
        await this.filesystem.write(command.output, str_to_bytes(
            "Error reading dir '.': " + curr_dir + "\n"));
        return;
    }
    var curr_dirent = new Dirent(curr_dir.inodenum, ".");

    var parent_dir = await this.filesystem.stat(
        this.expand_path(this.path_join(path, "/..")));
    if (typeof(parent_dir) === 'string') {
        await this.filesystem.write(command.output, str_to_bytes(
            "Error reading dir '..': " + parent_dir + "\n"));
        return;
    }
    var parent_dirent = new Dirent(parent_dir.inodenum, "..");

    if (!show_hidden) {
        contents = contents.filter(x => !x.filename.startsWith('.'));
        console.log("nonhidden", contents)
    }

    var that = this;
    async function default_line_formatter(x, _info) {
        return x.filename;
    };

    async function detailed_line_formatter(x, _info) {
        var full_path = that.expand_path(that.path_join(path, x.filename));
        var info = null;
        if (_info)
            info = _info;
        else
            info = await that.filesystem.stat(full_path);

        if (typeof(info) === 'string')
            return "Error could not stat " + full_path + ":" + info;

        var permissions = info.mode.toString(8);
        return permissions + " " + info.filesize + " " + x.filename;
    };

    async function inode_line_formatter(x, _info) {
        return x.inodenum + " " + x.filename;
    };

    async function detailed_inode_line_formatter(x) {
        return x.inodenum + " " + await detailed_line_formatter(x);
    };


    var line_formatter = default_line_formatter;
    if (show_detailed && show_inodes)
        line_formatter = detailed_inode_line_formatter;
    else if (show_inodes)
        line_formatter = inode_line_formatter;
    else if (show_detailed)
        line_formatter = detailed_inode_line_formatter;

    var output = "";
    output += await line_formatter(curr_dirent, curr_dir) + "\n";
    output += await line_formatter(parent_dirent, parent_dir) + "\n";
    for (var i = 0; i < contents.length; i++) {
        output += await line_formatter(contents[i]) + "\n";
    }

    await this.filesystem.write(command.output, str_to_bytes(output));
}
