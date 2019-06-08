const possible_commands = [
    {
        name: "cat",
        description: "Concatenate files and input streams " + 
            "(can also be used to dump content to stdout or write stdin to files)",
    },
    {
        name: "cd",
        description: "Change current working directory",
    },
    {
        name: "chmod",
        description: "Change mode of a file",
    },
    {
        name: "echo",
        description: "Echo command line arguments to stdout",
    },
    {
        name: "edit",
        description: "Open a graphic editor",
    },
    {
        name: "exec",
        description: "Execute a program on the filesystem",
    },
    {
        name: "help",
        description: "Show this help message",
    },
    {
        name: "hexdump",
        description: "View the hexadecimal representation of bytes in a file",
    },
    {
        name: "inodeinfo",
        description: "Inspect an inode",
    },
    {
        name: "link",
        description: "Creates hardlinks",
    },
    {
        name: "ls",
        description: "List contents of a directory",
    },
    {
        name: "mkdir",
        description: "Make a directory",
    },
    {
        name: "mount",
        description: "Mount a filesystem",
    },
    {
        name: "read",
        description: "read a file",
    },
    {
        name: "replace",
        description: "Replace one string from an input stream with another in the output",
    },
    {
        name: "rm",
        description: "unlinks a file",
    },
    {
        name: "stat",
        description: "Get information about a file",
    },
    {
        name: "touch",
        description: "Create a file or update the last modified time of a file.",
    },
    {
        name: "truncate",
        description: "Extend or shrink the size of a file",
    },
    {
        name: "umount",
        description: "Unmount a filesystem",
    },
];

var coreutils_promises = null;

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
    this.container.style.overflow = "auto";
    //this.container.style.height = "20%";
    //this.container.style.overflow = "scroll";

    this.output = document.createElement("pre");
    this.setup_container_event_listeners();
    this.container.appendChild(this.output);

    if (parent) {
        parent.appendChild(this.container);
        this.parent = parent;
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

    this.paste_listner = function(event){
        var text = event.clipboardData.getData('text');
        var lines = text.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            for (var c of line) {
                that.process_input(c, false);
            }
            if (i != (lines.length - 1))
                that.process_input("Enter", false);
        }
    }
    this.container.addEventListener("paste", this.paste_listner, false);
}

Shell.prototype.remove_container_event_listeners = function () {
    if (this.click_listner)
        this.container.removeEventListener("click", this.click_listner, false);

    if (this.keyup_listener)
        this.container.removeEventListener("keyup", this.keyup_listener);

    if (this.keydown_listener)
        this.container.removeEventListener("keydown", this.keydown_listener, false);

    if (this.paste_listener)
        this.container.removeEventListener("paste", this.paste_listener, false);
};

Shell.prototype.create_extended_input = function (content) {
    var that = this;
    content = content || "";
    if (this.extended_active)
        return;

    this.extended_active = {};
    this.extended_active.cancelled = false;
    this.extended_active.input_box = document.createElement("textarea");
    this.extended_active.input_box.value = content;

    this.extended_active.done = new Promise((resolve) => { that.extended_active.resolve = resolve; });

    this.extended_active.confirm_button = document.createElement("button");
    this.extended_active.confirm_button.innerText = "Save";
    this.extended_active.confirm_button.onclick = function() {
        that.extended_active.resolve();
    };

    this.extended_active.cancel_button = document.createElement("button");
    this.extended_active.cancel_button.innerText = "cancel";
    this.extended_active.cancel_button.onclick = function() {
        that.extended_active.cancelled = true;
        that.extended_active.resolve();
    };



    if (this.parent) {
        this.parent.appendChild(this.extended_active.input_box);
        this.parent.appendChild(this.extended_active.confirm_button);
        this.parent.appendChild(this.extended_active.cancel_button);

        this.extended_active.input_box.focus();
    }
};

Shell.prototype.get_extended_output_and_cleanup = async function () {
    if (!this.extended_active)
        return;
    await this.extended_active.done;
    var output = this.extended_active.input_box.value;
    if (this.extended_active.cancelled) {
        output = null;
    }

    this.extended_active.input_box.remove();
    this.extended_active.confirm_button.remove();
    this.extended_active.cancel_button.remove();
    delete this.extended_active;
    return output;
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

    if (!coreutils_promises) {
        coreutils_promises = [];
        var coreutils_scripts = possible_commands.map(x => base_url + "/js/coreutils/" + x.name + ".js");
        for (src of coreutils_scripts) {
            var resolve = null;
            var p = new Promise(r => resolve = r);
            coreutils_promises.push(p)

            var script_el = document.createElement("script");
            script_el.src = src;
            script_el.onload = resolve;
            document.head.appendChild(script_el);
        }
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
        if (command.arguments[0] == possible_commands[i].name)
            return this['handle_' + possible_commands[i].name](command);
    }
    command.arguments.unshift("exec");
    return this['handle_exec'](command);
}

Shell.prototype.path_join = function(path1, path2) {
    if (path1.endsWith("/") && path2.startsWith("/"))
        return path1 + path2.slice(1);

    if (!path1.endsWith("/") && !path2.startsWith("/"))
        return path1 + "/" + path2;

    return path1 + path2;
};


Shell.prototype.expand_path = function(path) {
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


