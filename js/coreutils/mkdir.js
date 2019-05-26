Shell.prototype.handle_mkdir = async function (command) {
    var errors = "";
    for (var i = 1; i < command.arguments.length; i++) {
        var path = this.expand_path(command.arguments[i]);
        var output = await this.filesystem.mkdir(path, 0o777);
        if (typeof(output) === 'string') {
            errors += "Error creating directory '" + command.arguments[i] + "':";
            errors += "\n\t" + output + "\n";
        }
    }

    if (errors)
        return this._return_error(error);
}
