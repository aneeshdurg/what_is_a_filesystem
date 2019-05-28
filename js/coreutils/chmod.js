Shell.prototype.handle_chmod = async function(command) {
    async function help_msg() {
        const help_msg =
            "chmod permissions filename\n" +
            "\tmodify permissions of filename to be permissions\n";
        await this.filesystem.write(this.stderr, str_to_bytes(help_msg));
        return 0;
    }

    if (command.arguments.length != 3)
        return help_msg.call(this);

    var path = this.expand_path(command.arguments[2]);
    var permissions = Number(command.arguments[1]);
    if (!(permissions >= 0)) {
        return this._return_error("Invalid permissions: " + permissions);
    }

    var error = await this.filesystem.chmod(path, permissions);
    if (typeof(error) === 'string')
        return this._return_error(error);

    return 0;
};
