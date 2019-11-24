import {Shell, possible_commands} from '../shell.mjs'

import {str_to_bytes} from '../fs_helper.mjs'

Shell.prototype.handle_help = async function(command) {
    var help_msg = "The following commands are availible:\n" +
        "(some commands have additional help text when run with the `-h` flag)\n";
    for (const possible_command of possible_commands) {
        help_msg += possible_command.name + ":\n" + possible_command.description + "\n";
    }

    var error = await this.filesystem.write(command.output, str_to_bytes(help_msg));
    if (typeof(error) === 'string')
        return this.return_error(error);

    return 0;
}
