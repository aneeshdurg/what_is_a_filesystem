---
layout: post
title:  "The Filesystem API"
---

Onto what you actually came for, filesystems!
Before we can talk about how a filesystem works we need to understand the requirements it must satisfy.
That's where the filesystem interface shows up.
All a filesystem truly does is define a series of callbacks corresponding to the filesystem interface.
We can almost think of this as a kind of API that we can interact with.

This is why we can have many filesystems, anything from `ext4` (the bread and butter filesystem that most of your data is probably on if you use a popular linux distro like ubuntu),
to something more exotic like `zfs` (a powerful filesystem popular in the freeBSD community) or even something that doesn't even provide access to data on a disk
like `procfs` (a filesystem that reports information about running process, it should be mounted at `/proc` in most linux systems).

In all of these filesystems, once they are `mount`ed (a term that means to give a filesystem a `path`. We'll revisit this concept later) we can interact with them using the same interface.
This means that all of those commands you learnt in the previous section can be used regardless of filesystem (with some caveats)!

We'll refer to filesystems that don't provide access to actual disk data as `virtual filesystems`.
Note that in general, the term virtual filesystem refers to any filesystem that provides an interface between the kernel and the user.
Our usage of the term is in some ways broader (our `virtual filesystems` aren't necessarily going to be connected to the kernel)
and in some ways more restrictive (technically even filesystems like `ext4` and `zfs` are virtual since they use the kernel to manage the actual disk I/O).

To get a list of functions that a filesystem must implement I like to look at the [FUSE](https://libfuse.github.io) documentation.
FUSE (which stands for Filesystems in USErspace) is a library that makes it easy to write filesystems without having to write kernel code.
A filesystem implemented with FUSE must register itself by filling out the `fuse_operations` struct.
We can find the documentation for this struct at this link: [https://libfuse.github.io/doxygen/structfuse__operations.html#abac8718cdfc1ee273a44831a27393419](https://libfuse.github.io/doxygen/structfuse__operations.html#abac8718cdfc1ee273a44831a27393419).
Below is an excerpt from the documentation highlighting relevant fields of the struct.

```
int(* 	getattr )(const char *, struct stat *, struct fuse_file_info *fi)
int(* 	mkdir )(const char *, mode_t)
int(* 	unlink )(const char *)
int(* 	rename )(const char *, const char *, unsigned int flags)
int(* 	link )(const char *, const char *)
int(* 	chmod )(const char *, mode_t, struct fuse_file_info *fi)
int(* 	chown )(const char *, uid_t, gid_t, struct fuse_file_info *fi)
int(* 	truncate )(const char *, off_t, struct fuse_file_info *fi)
int(* 	open )(const char *, struct fuse_file_info *)
int(* 	read )(const char *, char *, size_t, off_t, struct fuse_file_info *)
int(* 	write )(const char *, const char *, size_t, off_t, struct fuse_file_info *)
int(* 	readdir )(const char *, void *, fuse_fill_dir_t, off_t, struct fuse_file_info *, enum fuse_readdir_flags)
int(* 	access )(const char *, int)
int(* 	create )(const char *, mode_t, struct fuse_file_info *)
int(* 	ioctl )(const char *, unsigned int cmd, void *arg, struct fuse_file_info *, unsigned int flags, void *data)
```

There's many other callbacks that can be registered, but a filesystem doesn't necessarily need to succesfully handle every callback.
In the case of FUSE, any unimplemented callbacks will all return -1 regardless of their inputs and set the `errno` to some generic value.

## Implementing a virtual filesystem

To further understand how filesystems work, let's implement a virtual filesystem!
We'll implement a very simple filesystem, a subset of the features provided by `devfs` (a filesystem used to managed devices, usually mounted at `/dev`).
The features we'll be implemented will be those provided by the special file `/dev/zero`.
`/dev/zero` is a file that returns an infinite stream of `0`s (the byte value, not the ascii character) when read from and ignores all data written to it.

In our filesystem we will have a single file `/zero` that will follow the requirements of `/dev/zero` specified above.
To implement this, we'll be writing some javascript code to be loaded into our simulator.
Note that we'll provide code that takes care of the nitty gritty details.
You can focus on just implementing the core `read`/`write` logic.

Note that both read and write take in a (for now) opaque file descriptor object and a buffer of type `Uint8Array` (essentially `char[]` if you're a `c` person).
Conventionally, `read` and `write` respectively return the number of bytes read or written and -1 on error (since we're using javascript we'll return errors as strings for greater expresiveness).

Once you've written your code, press `run` below to `mount` your file system at `/dev`.

If you're stuck check out these hints below:

<details><summary> Click to expand/hide hints</summary>
<div markdown="1">
+ when someone tries to write to the file we'll return the size of the buffer (try the `.length` property) to indicate that we successfully _consumed_ the data.
+ when someone tries to read to the file we'll zero out the contents of the buffer (try the `.fill` method).

<details> <summary> Still stuck? Click here to show the solution. </summary>
<pre id="myvfs_soln"> </pre>
</details>
</div>
</details>

{% assign read_placeholder = "MYVFS_READ" %}
{% assign write_placeholder = "MYVFS_WRITE" %}

<pre id="myvfs_code">
function MyVFS() {};
inherit(MyVFS, DefaultFS);

// implement a few other callbacks like readdir
// -- snip --

MyVFS.prototype.read = function (fd, buffer) {
    if (fd.path != "/zero")
        return "ENOENT";
    {{ read_placeholder }}
};

MyVFS.prototype.write = function (fd, buffer) {
    if (fd.path != "/zero")
        return "ENOENT";
    {{ write_placeholder }}
};
</pre>
<br>
<button onclick='load_solution()'>run</button>
<p id='status'></p>
<br>

<!-- TODO implement head -->
<!-- TODO implement way to kill process -->
<!-- TODO use hexdump/read and warn against using cat -->
Try commands such as `echo hi > /dev/zero` and `hexdump -c 10 /dev/zero`
(Shows the hex values of the first 10 bytes of the file - change 10 to something else to see a different number of bytes).

Do not use `cat` to read the file, as `cat` will continue reading until the file indicates that it's reached the end of the file (`EOF`), by return 0.
Since our implementation of read should never return 0, the file never ends and `cat` will hang as
our shell simulator models an operating system that can have at most 2 running processes at any given time - the shell/kernel and at most one other process - and has no support for pre-emption.

<div id='shell'></div>
<br>

In our simiulator the filesystem acts similar to how a filesystem in the kernel would present itself (a series of functions that can be called from the kernel), which is different from the way FUSE works
(a series of functions that can are run in the context of a running `filesystem` process via [IPC](https://github.com/illinois-cs241/coursebook/wiki/Ipc)).


<script>
var shell = null;
var fs = new LayeredFilesystem();
var orig_code = null;
window.onload = function () {
    shell = new Shell(fs, document.getElementById("shell"));
    shell.main();

    // Generate input boxes
    var q_container = document.getElementById('myvfs_code');
    orig_code = q_container.textContent;

    var question_code = orig_code.replace(
        "{{ read_placeholder }}", "<textarea id='{{ read_placeholder }}'></textarea>");
    question_code = question_code.replace(
        "{{ write_placeholder }}", "<textarea id='{{ write_placeholder }}'></textarea>");
    q_container.innerHTML = question_code;

    // Generate solution
    var s_container = document.getElementById('myvfs_soln');
    var solution_code = orig_code.replace(
        "{{ read_placeholder }}", "buffer.fill(0);\n    return buffer.length;");
    solution_code = solution_code.replace(
        "{{ write_placeholder }}", "return buffer.length;");
    s_container.innerHTML = solution_code;

    // Cache input
    var read_input = document.getElementById('{{ read_placeholder }}');
    read_input.value = localStorage.getItem('{{ read_placeholder }}') || "";

    var write_input = document.getElementById('{{ write_placeholder }}');
    write_input.value = localStorage.getItem('{{ write_placeholder }}') || "";

    setInterval(function() {
        localStorage.setItem('{{ read_placeholder }}', read_input.value);
        localStorage.setItem('{{ write_placeholder }}', write_input.value);
    }, 1000);

};

async function load_solution() {
    try {
        var MyVFS = (function () {
            var read_input = document.getElementById('{{ read_placeholder }}');
            var write_input = document.getElementById('{{ write_placeholder }}');
            var code = orig_code.replace('{{ read_placeholder }}', read_input.value);
            code = code.replace('{{ write_placeholder }}', write_input.value);
            eval(code);
            return MyVFS;
        })();

        MyVFS.prototype.stat = function (path) {
            if (path == "/")
                return new Stat(path, 0, 0o777, true, 0);
            return new Stat(path, 0, 0o777, false, 0);
        }

        MyVFS.prototype.readdir = function (path) {
            if (path == "/")
                return [ new Dirent(0, "zero") ];
            return [];
        }

        MyVFS.prototype.open = function (path, mode) {
            console.log("Opening", path);
            if (path != "/zero")
                return "ENOENT";
            return new FileDescriptor(this, path, 0, null, mode);
        }

        console.log(await fs.umount("/dev"));
        console.log(await fs.mkdir("/dev", 0o755));
        console.log(await fs.mount("/dev", new MyVFS()));
        document.getElementById('status').innerText = "Success!";
    } catch (e) {
        // TODO return error
        console.log("error", e);
        alert(e.message + "\n\n" + e.stack);
        document.getElementById('status').innerText = "Error";
    }
}
</script>

## Read/Write offsets

You might have noticed in the FUSE function prototypes above that the read and write functions take in a `off_t` paramemter.
`off_t` is usually a synonym of `size_t` and defines an offset at which to read or write from.
In the case of FUSE, the FUSE library tracks the offset for it's internal representation of a file descriptor and will add the result of read and write calls (when successfull) to the offset.
This means that if you read 1 byte, then perform another read of 1 byte, the first read will give you the first byte of the file and the second read will give you the second byte of the file.
In our javascript library, the offset needs to be managed by the filesystem itself
(this is also true for filesystems implemented in the kernel, where the `off_t` parameter is usually a `off_t*` parameter instead).
To accomplish this, you can use the `fd.offset` field and increment it by the number of bytes read/written.
