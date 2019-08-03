---
layout: post
title: "Mounting and managing filesystems"
---

## What is __mounting__?

Up to this point, we've been looking at filesystems as a means of storing and accessing data, and we've discussed the filesystem interface in great detail,
 but we haven't considered how to actually spawn a filesystem or how filesystems can interact with each other.

It should be no surprised that most operating systems have the ability to manage multiple filesystems at a given time.
For example, most pen drives are formatted to `FAT32` or `NTFS`, but linux systems, which usually use `ext4` as their native filesystem, can still interact with data on these pen drives.
This is possible in a sane manner thanks to the ability to `mount` a filesystem.

Mounting a filesystem generally refers to spawnning an instance of a filesystem, initializing it, and then assigning it a path on top of your existing file tree.
Generally, in order to ensure that the paths you assign to a filesystem make sense, you need to have a pre-existing file or directory that you can set as the `mountpoint`.
This is achieved either via the `mount` system call, or the `mount` utility.

With something like `FUSE` that operates in userspace, when mounted, a program is started in userspace which handles all the filesystem callbacks.

You can see an example of how we implemented mounting in our simulator at this file: [/js/lfs.js]({{ '/js/lfs.js' | relative_url }}).

## Writing our own filesystem!

<script src="{{ '/js/merge_memfs.js' | relative_url }}"></script>

Way back in [section 3]({{ '/_pages/03-file-api.html' | relative_url }}) you wrote a mini filesystem that provided a single virtual file and implemented `read` and `write` for that file.
Since then, you've hopefully learned a lot about how filesystems are structured and what the various callbacks provide,
so let's revist the topic of writing filesystems and write a simple filesystem that can actually be used to store data.

If you want to skip ahead to the end and try your hand at implementing your own filesystems that do interesting things,
see the tutorial at [/pages/writing-programs]({{ '/pages/writing-programs.html' | relative_url }}).

The filesystem we'll be implementing will be an in-memory filesystem, meaning that all data will be stored in memory and when the filesystem process ends
(or in our case, the page is refreshed or closed), all associated data will be lost.
This is useful for implementing something like `/tmp` on most linux systems which store temporary files until the system is rebooted.
On some systems `/tmp` is an in-memory filesystem.

