describe("Test Command parser", function() {
    it("tests a basic command", function() {
        var cmd = Command.parse_command("cat hello_world.txt");
        expect(cmd.arguments).toEqual(["cat", "hello_world.txt"]);
    });

    it("tests a command with quotes", function() {
        var cmd = Command.parse_command("cat \"hello world.txt\"");
        expect(cmd.arguments).toEqual(["cat", "hello world.txt"]);
    });

    it("tests a command with escaped quotes", function() {
        var cmd = Command.parse_command("cat \\\"helloworld.txt");
        expect(cmd.arguments).toEqual(["cat", "\"helloworld.txt"]);
    });

    it("tests a command with all quote stuff", function() {
        var cmd = Command.parse_command("cat 1\" \\\"helloworld.txt\"");
        expect(cmd.arguments).toEqual(["cat", "1 \"helloworld.txt"]);
    });

    it("tests a command with spaces", function() {
        var cmd = Command.parse_command("   cat  there are   too many s p a c e s   ");
        expect(cmd.arguments).toEqual(["cat", "there", "are", "too", "many", "s", "p", "a", "c", "e", "s"]);
    });

    it("tests command with an output path", function() {
        var cmd = Command.parse_command("cat hello >   newfile");
        expect(cmd.arguments).toEqual(["cat", "hello"]);
        expect(cmd.output).toBe("newfile");
        expect(cmd.append_output).toBe(false);
    });

    it("tests command with a weird output path", function() {
        var cmd = Command.parse_command("cat hello >   newfile\\>\"weird >\\\" path\"");
        expect(cmd.arguments).toEqual(["cat", "hello"]);
        expect(cmd.output).toBe("newfile>weird >\" path");
        expect(cmd.append_output).toBe(false);
    });

    it("tests command errors", function() {
        expect(function() {
            Command.parse_command("cat hello >> newfile I_shouldnt_be_here");
        }).toThrow();

        expect(function() {
            Command.parse_command("cat hello > newfile> I_shouldnt_be_here");
        }).toThrow();
    });
});
