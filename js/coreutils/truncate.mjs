import {Shell} from '../shell.mjs'

import {str_to_bytes} from '../fs_helper.mjs'

Shell.prototype.handle_truncate = async function(command) {;
    async function usage() {
        var help_msg =
            "truncate filename filesize\n" +
            "	Truncate or extend filename to be filesize bytes long\n";
        await this.filesystem.write(this.stderr, str_to_bytes(help_msg));
    }

    if (command.arguments.length != 3)
        return usage.call(this);

    var path = command.arguments[1];
    path = this.expand_path(path);

    var filesize = Number(command.arguments[2]);
    if (!(filesize >= 0)) {
        return this.return_error("filesize must be a number >= 0");
    }

    var error = await this.filesystem.truncate(path, filesize);
    if (typeof(error) === 'string')
        return this.return_error(error);

    return 0;
}
