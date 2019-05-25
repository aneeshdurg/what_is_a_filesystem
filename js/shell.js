// command syntax: [args] (> file(+offset))
function Command(input, stdout_path) {
    this.input = input;

    var parts = this.input.split(" ").filter(x => x.length);
    var redirect_idx = parts.findIndex(x => x == '>');
    var output = stdout_path;
    if (redirect_idx >= 0) {
        output = parts[redirect_idx + 1];
        parts = parts.splice(0, redirect_idx);
    }
    this.arguments = parts;
}

function ShellFS(shell) {
    this.shell = shell;
};
inherit(ShellFS, DefaultFS);

ShellFS.prototype.open = async function(path, mode) {
    console.log("called sfs open");
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
    this.shell.output.innerText.append(output_as_str);
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

    this.prompt = "> ";
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
        this.output.innerText += this.prompt;
        var command = "";
        var file = await this.filesystem.open(this.input_path);
        console.log(file);
        while (!command.length || (command.slice(-1) != "\n")) {
            var buffer = new Uint8Array([0]);
            await this.filesystem.read(file, buffer);
            command += String.fromCharCode(buffer[0]);
        }
        console.log(command);
    }
}

Shell.prototype.run_command = async function (input) {
    command = new Command(input);
    command.output = this.fs.open(command.output);

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

Shell.prototype.handle_cd = function(command) {
    if (command.arguments.length > 2) {
        command.stderr = "Too many arguments to cd!";
    }

    this.current_dir = command.arguments[1];
}

Shell.prototype.handle_ls = async function(command) {
    var argument = "";
    var output = " ";
    var show_hidden = false;
    var show_inodes = false;
    var show_detailed = false;

    function help() {
        const help_msg =
            "ls [options...] [path]\n" +
            "\t if path is empty, the current directory will be used instead\n" +
            "\t options can be 0 or more of the following:\n" +
            "\t\t-a show all files (including hidden files)\n" +
            "\t\t-i show inode numbers\n" +
            "\t\t-l show all information\n" +
            "\t\t-h show this help message\n";
        command.stderr = help_msg;
    }

    const possible_options = [
        ("a", () => { show_hidden = true; }),
        ("h", help),
        ("i", () => { show_inodes = true; }),
        ("l", () => { show_all = true; }),
    ];

    if (command.arguments.length >= 2) {
        var options = command.arguments.filter((x) => x.startsWith('-'));
        options = options.map((x) => Array.from(x.substring(1))).flat();
        // Remove duplicates
        options = Array.from(new Set(options));
        //for (var i = 0; i < possible_options; i++) {
        //    if (options.find(possible_options[i][0])) {
        //        possible_options[i][1]();
        //        if (possible_options[
        //    }
        //}
    }

    if (command.arguments.length == 1) {
        command.arguments.push_back(".")
    }

    var path = this.expand_path(command.arguments[1]);
    contents = await this.filesystem.readdir(path);

    if (command.output == "")
        this.add_output(output);
    else {
        var file = this.filesystem.open(this.expand_path(command.output));
        if (file.error != null) {
            this.add_error("Failed to open " + command.output);
            this.add_error(file.error);
            return;
        }
        this.filesystem.write(fd, output);
    }
}
