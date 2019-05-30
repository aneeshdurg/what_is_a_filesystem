function inherit(A, B) {
    A.prototype = Object.create(B.prototype);
    Object.defineProperty(A.prototype, 'constructor', {
        value: A,
        enumerable: false,
        writable: true
    });
}

function split_parent_of(child) {
    if (child == "/")
        return ["/", "/"];

    var parts = child.split("/")
    var parent_part = parts.slice(0,-1).join("/");
    if (parent_part == "")
        parent_part = "/";
    return [ parent_part, parts.slice(-1)[0] ];
}

function not_implemented() {
    return "EIMPL";
}

function bytes_to_str(bytes) {
    return String.fromCharCode.apply(null, bytes);
}

function str_to_bytes(str) {
    return new Uint8Array(Array.from(str).map(x => x.charCodeAt(0)));
}
