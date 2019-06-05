// TODO implement mount

Shell.prototype.handle_mount = async function(command) {
    async function help() {
        const help_msg =
            "mount path filesystem\n" +
            "\t mounts `filesystem` at `path`.\n" +
            "\t`path` must be a directory.\n" +
            "\t`filesystem` must be a valid, global,\n" +
            "\tjavascript object that is an instance of DefaultFS.\n";
        await this.filesystem.write(this.stderr, str_to_bytes(help_msg));
    }

    var improper = command.arguments.length != 3;
    if (improper || command.arguments.slice(1).findIndex(x => x == '-h') > 0) {
        await help.call(this);
        return 0;
    }

    var path = this.expand_path(command.arguments[1]);
    var filesystem = command.arguments[2];
    var info = await this.filesystem.stat(path);
    if (typeof(info) === 'string')
        return this._return_error(info);

    if (!info.is_directory)
        return this._return_error(path + "is not a directory!");

    var that = this;
    var should_exec = true;
    var fs = (function() {
        try {
            var FS = eval(filesystem);
            var newfs = new FS();
            return newfs;
        } catch (e) {
            var fs_path = that.expand_path(filesystem);
            var fs_info = that.filesystem.stat(fs_path);
            if (typeof(fs_info) === 'string')
                return e.message + "\n\n" + e.stack;

            return should_exec;
        }
    })();

    if (typeof(fs) === 'string')
        return this._return_error(fs);

    if (fs == should_exec) {
        var fs_path = that.expand_path(filesystem);
        // TODO allow arguments to be passed in
        var exec_command = new Command("exec " + fs_path);
        fs = await this.handle_exec(exec_command);
        if (typeof(fs) === 'string')
            return "";
    }

    if (!(fs instanceof DefaultFS))
        return this._return_error(filesystem + " is not an instance of DefaultFS!");

    var error = await this.filesystem.mount(path, fs);
    if (typeof(error) === 'string')
        return this._return_error(error);

    return 0;
}
