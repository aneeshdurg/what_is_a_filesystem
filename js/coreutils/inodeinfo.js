Shell.prototype.handle_inodeinfo = async function(command) {
    if (command.arguments.length != 2) {
        return this._return_error("inodeinfo expects exactly one filename as an argument!");
    }

    var path = this.expand_path(command.arguments[1]);
    var file = await this.filesystem.open(path, O_RDONLY);
    if (typeof(file) === 'string')
        return this._return_error("Could not open " + command.arguments[1] + "(" + file + ")");

    var error = await this.filesystem.ioctl(file, IOCTL_SELECT_INODE);
    if (typeof(error) === 'string')
        return this._return_error(error);

    return 0;
}
