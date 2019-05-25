function Command(input) {
    this.input = input;
    this.parse();
}

Command.prototype.parse = function() {
    this.input;
}

function Shell(fs) {
    this.filesystem = fs;
    this.current_dir = "/";
}

Shell.prototype.run_command  = function (command) {
    command = new Command(command);
    if (command.arguments[0] == "ls") {
        var argument = "";
        var output = " ";
        if (command.arguments.length == 1) {
            command.arguments.push_back(".")
        }

        for (var i = 1; i < command.arguments.length; i++) {
            var path = this.expand_path(command.arguments[i]);
            this.filesystem.readdir(path);
        }

        if (command.output == "")
            this.add_output(output);
        else {
            var file = this.filesystem.open(this.expand_path(command.output));
            if (file.error != null) {
                this.add_error("Failed to open " + command.output);
                this.add_error(file.error);
                return;
            }
            this.filesystem.write(fd, output);
        }
    }
}