Technically the toy filesystem we've been using so far is an `in-memory` filesystem,
but it goes through the trouble of simulating a disk to enable the visualizations and make the simulator feel like a real UNIX box.
We won't apply such restrictions to ourselves here and we'll take advantage of dictionaries and other javascript data structures to build a filesystem.
Don't worry if you don't know javascript (I'm most certainly not an expert myself), we'll guide you through the steps.

Let's take a look at the default filesystem interface that we'll be deriving our filesystem from.
<pre id="defaultfs">Loading...</pre>
<script>
async function setup_defaultfs() {
    var request = await fetch("{{ '/js/fs.js' | relative_url }}");
    var reader = request.body.getReader();
    var target = document.getElementById("defaultfs");
    var first = true;
    while (true) {
        var result = await reader.read();
        if (result.done)
            break;
        if (first) {
            target.textContent = "";
            first = false;
        }
        target.textContent += bytes_to_str(result.value);
    }
}
setup_defaultfs();
</script>

You can find the full details regarding each callback in [/pages/filesystem-operations.html]({{ '/pages/filesystem-operations.html' | relative_url }}).

<details><summary>How do classes work in javascript?</summary>
<div markdown="1">
The code above defines a class in javascript named `defaultFS`.
To define a class, we can use the class keyword.
You can use the `this` keyword to set and get properties of the class.
The constructor of the class is just a special method named `constructor`.
E.g. to define a class that has a constructor that takes in 1 parameter and saves it as a property:

```javascript
class MyClass {
    constructor(x) {
        this.my_x = x;
    }
}
```

And now we can create a new instance of the class with:
```javascript
var instance = new MyClass('a');
console.log(instance.my_x); // Will print 'a' to the consol
```

To add methods on the class we have two options, the first: add it to the class definition

``javascript
class MyClass {
    constructor(x) {
        this.my_x = x;
    }

    print_my_x() {
        console.log(this.my_x);
    }
}
```

Alternatively we can add it to the prototype of the class like so:

```javascript
MyClass.prototype.print_my_x = function () {
    console.log(this.my_x);
};
```

This method is useful for either longer class definitions or splitting up a
class across files.
It comes from a slightly older syntax used to define classes in javascript.
In this chapter, we'll primarily be used the second, older, way of defining methods.

W3School has really good javascript tutorials if you want to learn more.
+ [More about classes](https://www.w3schools.com/js/js_classes.asp)
+ [More about object prototypes](https://www.w3schools.com/js/js_object_prototypes.asp)

</div>
</details>
<br>

You can see that if we could somehow "inherit" from `DefaultFS` we'd get a free implementation of `seek` and stub methods for all callbacks that returns `"EIMPL"`.

We can start deciding what functions we will actually be implementing.
We don't need to implement `mount` or `umount` (we already have a filesystem that implements almost nothing aside from `mount` and `umount` that will handle this for us).
We can ignore `ioctl`, a filesystem operation that's used to managed devices.
We can use the default implementation of `seek`. Everything else has to be implemented by us.

We've provided several helper functions in [/js/fs_helper.js]({{ '/js/fs_helper.js' | relative_url }}) and some helpful definitions in [/js/defs.js]({{ '/js/defs.js' | relative_url }}).
To kick things off, let's inherit the FS interface from `DefaultFS`.

```javascript
class MemFS extends DefaultFS {}
```

From here on out, we'll be walking through the design/implementation of our filesystem `MemFS`. If you'd like to skip to the end and work on your own, [scroll to the end of this section](#MemFS)

Let's start by designing how the file tree will be stored!
Since we're using a language like javascript, we have the ability to create objects and store references to those objects.
This means that instead of implementing directories as regular files, they can instead be objects that store a list of pointers to other objects.

What do we need to store to describe a regular file (i.e. not a directory)?

+ At a minimum we need to store data. (We can use arrays of chars for easy use)
+ We've also learned that permissions are also useful to have.
+ Keeping track of the number of links let's us implement hard links and unlinking
+ We want to keep track of atim, mtim, and ctim. (Make sure to initialize all time field to `Date.now()`)

Let's go ahead and implement that!

<pre id="file_class_memfs">
class File {
    constructor() {
<textarea class="code" id="file_class_input"></textarea>
    }
}
</pre>
<script>
cache_input("file_class_input");
</script>
<details><summary>Solution</summary>
<pre id="file_class_soln">
class File {
    constructor() {
        this.num_links = 0;
        this.permissions = 0;
        this.data = [];
        this.atim = Date.now();
        this.mtim = Date.now();
        this.ctim = Date.now();
    }
}
</pre>
</details>

Let's move on to directories.
A directory just needs to store a map of names to other `File`s or directories.
<pre id="directory_class_memfs">
class Directory extends File {
    constructor() {
        super(); // Call the constructor of the parent class
<textarea class="code" id="directory_class_input"></textarea>
    }
}
</pre>
<script>
cache_input("directory_class_input");
</script>
<details><summary>Solution</summary>
<pre id="directory_class_soln">
class Directory extends File {
    constructor() {
        super(); // Call the constructor of the parent class
        this.files = {};
    }
}
</pre>
</details>

Note that we make `Directory` inherit from `File` so that we can generically use the type `File` to describe both.

Now, we've layed out all the necessary components to setup the root of this filesystem.
In the method below, create a property named root that points to a new, empty`Directory`.
Make sure you set the permissions on the directory to `0o755` so that we actually have permissions to use the directory.

<pre id="setup_root_memfs">
MemFS.prototype.setup_root = function () {
<textarea class="code" id="setup_root_input"></textarea>
}
</pre>
<script>
cache_input("setup_root_input");
</script>
<details><summary>Solution</summary>
<pre id="setup_root_soln">
MemFS.prototype.setup_root = function () {
    this.root = new Directory();
    this.root.permissions = 0o755;
}
</pre>
</details>

Accordingly, we'll now update the definition of MemFS to be:
```javascript
class MemFS extends DefaultFS {
  constructor() {
    super(); // Call the DefaultFS constructor
    this.setup_root();
  }
}
```

Now, for most of the methods we'll be working on, we'll want to access the underlying `File` for a given path.
Let's make a method to find the `File` instance associated to a certain path.
Start at the root directory and work your way down.

You may assume that all paths start with `/` and don't have a trailing `/` at the end.
You may also assume that all paths are absolute.

If the file doesn't exist, return `"ENOENT"`.

<pre id="find_path_memfs">
MemFS.prototype.find_file_from_path = function (path) {
<textarea class="code" id="find_path_input"></textarea> 
};
</pre>
<script>
cache_input("find_path_input");
</script>
<details><summary>Hints</summary>
<div markdown="1">
+ When looking up "/", return the root directory.
+ Given a string `s = "/1/2/3"`, `s.split('/')` will return the array `["", "1", "2", "3"]`
+ Looking up a string in a map, like `this.root.files` can be done like so: `this.root.file["some string"]`
+ If a string lookup fails, the return value is `falsey` - using it in a if is equivalent to using `false`. If it succeedes, it would return a `File` object, and all objects are `truthy`.
+ To check if a file `f` is a directory we can use `f instanceof Directory`.
</div>
</details>
<details><summary>Solution</summary>
<pre id="find_path_soln">
MemFS.prototype.find_file_from_path = function (path) {
    if (path == "/")
        return this.root;
    var parts = path.split("/");
    var curr_file = null;
    // remove the initial empty entry
    // Shift removes and returns the first element of the array
    parts.shift();
    curr_file = this.root;
    curr_file.atim = Date.now();

    while (parts.length) {
        if (!(curr_file instanceof Directory))
            return "ENOENT";

        curr_file = curr_file.files[parts.shift()];
        if (!curr_file)
            return "ENOENT";

        curr_file.atim = Date.now();
    }
    return curr_file;
};
</pre>
</details>

This would be a good time to try writing some tests.
Go back and copy all the blocks of code you've written so far into a text editor of your choice and save the file with the extension `.js`.
You may need to do a bit of digging on how to write some barebones HTML, but try to setup an environment to hack in/test the code you've written so far.

Take a moment to look at [fs_helper.js](/js/fs_helper.js).
Methods like `split_parent_of` will be really useful going forward!

Now, we can move on to some meatier functions, creating files and directories.
Don't forget to manage the `num_links` property!

<pre id="create_memfs">
MemFS.prototype.create = function (path, mode) {
<textarea class="code" id="create_input"></textarea> 
};
</pre>
<script>
cache_input("create_input");
</script>
<details><summary>Solution</summary>
<pre id="create_soln">
MemFS.prototype.create = function (path, mode) {
    var exists = this.find_file_from_path(path);
    if (!(typeof(exists) === 'string'))
        return "EEXISTS";

    var split = split_parent_of(path);
    var parent_dir = this.find_file_from_path(split[0]);
    if (typeof(parent_dir) === 'string')
        return parent_dir;

    if (!(parent_dir instanceof Directory))
        return "ENOTDIR";

    var newfile = new File();
    newfile.permissions = mode & 0o777;
    newfile.num_links++;
    parent_dir.files[split[1]] = newfile;
    return 0;
};
</pre>
</details>

<pre id="mkdir_memfs">
MemFS.prototype.mkdir = function (path, mode) {
<textarea class="code" id="mkdir_input"></textarea> 
};
</pre>
<script>
cache_input("mkdir_input");
</script>
<details><summary>Solution</summary>
<pre id="mkdir_soln">
MemFS.prototype.mkdir = function (path, mode) {
    var exists = this.find_file_from_path(path);
    if (!(typeof(exists) === 'string'))
        return "EEXISTS";

    var split = split_parent_of(path);
    var parent_dir = this.find_file_from_path(split[0]);
    if (typeof(parent_dir) === 'string')
        return parent_dir;

    if (!(parent_dir instanceof Directory))
        return "ENOTDIR";

    var newdir = new Directory();
    newdir.permissions = mode & 0o777;
    newdir.num_links++;
    parent_dir.files[split[1]] = newdir;
    return 0;
};
</pre>
</details>

Now we can implement `readdir`.
`readdir` returns an array of `Dirent`s (see [defs.js](/js/defs.js)).
Just set `inodenum` to any number you want, since we don't have any use for an inode number in this filesystem.
To do so, we must keep in mind that we also need to provide the entries for `.` and `..`.

To list all elements of a map, use `Object.getOwnProperty(map)`.

<pre id="readdir_memfs">
MemFS.prototype.readdir = function (path) {
<textarea class="code" id="readdir_input"></textarea> 
};
</pre>
<script>
cache_input("readdir_input");
</script>
<details><summary>Solution</summary>
<pre id="readdir_soln">
MemFS.prototype.readdir = function (path) {
    var file = this.find_file_from_path(path);
    if (typeof(file) === 'string')
        return file;

    if (!(file instanceof Directory))
        return "ENOTDIR";

    var entries = [
        new Dirent(0, '.'),
        new Dirent(0, '..')];

    for (e of Object.getOwnPropertyNames(file.files))
        entries.push(new Dirent(0, e));

    file.atim = Date.now();
    return entries;
};
</pre>
</details>

The next most trivial thing to implement would be link.

<pre id="link_memfs">
MemFS.prototype.link = function (path1, path2) {
<textarea class="code" id="link_input"></textarea> 
};
</pre>
<script>
cache_input("link_input");
</script>
<details><summary>Solution</summary>
<pre id="link_soln">
MemFS.prototype.link = function (path1, path2) {
    var file = this.find_file_from_path(path1);

    var split = split_parent_of(path2);
    var dir2 = this.find_file_from_path(split[0]);

    if (typeof(dir2) === 'string')
        return "ENOENT";

    if (!(dir2 instanceof Directory))
        return "ENOTDIR";

    file.num_links++;
    file.atim = Date.now();
    file.ctim = Date.now();
    dir2.files[split[1]] = file;
    return 0;
};
</pre>
</details>

Naturally, after implementing link, we want to implement `unlink`.
To remove an element from a map, use `delete`.
For example, if `this.root.files` has an entry `"newfile"`, `delete this.root.files["newfile"]` would remove the entry.

Don't forget to decrement the `num_links` property.

<pre id="unlink_memfs">
MemFS.prototype.unlink = function (path) {
<textarea class="code" id="unlink_input"></textarea> 
};
</pre>
<script>
cache_input("unlink_input");
</script>
<details><summary>Solution</summary>
<pre id="unlink_soln">
MemFS.prototype.unlink = function (path) {
    var file = this.find_file_from_path(path);
    if (typeof(file) === 'string')
        return "ENOENT";

    var split = split_parent_of(path);
    var parent_dir = this.find_file_from_path(split[0]);
    // Gauranteed to exist since path exists

    delete parent_dir.files[split[1]];

    file.num_links--;
    file.atim = Date.now();
    file.ctim = Date.now();
    return 0;
};
</pre>
</details>

Another easy one is `chmod`.
All we have to do is replace the permission bits.

<pre id="chmod_memfs">
MemFS.prototype.chmod = function (path, permissions) {
<textarea class="code" id="chmod_input"></textarea> 
};
</pre>
<script>
cache_input("chmod_input");
</script>
<details><summary>Solution</summary>
<pre id="chmod_soln">
MemFS.prototype.chmod = function (path, permissions) {
    var file = this.find_file_from_path(path);
    if (typeof(file) === 'string')
        return "ENOENT";
    file.permissions = permissions;
    file.atim = Date.now();
    file.ctim = Date.now();
    return 0;
};
</pre>
</details>

Next, let's implement stat.
To implement stat, simply return an instance of `Stat` from [/js/defs.js](/js/defs.js).
`Stat` takes in many parameters in it's constructor.
The order in which they should be passed in is specified by `_stat_params`.

Make sure you calculate the filesize by checking the `.length` property of the file's data.

<pre id="stat_memfs">
MemFS.prototype.stat = function (path) {
<textarea class="code" id="stat_input"></textarea> 
};
</pre>
<script>
cache_input("stat_input");
</script>
<details><summary>Solution</summary>
<pre id="stat_soln">
MemFS.prototype.stat = function (path) {
    var file = this.find_file_from_path(path);
    if (typeof(file) === 'string')
        return "ENOENT";

    file.atim = Date.now();

    return new Stat(
        path,
        0,
        file.permissions,
        file instanceof Directory,
        file.data.length,
        file.atim,
        file.mtim,
        file.ctim);
    return 0;
};
</pre>
</details>

Next up, let's do truncate, which is extremely easy to do in javascript.

If the size passed in is greater that the length of the data, all we need to do is call `.push("\u0000")` on the file data repeated until it reaches the desired length.

`slice` can take 1 or 2 arguments; we'll use the two argument variant.
It takes a starting index and an ending index and returns a string containing the data between the start and end indicies.
If the end index is past the end of the file, it does nothing.

Note that `slice` does not modify the original data, it just returns a new array.

Note that if the file does not exist, you don't need to create it here.

<pre id="truncate_memfs">
MemFS.prototype.truncate = function (path, size) {
<textarea class="code" id="truncate_input"></textarea> 
};
</pre>
<script>
cache_input("truncate_input");
</script>
<details><summary>Solution</summary>
<pre id="truncate_soln">
MemFS.prototype.truncate = function (path, size) {
    var file = this.find_file_from_path(path);
    if (typeof(file) === 'string')
        return "ENOENT";

    while (file.data.length < size)
      file.data.push("\u0000");
    file.data = file.data.slice(0, size);
    return 0;
};
</pre>
</details>

Now that we've gotten out feet wet with modifying data, how about implementing `read` and `write`?
To that, we first need to implement `open` and `close`.

We'll ignore implementing `close` and rely on javascript's "garbage collection" to get rid of the file descriptors for us.

`open` returns a `FileDescriptor` as defined in [/js/defs.js](/js/defs.js).
While we don't need a real value for `inodenum`, set `inode` to be the `File` (or `Directory`) corresponding to the provided path.
Make sure to set `fs` parameter to `this`.
Set the `mode` parameter to be `flags`.

note that the `flags` parameters will be a set of flags from [/js/defs.js](/js/defs.js) that start with `O_` and are `or`'d together.
To find out if a particular flag, se `O_APPEND` is present, check the output of `(flags & O_APPEND)`.
If `O_CREAT` is passed in check if `mode` is truthy, if not, fail and return `"EINVAL"`, if it is, call `create` with `path` and `mode` (make sure to ignore the error 'EEXISTS').

If `O_APPEND` is passed in, set the offset in the file descriptor to be equal to  the size of the file.

If `O_WRONLY` is passed in, check if the file has write permissions set.
If not, return `"EPERM"`.

If `O_RDONLY` is passed in, check if the file has read permissions set.
If not, return `"EPERM"`.

If `O_TRUNC` is passed in and `O_WRONLY` is passed in truncate the file to size 0 first.
If `O_WRONLY` is not passed in, return `"EINVAL"`.

If `O_DIRECTORY` is passed in and the file is not a directory, return "EINVAL".

<pre id="open_memfs">
MemFS.prototype.open = function (path, flags, mode) {
<textarea class="code" id="open_input"></textarea> 
};
</pre>
<script>
cache_input("open_input");
</script>
<details><summary>Solution</summary>
<pre id="open_soln">
MemFS.prototype.open = function (path, flags, mode) {
    if (flags & O_CREAT) {
        if (!mode)
            return "EINVAL";
        var error = this.create(path, mode);
        if ((typeof(error) === 'string') && (error !== 'EEXISTS'))
            return error;
    }

    var file = this.find_file_from_path(path);
    if (typeof(file) === 'string')
        return file;

    if (flags & O_TRUNC) {
        if (!(flags & O_WRONLY))
            return "EINVAL";

        var error = this.truncate(path, 0);
        if (typeof(error) === 'string')
            return error;
    }

    if ((flags & O_DIRECTORY) && !(file instanceof Directory))
        return "ENOTDIR";

    if ((flags & O_WRONLY)  && !(file.permissions & 0o200))
        return "EPERM";

    if ((flags & O_RDONLY)  && !(file.permissions & 0o400))
        return "EPERM";


    var fd = new FileDescriptor(this, path, 0, file, flags & O_RDWR);
    if (flags & O_APPEND)
        fd.offset = file.data.length;

    return fd;
};
</pre>
</details>

Now, on to `read`.
`read` takes in two parameters, a file descriptor and a `Uint8Array`.
Our goal is to fill the `Uint8Array` with as much data as possible and return the number of bytes we actually filled in. Note that you can access the underlying `File` for a `FileDescriptor` via the `.inode` property.

To populate the array, try a for-loop and use the `charCodeAt` method of strings to get the byte values of chars in the data field.
(e.g. `"a".charCodeAt(0)` will give us the ascii value of the character `a`).
Make sure you start returning bytes in the data array from the offset specified in the `FileDescriptor` passed in, and that you update that file descriptor by the number of bytes read at the end.

If a read asks you to read past the end of the file, stop at the end of the file, and return the number of bytes read so far.
As a specific case, if the offset is greater than or equal to the size of the file, return 0.

You can check the length of the buffer by reading it's `.length` property.

<pre id="read_memfs">
MemFS.prototype.read = function (fd, buffer) {
<textarea class="code" id="read_input"></textarea> 
};
</pre>
<script>
cache_input("read_input");
</script>
<details><summary>Solution</summary>
<pre id="read_soln">
MemFS.prototype.read = function (fd, buffer) {
    if (fd.offset >= fd.inode.data.length)
        return 0;

    var bytes_read = 0;
    for (var i = 0; i < buffer.length; i++) {
        if ((fd.offset + i) >= fd.inode.data.length) {
            // we've reached the end of the file
            break;
        }

        buffer[i] = fd.inode.data[fd.offset + i].charCodeAt(0); 
        bytes_read++;
    }
    fd.offset += bytes_read; 
    return bytes_read;
};
</pre>
</details>

The easiest way to implement `write` would be to first call `truncate` on the file to ensure we have enough space,
then write a similar for loop to the one above, but instead copying data from the buffer to the file.
To convert a byte to a character, use `String.fromCharCode`.

To call `truncate` remember that `truncate` takes in a path, and we can use `fd.path` to get the path from a `FileDescriptor`.

Remember to take the offset into account when calculating the final filesize of the file.
Also note that we don't want to shrink the file while writing (i.e. we should be able to only change a few bytes in the middle of the file without disturbing the rest of the file).

<pre id="write_memfs">
MemFS.prototype.write = function (fd, buffer) {
<textarea class="code" id="write_input"></textarea> 
};
</pre>
<script>
cache_input("write_input");
</script>
<details><summary>Solution</summary>
<pre id="write_soln">
MemFS.prototype.write = function (fd, buffer) {
    this.truncate(fd.path, Math.max(fd.inode.data.length, fd.offset + buffer.length));

    var bytes_written = 0;
    for (var i = 0; i < buffer.length; i++) {
        fd.inode.data[fd.offset + i] = String.fromCharCode(buffer[i]); 
        bytes_written++;
    }
    fd.offset += bytes_written; 
    return bytes_written;
};
</pre>
</details>

## MemFS
<div id="shell_parent"></div>
<br>
<br>
<button onclick="load_memfs(false)">Load MemFS from input</button>
<button onclick="load_memfs(true)">Load MemFS from solutions</button>
<script>
var loaded = false;
var lfs = null;
var MemFS = null;
function load_memfs(use_soln) {
    if (loaded)
        return;
    MemFS = get_memfs_from_inputs(use_soln);
    if (MemFS) {
        lfs = new LayeredFilesystem(new MemFS());
        document.getElementById("shell_parent").innerHTML = "Loading...";
        setTimeout(function() {
          document.getElementById("shell_parent").innerHTML = "";
          var shell = new Shell(lfs, document.getElementById("shell_parent"));
          shell.main("{{ site.baseurl }}");
        }, 250); // Delaying for 250ms to make it seem like something is happening
    }
}
</script>
