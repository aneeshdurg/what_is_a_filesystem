Shell.prototype.handle_exec = async function(command) {
    command.arguments.shift();
    console.log(command);
    var path = this.expand_path(command.arguments[0]);
    var file = await this.filesystem.open(path, O_RDONLY);
    if (typeof(file) === 'string')
        return this.return_error("Invalid command");

    var info = await this.filesystem.stat(path);
    if (typeof(info) === 'string')
        return this.return_error("Could not stat " + path);
    else if (!(info.mode & 0o100))
        return this.return_error("Could not execute " + path);

    var file_buffer = new Uint8Array(new ArrayBuffer(info.filesize));
    var bytes_read = await this.filesystem.read(file, file_buffer);
    if (typeof(bytes_read) === 'string')
        return this.return_error(bytes_read);

    try {
        console.log(bytes_to_str(file_buffer));
        var program = eval(bytes_to_str(file_buffer));
        return await program.call(this, command);
    } catch (e) {
        return this.return_error(e.message);
    }
}
