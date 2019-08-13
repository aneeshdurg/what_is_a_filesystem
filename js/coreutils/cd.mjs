import {Shell} from '../shell.mjs'

Shell.prototype.handle_cd = async function(command) {
    if (command.arguments.length == 1)
        return this.return_error("cd expects an argument!");

    if (command.arguments.length > 2)
        return this.return_error("Too many arguments to cd!");

    var path = this.expand_path(command.arguments[1]);
    var info = await this.filesystem.stat(path);
    var error = null;
    if (typeof(info) === 'string') {
        error = info;
    } else if (!info.is_directory) {
        error = "ENOTDIR";
    } else if (!(info.mode & 0o100)) {
        error = "ENOPERM";
    }

    if (error)
        return this.return_error(error);

    this.current_dir = path;
}
