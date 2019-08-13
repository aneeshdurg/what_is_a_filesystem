import {Shell} from '../shell.mjs'

Shell.prototype.handle_read = async function(command) {
    // Make sure we have the right prog name
    command.arguments[0] = "read";

    // see hexdump.js
    return this.handle_hexdump_or_read(command);
}
