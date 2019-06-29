Shell.prototype.handle_clear = async function(command) {
    var out_is_stdout = await this.filesystem.ioctl(command.output, IOCTL_IS_TTY);
    if (out_is_stdout != 0)
        return 1;

    var terminal = this.output.element;
    // TODO turn this into an IOCTL call?
    var lines = Math.ceil(terminal.scrollHeight / parseFloat(getComputedStyle(terminal)['font-size']))
    console.log("Clearing", lines, "lines");
    for (var i = 0; i < lines; i++) {
        var error = await this.filesystem.write(command.output, str_to_bytes("\n"));
        if (typeof(error) === 'string')
            this.return_error("Could not clear screen (" + error + ")");
    }
    return 0;
};
