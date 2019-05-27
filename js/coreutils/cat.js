Shell.prototype.handle_cat = async function(command) {
    if (command.arguments.length < 2)
        command.arguments.push(this.input_path);

    for (var i = 1; i < command.arguments.length; i++) {
        var filepath = this.expand_path(command.arguments[i]);
        var file = await this.filesystem.open(filepath, O_RDONLY);
        if (typeof(file) === 'string')
            return this._return_error(
                'Could not open file ' + command.arguments[i] + ' (' + file + ')');

        var bufferlen = 16;
        var out_is_stdout = await this.filesystem.ioctl(command.output, IOCTL_IS_TTY);
        out_is_stdout = typeof(out_is_stdout) === 'number' && out_is_stdout == 0;

        var in_is_stdin = await this.filesystem.ioctl(file, IOCTL_IS_TTY);
        in_is_stdin = typeof(in_is_stdin) === 'number' && in_is_stdin == 0;

        if (out_is_stdout && in_is_stdin) {
            bufferlen = 1; // interactive mode
            console.log("Detected interactive mode");
        }
        var buffer = new Uint8Array(new ArrayBuffer(bufferlen));


        var bytes_read = 0;
        do {
            var bytes_read = await this.filesystem.read(file, buffer);
            if (typeof(bytes_read) === 'string')
                return this._return_error(
                    'Could not read file ' + command.arguments[i] + ' (' + bytes_read + ')');

            var write_buffer = new Uint8Array(buffer.buffer, 0, bytes_read);
            await this.filesystem.write(command.output, write_buffer);
        } while (bytes_read);
    }
};
