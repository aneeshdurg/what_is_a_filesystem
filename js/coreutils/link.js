import {Shell} from '../shell.mjs'

import {str_to_bytes} from '../fs_helper.mjs'

Shell.prototype.handle_link = async function(command) {
    async function usage() {
        const help_msg =
            "link path1 path2\n" +
            "	Make a hard link to path1 at path2\n";
        await this.filesystem.write(this.stderr, str_to_bytes(help_msg));
    }

    if (command.arguments.length == 2 && (
        command.arguments[1] == "--help" || command.arguments[1] == "-h")) {
        return usage.call(this);
    } else if (command.arguments.length != 3) {
        return usage.call(this);
    }

    var path1 = this.expand_path(command.arguments[1]);
    var path2 = this.expand_path(command.arguments[2]);

    var error = await this.filesystem.link(path1, path2);
    if  (typeof(error) === 'string')
        return this.return_error(error);
}
