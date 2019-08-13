---
---
import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.mjs' | relative_url }}"
import {Shell} from "{{ '/js/shell.mjs' | relative_url }}"

var canvas_3 = create_canvas('canvas_3');
var fs_3 = new MyFS(canvas_3);
var shell_3 = new Shell(new LayeredFilesystem(fs_3), document.getElementById('shell_3'));
shell_3.main("{{ site.baseurl }}");
