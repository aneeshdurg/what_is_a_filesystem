// https://stackoverflow.com/a/13819253/5803067
var isMobile = {
    Android: function() {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function() {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function() {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function() {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Windows: function() {
        return navigator.userAgent.match(/IEMobile/i) || navigator.userAgent.match(/WPDesktop/i);
    },
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }
};

function stop_event(e) {
    e.stopPropagation();
    e.preventDefault();
}


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
        name: "clear",
        description: "Clear the terminal",
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

// command syntax: [args] (> file)

class _Command_state {
    constructor() {
        this.parts = [];
        this.current_word = "";
        this.output_stream = null;
        this.append_output = false;

        this.active_quote = false;
        this.parsing_output_stream = false;
    }

    flush_word_to_parts() {
        if (this.parsing_output_stream)
            throw new Error();

        if (this.current_word) {
            this.parts.push(this.current_word);
            this.current_word = "";
        }
    }

    flush_word_to_output() {
        if (this.current_word) {
            this.output_stream = this.current_word;
            this.current_word = "";
        }
    }

    append_str(c) {
        this.current_word += c;
    }

    toggle_active_quote() {
        this.active_quote = !this.active_quote;
    }

    set_append_output() {
        this.append_output = true;
    }

    set_parsing_output_stream() {
        this.parsing_output_stream = true;
    }

    has_word() {
        return Boolean(this.current_word);
    }
}

class ParsingError extends Error {
    constructor(state) {
        super();
        this.state = state;
    }

    get_state() {
        return this.state;
    }
}

class Command {
    // TODO create struct to represent parsing state
    static parse_command(input) {
        let state = new _Command_state();
        return Command.resume_parse_command(input, state);
    }

    static _parse_command(input) {
        let state = new _Command_state();
        return Command._resume_parse_command(input, state);
    }

    static resume_parse_command(input, state) {
        var state = Command._resume_parse_command(input, state);
        return new Command(state);
    }

    static _resume_parse_command(input, state) {
        input = input.trim();

        let idx = 0;
        for(; idx < input.length; idx++) {
            if (input[idx] == '\\') {
                // escape the next character
                if (idx < (input.length - 1)) {
                    idx++;
                    state.append_str(input[idx]);
                } else {
                    break; // error
                }
            } else if (input[idx] == '"') {
                state.toggle_active_quote();
            } else if (/\s/.test(input[idx])) {
                // if there is no active quote, append the current word to parts
                // if there is an active quote add a space to the current word
                // else ignore
                if (state.active_quote) {
                    state.append_str(input[idx]);
                } else {
                    state.flush_word_to_parts();
                }
            } else if (input[idx] == '>') {
                // if there is no active quote the next word is the output stream
                if (state.active_quote) {
                    state.append_str(input[idx]);
                } else {
                    state.flush_word_to_parts();

                    while (idx < (input.length - 1)) {
                        if (input[idx + 1] == '>') {
                            idx++;
                            state.set_append_output();
                        } else if (/\s/.test(input[idx + 1])) { // skip following white space
                            idx++;
                        } else {
                            break;
                        }
                    }
                    state.set_parsing_output_stream();
                }
            } else {
                state.append_str(input[idx]);
            }
        }

        if (state.parsing_output_stream && (!state.has_word())) {
            return false; // TODO return state
        }

        if (idx != input.length || state.active_quote) {
            // oh noes, an error occurred - need more input
            throw new ParsingError(state); // TODO return state
        } else {
            // append last word being processesd
            if (state.parsing_output_stream) {
                state.flush_word_to_output();
            } else {
                state.flush_word_to_parts();
            }
        }

        return state;
    }

    set_default_output(output) {
        this.output = this.output || output;
    }

    constructor(input) {
        this.arguments = [];
        this.output = null;
        this.append_output = false;

        if (typeof(input) == 'string') {
            input = Command._parse_command(input);
        }

        if (input instanceof _Command_state) {
            this.arguments = input.parts;
            this.output = input.output_stream;
            this.append_output = input.append_output;
        } else {
            throw new Error("Invalid arguments to Command");
        }
    }
}

/**
 * ShellFS will provide a filesystem interface to reading and writing input/output and errors.
 */
class ShellFS extends DefaultFS {
    constructor(shell) {
        super();
        this.shell = shell;
    }

    async open(path, mode) {
        if (path === "/stdout" || path === "/stdin" || path === "/stderr") {
            if (path !== "/stdin" && mode & O_RDONLY)
                return "EPERM";

            if (path === "/stdin" && mode & O_WRONLY)
                return "EPERM";

            var f = new FileDescriptor(this, path, 0, null, mode);
            return f;
        }
        return "ENOENT";
    }

    // Replace default "EIMPL" error
    close(fd) {}

    // Return 0 for any IS_TTY requests
    async ioctl(fd, request, obj){
        if (request != IOCTL_IS_TTY)
            return "EIMPL";

        return 0;
    }

    async read(file, buffer){
        // read from stdin, using this.shell.reader to block if necessary
        var bytes_to_read = buffer.length;
        var bytes_read = 0;
        while (!this.shell.stdin_closed && bytes_read < bytes_to_read) {
            // Oh no, there is no more input, need to block...
            while (!this.shell.stdin.length && !this.shell.stdin_closed) {
                var shell = this.shell;

                // Let the shell know that there is a blocked reader
                var p = new Promise(resolve => { shell.reader = resolve; });
                await p;
            }

            // Check if we were unblocked because stdin closed
            if (this.shell.stdin_closed)
                break;

            var c = this.shell.stdin.shift();
            buffer[bytes_read] = c.charCodeAt(0);
            bytes_read += 1;
        }

        return bytes_read;
    }

     write(file, buffer) {
        var output_as_str = String.fromCharCode.apply(null, buffer);
        this.shell.output.append(output_as_str);

        return buffer.length;
    }
}

class Output {
    constructor(container) {
        this.element = document.createElement("textarea");
        this.element.className = "terminal";
        this.element.autocomplete = "off";
        this.element.autocorrect = "off";
        this.element.autocapitalize = "off";
        this.element.spellcheck = false;

        this.old_len = null;
        this.old_value = "";

        this.update_old_info();

        container.appendChild(this.element);
    }

    append(text) {
        this.element.value += text;
        this.element.scrollTop = this.element.scrollHeight;
    }

    get() {
        return this.element.value;
    }

    set(text) {
        this.element.value = text;
        this.element.scrollTop = this.element.scrollHeight;
    }

    update_old_info() {
        this.old_value = this.get();
        if (this.old_len == null) {
            this.old_len = this.get().length;
        }
    }

    set_old_info(old_value) {
        this.old_value = old_value;
        if (this.old_len == null)
            this.old_len = old_value.length;
    }

    flush() {
        this.old_len = null;
    }


    invalid_cursor_pos() {
        return this.element.selectionStart < this.old_len;
    }

    fix_cursor_pos() {
        if (this.invalid_cursor_pos())
            this.element.selectionStart = this.get().length;
    }

    restore() {
        console.log("restoring '" + this.old_value + "'");
        this.set(this.old_value);
    }

    clear_input() {
        if (this.get().length > this.old_len) {
            this.set(this.get().slice(0, this.old_len));
        }
    }
}

/**
 * Shell models a single process operating system, a GUI, and a userspace shell.
 */
class Shell {
    constructor (fs, parent) {
        this.filesystem = fs;
        this.current_dir = "/";
        this.umask = 0o644;
        this.prompt = (shell) => shell.current_dir + " $ ";
        this.history = [];
        this.history_index = -1;

        // if stdin_buffer is empty a reader can place a resolve here and wait for it to be resolved
        this.stdin_buffer = [];
        this.stdin = [];
        this.stdin_closed = false;
        this.reader = null;

        this.container = null;
        this.output = null;
        this.setup_container_and_output(parent);
    }

    /**
     * set up required DOM elements to display the shell
     */
    setup_container_and_output(parent) {
        var that = this;
        this.container = document.createElement("div");
        this.container.tabIndex = "0";
        this.container.style.maxHeight = "250px";

        this.output = new Output(this.container);

        this.setup_container_event_listeners();

        if (parent) {
            parent.appendChild(this.container);
            this.parent = parent;
        }

        // Set up event that will allow other elements to wait until the shell has started processing input
        this.initialized = new Promise(r => { that._init_resolver = r; });
    }

    setup_mobile_input() {
        if (this.mobile || this.disable_events)
            return;

        var that = this;

        this.mobile = {};

        this.mobile.close = document.createElement("button");
        this.mobile.close.innerHTML = "Close stdin";
        this.mobile.close.onclick = function(event) {
          that.process_input("d", true);
          stop_event(event);
        }

        this.container.appendChild(this.mobile.close);
    }

    destroy_mobile_input() {
        if (!this.mobile)
            return;

        this.mobile.close.remove();
        delete this.mobile;
    }

    setup_container_event_listeners() {
        var that = this;

        this.click_listner = function(e) {
            console.log(Boolean(that.mobile));
            if (isMobile.any()) {
                if(!that.mobile) {
                    that.setup_mobile_input();
                }
            }
        }

        this.container.addEventListener("click", this.click_listner, false);

        this.container.addEventListener("focusout", function (e) {
          if (isMobile.any()) {
              // TODO remove button only when necessary
              //that.destroy_mobile_input();
          }
        }, false);

        // TODO cleanup output event listener, consider making them all methods on the Output class
        this.keydown_listener = function(e) {
            that.output.update_old_info();

            if (that.process_input(e.key, e.ctrlKey)) {
                return stop_event(e);
            } else if (e.ctrlKey) {
                return;
            }

            that.output.fix_cursor_pos();
        }
        this.output.element.addEventListener("keydown", this.keydown_listener, false);

        this.input_listener = function (e) {
            if (that.disable_events || that.output.invalid_cursor_pos()) {
                return that.output.restore();
            }

            if (e.inputType.indexOf("delete") >= 0) {
                if (that.output.get().length < that.output.old_len) {
                    return that.output.restore();
                }
            }

            if (e.inputType.indexOf("insert") >= 0) {
                var old_value = that.output.get().slice(0, -1 * e.data.length);
                that.output.set_old_info(old_value);
            }
        }
        this.output.element.addEventListener("input", this.input_listener, false);

        this.disable_events = false;
    }

    remove_container_event_listeners() {
        var that = this;
        if (this.click_listner) {
            this.container.removeEventListener("click", this.click_listner, false);
            this.container.addEventListener("click", function(e) {
                that.container.blur();
                document.activeElement.blur();
            }, false);
        }

        this.disable_events = true;
    }

    simulate_input(input) {
        this.output.update_old_info();
        for (var c of input) {
            var key = c;
            if (key == "\n")
              key = "Enter";
            this.process_input(key, false);
            this.output.append(c);
        }
    }

    /**
     * Create GUI elements to get input
     */
    create_extended_input(content) {
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
        }

        this.extended_active.cancel_button = document.createElement("button");
        this.extended_active.cancel_button.innerText = "cancel";
        this.extended_active.cancel_button.onclick = function() {
            that.extended_active.cancelled = true;
            that.extended_active.resolve();
        }

        if (this.parent) {
            this.parent.appendChild(this.extended_active.input_box);
            this.parent.appendChild(this.extended_active.confirm_button);
            this.parent.appendChild(this.extended_active.cancel_button);

            this.extended_active.input_box.focus();
        }
    }

    /**
     * Block until output from GUI elements is availible then remove elements.
     */
    async get_extended_output_and_cleanup() {
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
    }

    async _load_coreutils(base_url) {
        if (!coreutils_promises) {
            coreutils_promises = possible_commands.map(x => import("./coreutils/" + x.name + ".js"));
        }

        for (let p of coreutils_promises) {
            await p;
        }
    }

    /**
     * Perform initialization that requires filesystem/blocking operations
     * This can't be completed by the time the constructor returns.
     */
    async init(base_url) {
        this.shellfs_root = "/.shellfs";
        this.shellfs = new ShellFS(this);

        var s = await this.filesystem.mkdir(this.shellfs_root, 0o777);
        s = await this.filesystem.mount(this.shellfs_root, this.shellfs);

        this.output_path = this.shellfs_root + "/stdout"
        this.error_path = this.shellfs_root + "/stderr"
        this.input_path = this.shellfs_root + "/stdin"

        this.stderr = await this.filesystem.open(this.error_path);

        await this._load_coreutils(base_url);
        this._init_resolver(); // resolve promise to unblock anything waiting on shell initialization
    }

    _update_reader() {
        if (this.reader) {
            this.reader();
            this.reader = null;
        }
    }

    get_history_backwards() {
        if (this.history.length && this.history_index >= 0) {
            var history_item = this.history[this.history_index].trim();
            this.history_index -= 1;
            return history_item;
        }
        return null;
    }

    get_history_forwards() {
        if (this.history.length && this.history_index < this.history.length) {
            if (this.history_index + 1 == this.history.length) {
                return ""; // return empty line to clear the current input
            } else {
                var history_item = this.history[this.history_index + 1].trim();
                this.history_index += 1;
                return history_item;
            }
        }
        return null;
    }

    /**
     * Process one character of input to be added to the stdin stream
     */
    process_input(key, ctrlkey) {
        if(ctrlkey) {
            if (key == 'd') {
                this.stdin_closed = true;
                this._update_reader();
                return true;
            }

            if (key == 'v') {
                this.output.fix_cursor_pos();
            }
            return false;

        } else if (key === "Enter") {
            var text = this.output.get().slice(this.output.old_len) + "\n";
            this.stdin = this.stdin.concat(Array.from(text));
            this.output.append("\n");
            this._update_reader();
            this.output.flush();
            return true;
        } else if (key === "Escape") {
            document.activeElement.blur();
            return true;
        } else if (key === "ArrowUp") {
            var history_input = this.get_history_backwards();
            if (history_input != null) {
                this.output.clear_input();
                this.output.append(history_input);
            }
            return true;
        } else if (key === "ArrowDown") {
            var history_input = this.get_history_forwards();
            if (history_input != null) {
                this.output.clear_input();
                this.output.append(history_input);
            }
            return true;
        }

        return false;
    }

    /**
     * Read and execute commands from stdin
     */
    async main(base_url) {
        await this.init(base_url);
        while (true) {
            this.output.flush();
            this.output.append(this.prompt(this));
            this.output.set_old_info(this.output.get());

            while (true) {
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
                break;
            }
        }
    }

    /**
     * Parse and run a command
     */
    async run_command(input) {
        var command = new Command(input);
        command.set_default_output(this.output_path);

        if (!command.arguments[0])
            return;

        // Prepare the output stream
        var command_output = this.expand_path(command.output)
        var open_flags = O_WRONLY | O_CREAT;
        if (command.append_output)
            open_flags |= O_APPEND;
        else
            open_flags |= O_TRUNC;

        command.output = await this.filesystem.open(command_output, open_flags, this.umask);
        if (typeof(command.output) === 'string')
            return this.return_error("Could not open " + command_output + " for writing");

        for (var i = 0; i < possible_commands.length; i++) {
            if (command.arguments[0] == possible_commands[i].name)
                return this['handle_' + possible_commands[i].name](command);
        }

        // Try to execute program as if it's own disk
        command.arguments.unshift("exec");
        return this['handle_exec'](command);
    }

    /**
     * Join two paths with "/" if necessary"
     */
    path_join(path1, path2) {
        if (path1.endsWith("/") && path2.startsWith("/"))
            return path1 + path2.slice(1);

        if (!path1.endsWith("/") && !path2.startsWith("/"))
            return path1 + "/" + path2;

        return path1 + path2;
    }


    /**
     * Expand the current path according to current working directory and resolve all '.' and '..'
     */
    expand_path(path) {
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

    /**
     * Print and return an error
     */
    async return_error(error) {
        await this.filesystem.write(this.stderr, str_to_bytes(
                "Error: " + error + "\n"));
        return error;
    }
}
