---
---
import * as myfs from "{{ '/js/myfs.mjs' | relative_url }}"

import {MyFS, IOCTL_SET_ANIMATION_DURATION} from "{{ '/js/myfs.mjs' | relative_url }}"
import {LayeredFilesystem} from "{{ '/js/lfs.mjs' | relative_url }}"
import {Shell, Command} from "{{ '/js/shell.mjs' | relative_url }}"

var fs = null;
var shell = null;

window.setup = function() {
    var controls = document.getElementById('controls');
    controls.style.display = "none";

    var latency_container = document.getElementById('latency_container');
    latency_container.innerHTML = "";
    var shell_el = document.createElement('div');
    shell_el.id = 'shell';
    latency_container.appendChild(shell_el);

    var canvas_container = document.createElement('div');
    canvas_container.style.overflow = "hidden";
    latency_container.appendChild(canvas_container);

    fs = new MyFS(canvas_container);
    fs.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 1,
        save: false,
    });

    // Setup a shell
    shell = new Shell(new LayeredFilesystem(fs), shell_el);
    shell.remove_container_event_listeners();
    shell.prompt = function () { return "\n\n"; };
    shell.main("{{ site.baseurl }}");

    (async function() {
        await shell.initialized;
        await shell.run_command(new Command("touch goodfile"));
        await shell.run_command(new Command("touch badfile"));
        await shell.run_command(new Command("touch tempfile"));

        await shell.run_command(new Command("truncate goodfile 160"));

        async function b(n) {
            await shell.run_command(new Command("truncate badfile " + n));
        }

        async function t(n) {
            await shell.run_command(new Command("truncate tempfile " + n));
        }

        // Set up a file that is not sequential on disk
        await b(16);
        await t(8 * 16);
        await b(32);
        await t(0);
        await b(48);
        await t(5 * 16);
        await b(64);
        await t(0);
        await b(80);
        await t(3 * 16);
        await b(96);
        await t(0);
        await b(112);
        await t(32);
        await b(128);
        await t(16);
        await b(144);
        await t(0);
        await b(160);

        await shell.run_command(new Command("rm tempfile"));

        shell.restore_default_prompt();
        await shell.run_command(new Command("clear"));

        shell.simulate_input("\n");

        async function sleep(time) {
            var resolver = null;
            var p = new Promise(r => resolver = r);
            setTimeout(resolver, time);
            await p;
        }

        await sleep(500);
        shell.simulate_input("\n");
        // Set disk animation params
        fs.ioctl(null, myfs.IOCTL_RESET_ANIMATION_DURATION);
        fs.ioctl(null, myfs.IOCTL_SET_DISK_PTR_POS, {pos: 0});
        fs.ioctl(null, myfs.IOCTL_SET_DISK_PTR_SPEED, {speed: 0.5});
        fs.ioctl(null, myfs.IOCTL_ENABLE_DISK_PTR);
        // Allow user interaction
        shell.reenable_container_event_listeners();

        controls.style.display = "";
        shell_el.focus();
    })();

    // Invoke the disable cache event handler
    disable_cache({
        target: document.getElementById('cache_btn'),
    });
}

function if_fs(fn) {
    return function() {
        if (!fs)
            return;
        return fn.apply(null, arguments);
    }
}

var cache_timer = null;
var cache_size = 8;

window.enable_cache = if_fs(function (e) {
    fs.ioctl(null, myfs.IOCTL_ENABLE_CACHE);

    console.log(e);
    var btn = e.target;
    btn.innerText = "Disable Cache";
    btn.onclick = disable_cache;

    var container = document.getElementById('cache_container');
    container.style.display = "";

    var contents = document.getElementById('cache_contents');

    cache_timer = setInterval(async () => {
        contents.innerHTML = "Cache: [" + await fs.ioctl(null, myfs.IOCTL_GET_CACHE_CONTENTS) + "]";
    }, 100);
});

window.disable_cache = if_fs(function (e) {
    cache_size = 8;

    fs.ioctl(null, myfs.IOCTL_DISABLE_CACHE);
    fs.ioctl(null, myfs.IOCTL_SET_CACHE_SIZE, {size: cache_size});

    if (cache_timer) {
        clearTimeout(cache_timer);
        cache_timer = null;
    }

    var btn = e.target;
    btn.innerText = "Enable Cache";
    btn.onclick = enable_cache;

    var container = document.getElementById('cache_container');
    container.style.display = "none";

    var contents = document.getElementById('cache_contents');
    contents.innerHTML = "";
});

window.increase_cache = if_fs(function () {
    fs.ioctl(null, myfs.IOCTL_SET_CACHE_SIZE, {size: ++cache_size});
});

window.decrease_cache = if_fs(function () {
    fs.ioctl(null, myfs.IOCTL_SET_CACHE_SIZE, {size: --cache_size});
});

window.defragment = if_fs(async function () {
    var btn = document.getElementById('defragment');
    btn.disabled = true;

    shell.remove_container_event_listeners();
    await fs.ioctl(null, myfs.IOCTL_DEFRAG);
    shell.reenable_container_event_listeners();

    btn.disabled = false;
});

window.addEventListener('DOMContentLoaded', setup);
