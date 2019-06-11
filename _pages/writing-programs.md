---
layout: default
title: "Writing Programs (and filesystems)"
hide_toc: true
---

If you've stumbled upon this page you're probably trying to write your own programs in the simulator.
There's a couple things you'll need to know:

1. If possible, try writing real programs on a linux system.
There's a whole lot of things to learn that our simulator doesn't support (like shebang lines).
2. The maximum filesize on the default filesystem is 288B.
If you want to play around with bigger files (you'll almost certainly need to if you want to implement a filesystem),
use `MemFS` in [section 10]({{ '/pages/10-mounting.html#memfs' | relative_url }}).
Click on `Load MemFS from solutions` to get a shell where the default filesystem has no restriction on filesize.
3. The easiest way to write content into files from the simulator is using our simulator's `edit` utility.

With that out of the way, let's get started!

## The skeleton of a program

Your program should be an `async` function wrapped in parentheses. A sample program may look like this:

```javascript
(async function (command){
    await this.filesystem.write(command.output, str_to_bytes("hello world!\n"));
    return 0;
})
```
By convention, `return 0` indicates that everything went well.
To return an error, either use the `throw` keyword in javascript, or call `this._return_error(error_msg_str)`.

## The shell object

Your program will be executed under the context of the shell.
This means that `this` will refer to an instance of `Shell` from [/js/shell.js]({{ '/js/shell.js' | relative_url }}).

Below is a description of all availible attributes/functions you may use.
Note that names with parentheses next to them are functions.

<details><summary><b>this.filesystem</b></summary>
<div markdown="1">
This object is a filesystem (instance of `DefaultFS`).
See the section on interacting with the filesystem below.
</div>
</details>

<details><summary><b>this.current_dir</b></summary>
<div markdown="1">
This variable tells you what the current working directory is.
</div>
</details>

<details><summary><b>this.umask</b></summary>
<div markdown="1">
If you're creating a new file and don't know what permissions to give it, just set it's mode to be the `umask`.
</div>
</details>

<details><summary><b>this.input_path</b></summary>
<div markdown="1">
The absolute path from with you should read for input (i.e. `stdin`).
Note that these reads may block so you should use `await` on the read call.
See the section on interacting with the filesystem below.
</div>
</details>

<details><summary><b>this.output_path</b></summary>
<div markdown="1">
Path which points to the shell's `stdout`.
Note that this may not be the same as your program's output!
Use `command.output` instead.
See the section on the command object instead.
</div>
</details>

<details><summary><b>this.error_path</b></summary>
<div markdown="1">
The path to the shell's `stderr`.
Use `this.stderr` instead as that is an already open handle to the error path.
</div>
</details>

<details><summary><b>this.stderr</b></summary>
<div markdown="1">
An instance of `FileDescriptor` where you should write all error/debugging output.
See the section on interacting with the filesystem below.
</div>
</details>

<details><summary><b>this.create_extended_input(content)</b></summary>
<div markdown="1">
Create a `<textarea>` to allow a user to have a GUI text editor like `edit`.
To actually read that input see `this.get_extended_output_and_cleanup`.

To pass in some initial text to populate the `<textarea>` with, pass in a string as `content`.
</div>
</details>

<details><summary><b>this.get_extended_output_and_cleanup()</b></summary>
<div markdown="1">
Wait for the user to press `save` or `cancel`.
Returns the contents of the `<textarea>` if the user pressed `save` and `null` if the user pressed `cancel`.

This function may block, so call it with `await`.
</div>
</details>

<details><summary><b>this.run_command(input)</b></summary>
<div markdown="1">
Interpret a string (`input`) as though it had been run on the command line and return the output of the program that is run.
</div>
</details>

<details><summary><b>this.path_join(path1, path2)</b></summary>
<div markdown="1">
Joins two paths and removes/adds any necessary `/`s.
</div>
</details>

<details><summary><b>this.expand_path(path)</b></summary>
<div markdown="1">
Turns a relative path into an absolute path.
Expands a path by looking at the current directory and resolve any `.` and `..`s encounted along the way.

Note that this doesn't check if the path actually corresponds to a file on the filesystem.
</div>
</details>

<details><summary><b>this._return_error(error)</b></summary>
<div markdown="1">
Write a string (`error`) to `stderr` and return that string.
</div>
</details>

## Interacting with the filesystem

The shell's filesystem is accessible to your function via the `this.filesystem` variable.

One thing we haven't mentioned is that in our simulator all filesystem operations are assumed to be asynchronous.
This is to allow for things like simulated disk delay in the animated filesystem interactions,
or to allow for blocking reads from `stdin` in the simulator.

Anytime you access the filesystem, use the keyword `await` right before the function you wanted to call.

For example, the following program tries to read 5 chars from `stdin` and writes the characters read to both `stdout` and `stderr`.

```javascript
(async function(command) {
    var fd = await this.filesystem.open(this.input_path, O_RDONLY);
    // Let's make sure that we opened stdin correctly
    if (typeof(fd) === 'string')
        return this._return_error(fd);

    var buffer = new Uint8Array(new ArrayBuffer(5));

    // perform the read and check for errrors
    var bytes_read = await this.filesystem.read(fd, buffer);
    if (typeof(bytes_read) === 'string')
        return this._return_error(bytes_read);

    // create a "view" of the buffer that only has the initialized bytes
    var read_view = new Uint8Array(buffer.buffer, 0, bytes_read);

    // write some debugging messages to stderr
    // I've ignored the error checking on the writes.
    await this.filesystem.write(this.stderr, str_to_bytes("Read " + bytes_read + " bytes:\n"));
    await this.filesystem.write(this.stderr, read_view);
    await this.filesystem.write(this.stderr, "\n"));

    // write our output to stdout
    await this.filesystem.write(command.output, read_view));

    // everything was ok!
    return 0;
})
```

## The command object

You might have noticed that all our programs so far have been taking a parameter `command`,
and some have even been grabbing a `FileDescriptor` corresponding to `stdout` from `command.output`.

The `command` object gives us a way to interact with specified command parameters.
Let's look at how you can construct/use it.

<details><summary><b>[Constructor] Command(input, stdout_path)</b></summary>
<div markdown="1">
The constructor for `Command` which takes in a line of input and a path to set as `stdout`.
</div>
</details>

<details><summary><b>this.input</b></summary>
<div markdown="1">
The original line of input passed to the constructor
</div>
</details>

<details><summary><b>this.output</b></summary>
<div markdown="1">
The object returned by a constructor will store the output path here.

If you invoke a program via `run_command` this object will be an instance of `FileDescriptor`,
opened with `O_WRONLY` and if `this.append_output` is set, with `O_APPEND` otherwise with `O_TRUNC`.
</div>
</details>

<details><summary><b>this.append_output</b></summary>
<div markdown="1">
Specifies whether output should be appended or overwritten on the output path.
</div>
</details>

<details><summary><b>this.arguments</b></summary>
<div markdown="1">
A list of command line arguments passed to the program.
Note that `command.arguments[0]` is the name of the running program.
</div>
</details>

## Writing a filesystem as a program

Full disclaimer, it's probably a better idea to go learn how to write a real POSIX filesystem that can run on something like linux or macOS for a number of reasons.

1. It's a better learning experience and you'll either learn a ton about [kernel modules](http://accelazh.github.io/filesystem/Writing-a-Kernel-Filesystem) or about [FUSE](https://github.com/libfuse/libfuse), or generally,
   about some well documented, relevant, and useful software stack.
2. It's cooler and easier to show off to people.
3. It'll give you the experience required to use these skills to work on bigger and better projects.
4. There's FUSE bindings to just about every language [(like fusepy for python)](https://github.com/fusepy/fusepy)
so you don't have to be locked into a gross language like `javascript`
or forced to write a bunch of boiler plate code in `c` (although I would reccomend doing it in `c` anyway).

Assuming you don't have the necessary resources/motivation to do it with legit libraries or you've got an hour or so to kill,
continue trying to implement your own filesystem for our simulator.
Don't say I didn't warn you.

To implement a filesystem for mounting, writing a program that returns a filesystem when run.

To see more information on how to write a filesystem, read [/pages/filesystem-operations.html]({{ '/pages/filesystem-operations.html' | relative_url }})
and [/pages/10-mounting.html]({{ '/pages/10-mounting.html' | relative_url }}).

Then run `mount path [path_to_fs_program_filename]` to mount your filesystem.
It may look something like this:

```javascript
(async function (command) {
    function SampleFS() {}
    inherit(SampleFS, DefaultFS);

    SampleFS.prototype.readdir = function() {
        console.log("Hello world!");
        return [ new Dirent(0, '.'), new Dirent(0, '..')];
    };

    return (new SampleFS());
})
```
