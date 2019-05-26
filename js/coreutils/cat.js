Shell.prototype.handle_cat = async function(command) {
    if (command.arguments.length < 2)
        command.arguments.push(this.input_path);

    for (var i = 1; i < command.arguments.length; i++) {
        var bufferlen = 16;
        var out_is_stdout = this.fd_is_stdout(command.output);
        if (out_is_stdout && command.arguments[i] == this.input_path) {
            bufferlen = 1; // interactive mode
            console.log("Detected interactive mode");
        }
        var buffer = new Uint8Array(new ArrayBuffer(bufferlen));

        var filepath = this.expand_path(command.arguments[i]);
        var file = await this.filesystem.open(filepath, O_RDONLY);
        if (typeof(file) === 'string')
            this._return_error(
                'Could not open file ' + command.arguments[i] + ' (' + file + ')');

        var bytes_read = 0;
        do {
            var bytes_read = await this.filesystem.read(file, buffer);
            if (typeof(bytes_read) === 'string') {
                this._return_error(
                    'Could not read file ' + command.arguments[i] + ' (' + bytes_read + ')');
                break;
            }

            var write_buffer = new Uint8Array(buffer.buffer, 0, bytes_read);
            await this.filesystem.write(command.output, write_buffer);
        } while (bytes_read);
    }
};
