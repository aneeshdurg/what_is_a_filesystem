Shell.prototype.handle_ls = async function(command) {
    var argument = "";
    var output = " ";
    var show_hidden = false;
    var show_inodes = false;
    var show_detailed = false;

    var that = this;
    async function help() {
        const help_msg =
            "ls [options...] [path]\n" +
            "\t if path is empty, the current directory will be used instead\n" +
            "\t options can be 0 or more of the following:\n" +
            "\t\t-a show all files (including hidden files)\n" +
            "\t\t-i show inode numbers\n" +
            "\t\t-l show all information\n" +
            "\t\t-h show this help message\n";
        await that.filesystem.write(that.stderr, str_to_bytes(help_msg));
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
    if (typeof(curr_dir) === 'string')
        return this._return_error("Could not read dir '.' (" + curr_dir + ")");

    if (!show_hidden) {
        contents = contents.filter((x) => {
            return x.filename === '.' || x.filename === '..' || !x.filename.startsWith('.')
        });
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
    for (var i = 0; i < contents.length; i++) {
        output += await line_formatter(contents[i]) + "\n";
    }

    await this.filesystem.write(command.output, str_to_bytes(output));
}
