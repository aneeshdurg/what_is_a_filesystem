function TestEnv(container, fs, shell) {
    this.container = container;
    this.fs = fs;
    this.shell = shell;
};

describe("Test Shell UI/input features" , function() {
    async function imports() {
        await _import({
            src: '/__src__/js/lfs.mjs',
            name: 'LayeredFilesystem'});

        await _import({
            src: '/__src__/js/shell.mjs',
            name: 'Shell'});

        await _import({
            src: '/__src__/js/fs_helper.mjs',
            name: 'bytes_to_str'});
    }

    beforeAll((done) => {
        imports().then(done);
    });

    var test_env = null;
    beforeEach(function () {
        var container = document.createElement("div");
        container.id = "shell_parent";
        document.body.append(container);

        var lfs = new LayeredFilesystem();
        var shell = new Shell(lfs, container);
        test_env = new TestEnv(container, lfs, shell);
        shell.main(base_url);
    });

    afterEach(function (){
        test_env.container.remove();
        test_env = null;
    });

    function simulate_input_char(input, element) {
        var input_event = new InputEvent("input", {
            "data": input,
            "inputType": "insert"
        });

        var key_event = new KeyboardEvent("keydown", {
            "key": input == '\n' ? "Enter" : input,
            "ctrlKey": false
        });

        element.dispatchEvent(key_event);
        element.value += input;
        element.dispatchEvent(input_event);

    }


    it("Tests keyboard input invalid command", async function() {
        await test_env.shell.initialized;

        simulate_input_char('a', test_env.shell.output.element);
        simulate_input_char('\n', test_env.shell.output.element);

        await sleep(100);

        expect(test_env.shell.output.element.value).toContain('Invalid command');
    });
})
