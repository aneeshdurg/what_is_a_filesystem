import {Shell} from '../shell.js'

import {CONSTANTS} from '../defs.js'

Shell.prototype.handle_touch = async function(command) {
    if (command.arguments.length < 2)
        return this.return_error("touch requires a filename!");

    for (var i = 1; i < command.arguments.length; i++) {
        var path = this.expand_path(command.arguments[i]);
        var error = await this.filesystem.create(path, this.umask);
        if (typeof(error) === 'string') {
            if(error == 'EEXISTS') {
                error = await this.filesystem.open(path, CONSTANTS.O_ACCESS);
                if (typeof(error) !== 'string')
                    error = null;
            }

            if (error)
                return this.return_error(
                    "Could not touch file " + command.arguments[i] + " (" + error + ")");
        }
    }
    return 0;
}
