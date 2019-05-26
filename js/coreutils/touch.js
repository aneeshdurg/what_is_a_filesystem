// TODO revisit this when mtim is implemented
Shell.prototype.handle_touch = async function(command) {
    if (command.arguments.length < 2)
        return this._return_error("touch requires a filename!");

    for (var i = 1; i < command.arguments.length; i++) {
        var error = await this.filesystem.create(
            this.expand_path(command.arguments[i]), this.umask);
        if (typeof(error) === 'string' && error != 'EEXISTS')
            return this._return_error(
                "Could not touch file " + command.arguments[i] + " (" + error + ")");
    }
}
