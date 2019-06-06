---
layout: default
title: "Filesystem Operations"
hide_toc: true
---

This page describes all filesystem operations we require a filesystem to support.

## mount(dir, fs)

Mounts the filesystem at the path `dir`.
Note that `fs` must be an instance of `DefaultFS`.

On error a string will be returned describing the error.
On success `0` will be returned.

## umount(dir)

Unmounts the filesystem mounted at the path `dir`.
If no filesystem is mounted an error will be returned.

On error a string will be returned describing the error.
On success `0` will be returned.

## readdir(dir)

Reads the directory at `dir`.
If `dir` is not a directory an error will be returned.

On error a string will be returned describing the error.
On success a list of `Dirent`s will be returned.

## stat(path)

Get information about the file at `path`.

On error a string will be returned describing the error.
On success a `Stat` will be returned.

## unlink(path)

Removes the link at `path`.

On error a string will be returned describing the error.
On success a `Stat` will be returned.

## create(path, mode)

Create a regular file at `path` with permissions set to `mode`.

On error a string will be returned describing the error.
On success a number will be returned.

## truncate(path, size)

Extend or shrink the size of the file at `path` to `size` (in bytes).
If `size` is bigger than the original filesize, the file will be extended by null bytes.
If `size` is smaller than the original filesize, the file will be shrunk.

On error a string will be returned describing the error.
On success a the number of bytes added or removed will be returned.

## open(path, flags, mode)

Opens the file at `path` and returns a `FileDescriptor` with attributes specified by `flags`,.

+ If `O_RDONLY` is set in `flags`, the returned `FileDescriptor` can be used for reading.
+ If `O_WRONLY` is set in `flags`, the returned `FileDescriptor` can be used for writing.
+ If `O_APPEND` is set in `flags`, the returned `FileDescriptor`'s offset will be set to the end of the file.
+ If `O_TRUNC` is set in `flags`, and `O_WRONLY` is set,
the file will first be truncated to a file of `0` before a `FileDescriptor is returned.
+ If `O_CREAT` is set in `flags`, if `path` does not exist, it will be created with the mode set to `mode`.

The flag `O_RDWR` is a combination of both `O_RDONLY` and `O_WRONLY`.

On error a string will be returned describing the error.
On success a `FileDescriptor` will be returned.

## close(fd)

Closes `fd`, an instance of `FileDescriptor` and releases any associated resources.

## chmod(path, mode)

Changes the mode of the file at `path` to `mode`.

`mode` must be an integer with the lower nine bits forming a permissions string.

On error a string will be returned describing the error.
On success a `0` will be returned.

## ioctl(fd, request, data)

Control the underlying "device"/interact with the filesystem on a "meta" level.

`fd` must be an instance of `FileDescriptor` describing a file to operate on.

`request` can be one of:
+ `IOCTL_IS_TTY` - determine if the file is _interactive_
+ `IOCTL_SELECT_INODE` - "select" the inode

You can define your own request numbers and can optionally use `data` to pass in arbitrary javascript objects as parameters.

The return values are controlled by the definition of `request`.

## link(src_path, dst_path)

Make a hardlink at `dst_path` to the same file as `src_path`.

On error a string will be returned describing the error.
On success a `0` will be returned.

## mkdir(path)

Create a directory at `path`.

On error a string will be returned describing the error.
On success a `0` will be returned.

## write(fd, buffer)

Write into `fd`, an instance of `FileDescriptor`, from `buffer`.

`buffer` must be an instance of `Uint8Array`.

On error a string will be returned describing the error.
On success the number of bytes written will be returned.

## read(fd, buffer)

Read from `fd`, an instance of `FileDescriptor`, into `buffer`.

`buffer` must be an instance of `Uint8Array`.

On error a string will be returned describing the error.
On success the number of bytes read will be returned.

## seek(fd, offset, whence) 

Change the offset of `fd` (an instance of `FileDescriptor`) by `offset` using the scheme `whence`.

Availible schemes:
+ `SEEK_SET` - set the offset relative to the start of the file
+ `SEEK_END` - set the offset relative to the end of the file
+ `SEEK_CURR` - set the offset relative to the current offset of `fd`

On error a string will be returned describing the error.
On success a `0` will be returned.
