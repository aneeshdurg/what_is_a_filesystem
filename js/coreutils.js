Shell.prototype.handle_cd = async function(command) {
    if (command.arguments.length > 2) {
        command.stderr = "Too many arguments to cd!";
    }

    var path = this.expand_path(command.arguments[1]);
    var info = await this.filesystem.stat(path);
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
    var contents = await this.filesystem.readdir(path);

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

    if (!show_hidden)
        contents = contents.filter(x => !x.filename.startsWith('.'));

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

// TODO revisit this when mtim is implemented
Shell.prototype.handle_touch = async function(command) {
    console.log("Called touch", command);
    if (command.arguments.length < 2)
        await this.filesystem.write(command.output, str_to_bytes(
            "touch requires a filename!\n"));
    for (var i = 1; i < command.arguments.length; i++) {
        var error = await this.filesystem.create(this.expand_path(command.arguments[i]), this.umask);
        if (typeof(error) === 'string' && error != 'EEXISTS')
            await this.filesystem.write(command.output, str_to_bytes(
                "Error touching file " + command.arguments[i] + ": " + error + "\n"));
    }
}
