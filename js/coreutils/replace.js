Shell.prototype.handle_replace = async function(command) {
    if (command.arguments.length != 3) {
        const usage =
            "replace str1 str2\n" +
            "\treplaces str1 in input by str2 in output\n";
        await this.filesystem.write(this.stderr, str_to_bytes(usage));
    }

    var input_file = await this.filesystem.open(this.input_path, O_RDONLY);

    var bufferlen = 16;
    var out_is_stdout = await this.filesystem.ioctl(command.output, IOCTL_IS_TTY);
    out_is_stdout = out_is_stdout === 0;

    var in_is_stdin = await this.filesystem.ioctl(input_file, IOCTL_IS_TTY);
    in_is_stdin = in_is_stdin === 0;

    if (out_is_stdout && in_is_stdin) {
        bufferlen = 1; // interactive mode
        console.log("Detected interactive mode");
    }
    var buffer = new Uint8Array(new ArrayBuffer(bufferlen));


    var bytes_read = 0;
    var write_buffer = "";
    do {
        var bytes_read = await this.filesystem.read(input_file, buffer);

        var read_buffer = new Uint8Array(buffer.buffer, 0, bytes_read);
        write_buffer += bytes_to_str(read_buffer);
    } while (bytes_read);

    console.log(write_buffer);
    while (write_buffer.indexOf(command.arguments[1]) > 0) {
        console.log(write_buffer);
        write_buffer = write_buffer.replace(command.arguments[1], command.arguments[2]);
    }

    await this.filesystem.write(command.output, str_to_bytes(write_buffer));
};
