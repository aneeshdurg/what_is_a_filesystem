import {Shell} from '../shell.mjs'

import {CONSTANTS} from '../defs.mjs'
import {bytes_to_str} from '../fs_helper.mjs'

// Import everything so programs exec'd from the filesystem have access to it by
// default
import * as fs_helper from '../fs_helper.mjs'
import * as defs from '../defs.mjs'
import * as fs from '../fs.mjs'
import * as lfs from '../lfs.mjs'
import * as myfs from '../myfs.mjs'
import * as shell from '../shell.mjs'

Shell.prototype.handle_exec = async function(command) {
    command.arguments.shift();
    if (command.arguments.length == 0)
        return this.return_error("Invalid command: '" + command.arguments + "'");

    var path = this.expand_path(command.arguments[0]);
    var file = await this.filesystem.open(path, CONSTANTS.O_RDONLY);
    if (typeof(file) === 'string')
        return this.return_error("Invalid command: '" + command.arguments + "'");

    var info = await this.filesystem.stat(path);
    if (typeof(info) === 'string')
        return this.return_error("Could not stat " + path);
    else if (!(info.mode & 0o100))
        return this.return_error("Could not execute " + path);

    var file_buffer = new Uint8Array(new ArrayBuffer(info.filesize));
    var bytes_read = await this.filesystem.read(file, file_buffer);
    if (typeof(bytes_read) === 'string')
        return this.return_error(bytes_read);

    try {
        var program = eval(bytes_to_str(file_buffer));
        return await program.call(this, command);
    } catch (e) {
        return this.return_error(e.message);
    }
}
