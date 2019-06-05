const possible_commands = [
        "cat",
        "cd",
        "chmod",
        "echo",
        //"file", TODO implement file
        "hexdump",
        "inodeinfo",
        "link",
        "ls",
        "mkdir",
        //"mount", TODO implement mount
        "read",
        "replace",
        "rm",
        "stat",
        "touch",
        "truncate",
    ];

// command syntax: [args] (> file(+offset))
function Command(input, stdout_path) {
    this.input = input;

    var parts = this.input.trim().split(" ").filter(x => x.length);
    var redirect_idx = parts.findIndex(x => x == '>');
    var append = false;
    if (redirect_idx < 0) {
        redirect_idx = parts.findIndex(x => x == '>>');
        append = true;
    }

    this.output = stdout_path;
    this.append_output = append;
    if (redirect_idx >= 0) {
        this.output = parts[redirect_idx + 1];
        parts = parts.splice(0, redirect_idx);
    }
    this.arguments = parts;
}

function ShellFS(shell) {
    this.shell = shell;
};
inherit(ShellFS, DefaultFS);

ShellFS.prototype.open = async function(path, mode) {
    if (path === "/stdout" || path === "/stdin" || path === "/stderr") {
        if (path !== "/stdin" && mode & O_RDONLY)
            return "EPERM";

        if (path === "/stdin" && mode & O_WRONLY)
            return "EPERM";

        var f = new FileDescriptor(this, path, 0, null, mode);
        return f;
    }
    return "ENOENT";
};
ShellFS.prototype.close = fd => {};

ShellFS.prototype.ioctl = async function (fd, request, obj){
    if (request != IOCTL_IS_TTY)
        return "EIMPL";

    return 0;
};

