Shell.prototype.handle_rm = async function(command) {
  var recurse = false;
  var offset = 1;
  if (command.arguments[1] === "-r") {
    recurse = true;
    offset += 1;
  }

  for (var i = offset; i < command.arguments.length; i++) {
    var path = this.expand_path(command.arguments[i]);
    var info = await this.filesystem.stat(path);
    if (typeof(info) === 'string') {
      return this._return_error("Could not delete " + path + "(" + info + ")");
    }

    var error = null;
    if (!info.is_directory) {
      error = await this.filesystem.unlink(path);
    } else if (recurse) {
      var dir_contents = await this.filesystem.readdir(path);
      if (typeof(dir_contents) === 'string')
        return this._return_error(dir_contents);
      // Remove the '.' and '..' entries
      dir_contents = dir_contents.slice(2);

      var that = this;
      var filenames = dir_contents.map(x => that.path_join(path, x.filename));

      var old_args = command.arguments;
      command.arguments = command.arguments.slice(0, 2).concat(filenames);

      if (typeof(await this.handle_rm(command)) === 'string')
        return "";
      command.arguments = old_args;

      error = await this.filesystem.unlink(path);
    } else {
      error = "Could not delete directory! Please use the -r flag!";
    }

    if (typeof(error) === 'string')
      return this._return_error(error);
  }
}
