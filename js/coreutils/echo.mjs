import {Shell} from '../shell.mjs'
import {str_to_bytes} from '../fs_helper.mjs'

Shell.prototype.handle_echo = async function(command) {
    var error = null;
    for (var i = 1; i < command.arguments.length; i++) {
        error = await this.filesystem.write(command.output, str_to_bytes(command.arguments[i]));
        if (typeof(error) === 'string')
            this.return_error(error);
        if (i != (command.arguments.length - 1))
            error = await this.filesystem.write(command.output, str_to_bytes(" "));

    }
    error = await this.filesystem.write(command.output, str_to_bytes("\n"));
    if (typeof(error) === 'string')
        this.return_error(error);
};
