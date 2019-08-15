---
---
import {CONSTANTS} from "{{ '/js/defs.mjs' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.mjs' | relative_url }}"
import {IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {Shell} from "{{ '/js/shell.mjs' | relative_url }}"

var animated_shell = null;
var animated_fs = null;

window.onload = async function() {
    var shell = new Shell(new LayeredFilesystem(), document.getElementById("shell_parent"));
    shell.main("{{ site.baseurl }}");
    console.log("set up shell");

    animated_fs = new LayeredFilesystem(null, document.getElementById("fs_vis"));
    animated_shell = new Shell(animated_fs, document.getElementById("shell_fs_parent"));
    animated_shell.main("{{ site.baseurl }}");
    console.log("set up animated shell");

    for (var i = 10; i <= 100; i++) {
        var opt = document.createElement('option');
        opt.value = i.toString();
        opt.innerText = i + "ms";
        document.getElementById('speed_selector').appendChild(opt);
    }
    document.getElementById('speed_selector_container').style.display = "";
    console.log("set up speed controls");
};

async function change_speed() {
    var speed_value = document.getElementById('speed_selector').value;
    animated_fs.ioctl(
        await animated_fs.open("/", CONSTANTS.O_ACCESS),
        IOCTL_SET_ANIMATION_DURATION,
        {
            duration: speed_value,
            save: true,
        }
    );
    alert(
      "Changed animation speed to " +
      (speed_value ? speed_value + "ms" : "default"));
}
