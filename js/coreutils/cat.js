import {Shell} from '../shell.js'

Shell.prototype.handle_cat = async function(command) {
    var prog_name = command.arguments.shift();
    command.arguments.unshift("-c", "-1")
    command.arguments.unshift(prog_name)
    return this.handle_hexdump_or_read(command);
};
