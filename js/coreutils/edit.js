// TODO mention this in some page
Shell.prototype.handle_edit = async function (command) {
    async function help() {
        const help_msg =
            "edit path\n" +
            "\t Opens the file at `path` for editing.\n";
        await this.filesystem.write(this.stderr, str_to_bytes(help_msg));
    }

    var improper = command.arguments.length != 2;
    if (improper || command.arguments.slice(1).findIndex(x => x == '-h') > 0) {
        await help.call(this);
        return 0;
    }

    var path = this.expand_path(command.arguments[1]);
    var filesize = 0;
    var info = await this.filesystem.stat(path);
    if (typeof(info) === 'string') {
        if (info !== 'ENOENT') {
            return this._return_error(info);
        }
    } else {
        filesize = info.filesize;
    }

    var file = await this.filesystem.open(path, O_RDWR | O_CREAT, this.umask);
    if (typeof(file) === 'string')
        return this._return_error(file);

    var file_buffer = new Uint8Array(new ArrayBuffer(filesize));
    var bytes_read = await this.filesystem.read(file, file_buffer);
    if (typeof(bytes_read) === 'string')
        return this._return_error(bytes_read);

    this.create_extended_input(bytes_to_str(file_buffer));
    var new_data = await this.get_extended_output_and_cleanup();
    if (typeof(new_data) !== 'string') {
        await this.filesystem.write(this.stderr, str_to_bytes(
            "Cancelled\n"));
        return 0;
    }

    await this.filesystem.seek(file, 0, SEEK_SET);
    console.log(file);
    var bytes_written = await this.filesystem.write(file, str_to_bytes(new_data));
    if (typeof(bytes_written) === 'string')
        return this._return_bytes_written("Could not write to file (" + bytes_written + ")");
    await this.filesystem.write(this.stderr, str_to_bytes(
        "Wrote " + bytes_written + " bytes to " + command.arguments[1] + "\n"));

    await this.filesystem.close(file);
    var error = await this.filesystem.truncate(path, new_data.length);
    if (typeof(error) === 'string')
        return this._return_error("Could not truncate file (" + error + ")");

    return 0;
}
