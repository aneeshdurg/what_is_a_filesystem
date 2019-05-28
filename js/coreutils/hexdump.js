Shell.prototype.handle_hexdump = async function(command) {
    // Make sure we have the right prog name
    command.arguments[0] = "hexdump";
    return this.handle_hexdump_or_read(command);
}

Shell.prototype.handle_hexdump_or_read = async function(command) {
    var _bytes_to_read = -1;
    if (command.arguments.length >= 3 && command.arguments[1] == '-c') {
        // TODO implement fixed byte read.
        var prog_name = command.arguments.shift();
        command.arguments.shift();
        _bytes_to_read = Number(command.arguments.shift()) || 0;

        // Push prog_name back to front
        command.arguments.unshift(prog_name);
    };

    if (command.arguments.length < 2)
        command.arguments.push(this.input_path);


    for (var i = 1; i < command.arguments.length; i++) {
        var bytes_to_read = _bytes_to_read;
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
        }
        var buffer = new Uint8Array(new ArrayBuffer(bufferlen));


        var bytes_read = 0;
        do {
            if (bytes_to_read > 0 && bufferlen != Math.min(bufferlen, bytes_to_read))
                buffer = new Uint8Array(new ArrayBuffer(Math.min(bufferlen, bytes_to_read)));

            var bytes_read = await this.filesystem.read(file, buffer);
            if (typeof(bytes_read) === 'string')
                return this._return_error(
                    'Could not read file ' + command.arguments[i] + ' (' + bytes_read + ')');

            var write_buffer = null;
            if (command.arguments[0] == 'hexdump') {
                write_buffer = "";
                for (var c = 0; c < bytes_read; c++) {
                    var hex_byte = buffer[c].toString(16).toUpperCase();
                    // Add leading '0' if necessary
                    write_buffer += hex_byte.padStart(2, '0');
                }

                write_buffer = str_to_bytes(write_buffer);
            } else {
                write_buffer = new Uint8Array(buffer.buffer, 0, bytes_read);
            }
            await this.filesystem.write(command.output, write_buffer);
            if (bytes_to_read > 0)
                bytes_to_read -= bytes_read;

        } while (bytes_read > 0 && bytes_to_read != 0);
        if (command.arguments[0] == 'hexdump')
            await this.filesystem.write(command.output, str_to_bytes("\n"));
    }
}
