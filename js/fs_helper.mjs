export function split_parent_of(child) {
    if (child == "/")
        return ["/", "/"];

    var parts = child.split("/")
    var parent_part = parts.slice(0,-1).join("/");
    if (parent_part == "")
        parent_part = "/";
    return [ parent_part, parts.slice(-1)[0] ];
}

export function not_implemented() {
    return "EIMPL";
}

export function bytes_to_str(bytes) {
    return String.fromCharCode.apply(null, bytes);
}

export function str_to_bytes(str) {
    return new Uint8Array(Array.from(str).map(x => x.charCodeAt(0)));
}
