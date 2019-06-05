Shell.prototype.handle_umount = async function(command) {
    async function help() {
        const help_msg =
            "umount path\n" +
            "\t Unmounts `path` if mounted.\n";
        await this.filesystem.write(this.stderr, str_to_bytes(help_msg));
    }

    var improper = command.arguments.length != 2;
    if (improper || command.arguments.slice(1).findIndex(x => x == '-h') > 0) {
        await help.call(this);
        return 0;
    }

    var path = this.expand_path(command.arguments[1]);
    var error = await this.filesystem.umount(path);
    if (typeof(error) === 'string')
        return this._return_error("Could not unmount " + path + " (" + error + ")");

    return 0;
}