ShellFS.prototype.read = async function (file, buffer){
    // read from stdin, using this.shell.reader to block if necessary
    var bytes_to_read = buffer.length;
    var bytes_read = 0;
    while (!this.shell.stdin_closed && bytes_read < bytes_to_read) {
        while (!this.shell.stdin.length && !this.shell.stdin_closed) {
            var shell = this.shell;
            var p = new Promise(resolve => { shell.reader = resolve; });
            await p;
        }

        if (this.shell.stdin_closed)
            break;

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
    this.stdin_closed = false;
    this.reader = null;

    this.container = null;
    this.output = null;
    this.setup_container_and_output(parent);
}

Shell.prototype.setup_container_and_output = function(parent) {
    this.container = document.createElement("div");
    this.container.tabIndex = "0";
    this.container.style.maxHeight = "250px";
    this.container.style.overflow = "scroll";
    //this.container.style.height = "20%";
    //this.container.style.overflow = "scroll";

    this.output = document.createElement("pre");
    this.setup_container_event_listeners();
    this.container.appendChild(this.output);

    if (parent) {
        parent.appendChild(this.container);
    }

    var that = this;
    this.initialized = new Promise(r => { that._init_resolver = r; });
}

Shell.prototype.setup_container_event_listeners = function () {
    function stop_event(e) {
        e.stopPropagation();
        e.preventDefault();
    }
    var that = this;

    this.click_listner = function(e) { that.container.focus(); };
    this.container.addEventListener("click", this.click_listner, false);

    this.container.addEventListener("keyup", stop_event);

    this.keydown_listener = function(e) {
        if(that.process_input(e.key, e.ctrlKey))
            stop_event(e);
    };
    this.container.addEventListener("keydown", this.keydown_listener, false);
}
Shell.prototype.remove_container_event_listeners = function () {
    if (this.click_listner)
        this.container.removeEventListener("click", this.click_listner, false);

    if (this.keyup_listener)
        this.container.removeEventListener("keyup", this.keyup_listener);

    if (this.keydown_listener)
        this.container.removeEventListener("keydown", this.keydown_listener, false);
};

Shell.prototype._init = async function (base_url) {
    this.shellfs_root = "/.shellfs";
    this.shellfs = new ShellFS(this);

    var s = await this.filesystem.mkdir(this.shellfs_root, 0o777);
    s = await this.filesystem.mount(this.shellfs_root, this.shellfs);

    this.output_path = this.shellfs_root + "/stdout"
    this.error_path = this.shellfs_root + "/stderr"
    this.input_path = this.shellfs_root + "/stdin"

    this.stderr = await this.filesystem.open(this.error_path);


    var coreutils_scripts = possible_commands.map(x => base_url + "/js/coreutils/" + x + ".js");
    var coreutils_promises = [];
    for (src of coreutils_scripts) {
        var resolve = null;
        var p = new Promise(r => resolve = r);
        coreutils_promises.push(p)

        var script_el = document.createElement("script");
        script_el.src = src;
        script_el.onload = resolve;
        document.head.appendChild(script_el);
    }

    for (p of coreutils_promises) {
        await p;
    }

    this._init_resolver();
}

Shell.prototype.process_input = function (key, ctrlkey) {
    this.scroll_container();

    var flush = false
    var to_append = null;
    if (key.length == 1) {
        if (ctrlkey && key == 'd') {
            this.stdin_closed = true;
        } else if (ctrlkey) {
            // TODO support paste
            return false;
        } else {
            to_append = key;
        }
    } else if (key === "Enter") {
        to_append = "\n";
        flush = true;
    } else if (key === "Tab") {
        to_append = "\t";
    } else if (key === "Escape") {
        document.activeElement.blur();
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
    } else {
        return false;
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

    return true;
}

Shell.prototype.scroll_container = async function () {
        this.container.scrollTop = this.container.scrollHeight;
}

Shell.prototype.main = async function (base_url) {
    await this._init(base_url);
    while (true) {
        this.output.innerText += this.prompt(this);
        this.scroll_container();

        var command = "";
        var file = await this.filesystem.open(this.input_path);
        while (!command.length || (command.slice(-1) != "\n")) {
            // Ignore closed stdin
            this.stdin_closed = false;

            var buffer = new Uint8Array([0]);
            var e = await this.filesystem.read(file, buffer);
            if (e)
                command += String.fromCharCode(buffer[0]);
        }
        this.history.push(command);
        this.history_index = this.history.length - 1;

        await this.run_command(command);
    }
}

Shell.prototype.run_command = async function (input) {
    var command = new Command(input, this.output_path);

    if (!command.arguments[0])
        return;

    var command_output = this.expand_path(command.output)
    var open_flags = O_WRONLY | O_CREAT;
    if (command.append_output)
        open_flags |= O_APPEND;
    else
        open_flags |= O_TRUNC;

    command.output = await this.filesystem.open(command_output, open_flags, this.umask);
    if (typeof(command.output) === 'string')
        return this._return_error("Could not open " + command_output + " for writing");

    for (var i = 0; i < possible_commands.length; i++) {
        if (command.arguments[0] == possible_commands[i])
            return this['handle_' + possible_commands[i]](command);
    }
    var path = this.expand_path(command.arguments[0]);
    var file = await this.filesystem.open(path, O_RDONLY);
    if (typeof(file) === 'string')
        return this._return_error("Invalid command: `" + command.input.trim() + "`");

    var info = await this.filesystem.stat(path);
    if (typeof(info) === 'string')
        return this._return_error("Could not stat " + path);
    else if (!(info.mode & 0o100))
        return this._return_error("Could not execute " + path);

    var file_buffer = new Uint8Array(new ArrayBuffer(info.filesize));
    var bytes_read = await this.filesystem.read(file, file_buffer);
    if (typeof(bytes_read) === 'string')
        return this._return_error(bytes_read);

    try {
        var program = eval(bytes_to_str(file_buffer));
        return program.call(this, command);
    } catch (e) {
        return this._return_error(e.message);
    }
}

Shell.prototype.path_join = function(path1, path2) {
    if (path1.endsWith("/") && path2.startsWith("/"))
        return path1 + path2.slice(1);

    if (!path1.endsWith("/") && !path2.startsWith("/"))
        return path1 + "/" + path2;

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

Shell.prototype._return_error = async function(error) {
    await this.filesystem.write(this.stderr, str_to_bytes(
            "Error: " + error + "\n"));
    return error;
};


