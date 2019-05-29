Shell.prototype.handle_stat = async function(command) {
    if (command.arguments.length != 2) {
        this._return_error("stat expects a single filename!");
    }

    var path = this.expand_path(command.arguments[1]);
    var info = await this.filesystem.stat(path);

    var stat_str = "File: " + command.arguments[1] + "\n";
    stat_str += "Type: " + (info.is_directory ? "directory" : "regular file") + "\n";
    stat_str += "Size: " + info.filesize + "B\n";
    stat_str += "Access: 0o" + info.mode.toString(8) + "\n";

    atim = new Date(info.atim);
    stat_str += "Access: " + atim.toDateString() + " " + atim.toTimeString() + "\n";
    mtim = new Date(info.mtim);
    stat_str += "Modify: " + mtim.toDateString() + " " + mtim.toTimeString() + "\n";
    ctim = new Date(info.ctim);
    stat_str += "Change: " + ctim.toDateString() + " " + ctim.toTimeString() + "\n";

    var error = this.filesystem.write(command.output, str_to_bytes(stat_str));
    if (typeof(error) === 'string')
        this._return_error(error);
}
