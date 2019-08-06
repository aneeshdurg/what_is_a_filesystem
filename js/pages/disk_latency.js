var fs = null;
var shell = null;
function setup() {
    var latency_container = document.getElementById('latency_container');
    latency_container.innerHTML = "";
    var shell_el = document.createElement('div');
    shell_el.id = 'shell';
    latency_container.appendChild(shell_el);

    var canvas_container = document.createElement('div');
    canvas_container.style.overflow = "hidden";
    var canvas_el = document.createElement('canvas');
    canvas_el.id = 'canvas';
    canvas_container.appendChild(canvas_el);
    latency_container.appendChild(canvas_container);

    var canvas = create_canvas('canvas');
    canvas_container.style.height = "150px";

    fs = new MyFS(canvas);
    fs.ioctl(null, IOCTL_SET_ANIMATION_DURATION, {
        duration: 1,
        save: false,
    });

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
        fs.ioctl(null, IOCTL_RESET_ANIMATION_DURATION);
        fs.ioctl(null, IOCTL_SET_DISK_PTR_POS, {pos: 0});
        fs.ioctl(null, IOCTL_SET_DISK_PTR_SPEED, {speed: 0.5});
        fs.ioctl(null, IOCTL_ENABLE_DISK_PTR);
        // Allow user interaction
        canvas_container.style.height = "";
        shell.reenable_container_event_listeners();
        shell_el.focus();
    })();
}

function enable_cache() {
    if (!fs)
        return;

    fs.ioctl(null, IOCTL_ENABLE_CACHE);
}

window.addEventListener('DOMContentLoaded', setup);
