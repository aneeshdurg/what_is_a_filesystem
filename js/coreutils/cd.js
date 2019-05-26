Shell.prototype.handle_cd = async function(command) {
    if (command.arguments.length == 1)
        return this._return_error("cd expects an argument!");

    if (command.arguments.length > 2)
        return this._return_error("Too many arguments to cd!");

    var path = this.expand_path(command.arguments[1]);
    var info = await this.filesystem.stat(path);
    var error = null;
    if (typeof(info) === 'string') {
        error = info;
    } else if (!info.is_directory) {
        // TODO also check execute permission
        error = "ENOTDIR";

    }

    if (error)
        return this._return_error(error);

    this.current_dir = path;
}
