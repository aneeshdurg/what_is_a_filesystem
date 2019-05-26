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
        while (!this.shell.stdin.length) {
            var shell = this.shell;
            var p = new Promise(resolve => { shell.reader = resolve; });
            await p;
        }

        var c = this.shell.stdin.shift();
        buffer[bytes_read] = c.charCodeAt(0);
        bytes_read += 1;
    }

    return bytes_read;
};

ShellFS.prototype.write = function (file, buffer) {
    var output_as_str = String.fromCharCode.apply(null, buffer);
    this.shell.output.innerText += output_as_str;

    this.shell.scroll_container();
    return buffer.length;
};


// This shell models a single process environment
function Shell(fs, parent) {
    this.filesystem = fs;
    this.current_dir = "/";
    this.umask = 0o644;
    this.prompt = (shell) => shell.current_dir + " $ ";
    this.history = [];
    this.history_index = -1;

    // if stdin_buffer is empty a reader can place a resolve here and wait for
    // it to be resolved
    this.stdin_buffer = [];
    this.stdin = [];
    this.reader = null;

    this.container = null;
    this.output = null;
    this.setup_container_and_output(parent);
}

Shell.prototype.setup_container_and_output = function(parent) {
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
    var flush = false
    var to_append = null;
    console.log(key, this.history, this.history_index);
    if (key.length == 1) {
        to_append = key;
    } else if (key === "Enter") {
        to_append = "\n";
        flush = true;
    } else if (key === "Tab") {
        to_append = "\t";
    } else if (key === "Escape") {
        this.container.parentElement.focus();
        document.body.focus();
    } else if (key === "Backspace") {
        if (this.stdin_buffer.length) {
            this.stdin_buffer.pop();
            if (this.output.innerText.length) {
                this.output.innerText = this.output.innerText.slice(0, -1);
            }
        }
    } else if (key === "ArrowUp") {
        if (this.history.length && this.history_index >= 0) {
            if (this.stdin_buffer.length && this.output.innerText.length) {
                this.output.innerText = this.output.innerText.slice(0, -1 * this.stdin_buffer.length);
            }

            var history_input = this.history[this.history_index].trim();
            this.stdin_buffer = Array.from(history_input);
            this.output.innerText += history_input;
            this.history_index -= 1;
        }
    } else if (key === "ArrowDown") {
        if (this.history.length && this.history_index < this.history.length) {
            if (this.stdin_buffer.length && this.output.innerText.length) {
                this.output.innerText = this.output.innerText.slice(0, -1 * this.stdin_buffer.length);
            }

            if (this.history_index + 1 == this.history.length) {
                this.stdin_buffer = [];
            } else {
                var history_input = this.history[this.history_index + 1].trim();
                this.stdin_buffer = Array.from(history_input);
                this.output.innerText += history_input;
                this.history_index += 1;
            }
        }
    }

    if (to_append) {
        this.stdin_buffer.push(to_append);
        if (flush) {
            this.stdin = this.stdin.concat(this.stdin_buffer);
            this.stdin_buffer = [];
        }
        this.output.innerText += to_append;
    }

    if (this.reader) {
        this.reader();
        this.reader = null;
    }
}

Shell.prototype.scroll_container = async function () {
        this.container.scrollTop = this.container.scrollHeight;
}

Shell.prototype.main = async function () {
    await this._init();
    while (true) {
        this.output.innerText += this.prompt(this);
        this.scroll_container();

        var command = "";
        var file = await this.filesystem.open(this.input_path);
        while (!command.length || (command.slice(-1) != "\n")) {
            var buffer = new Uint8Array([0]);
            await this.filesystem.read(file, buffer);
            command += String.fromCharCode(buffer[0]);
        }
        console.log(command);
        this.history.push(command);
        this.history_index = this.history.length - 1;

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
