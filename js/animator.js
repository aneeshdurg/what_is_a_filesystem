function Task(resolve, callback) {
    this.resolve = resolve;
    this.callback = callback;
}

function FSAnimator(fs, canvas, block_limit) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fs = fs;
    if (!block_limit)
        block_limit = 50
    this.inode_space = 0.35;
    this.block_limit = Math.min(block_limit, this.fs.num_blocks);

    this.inode_width = this.canvas.width * this.inode_space / this.fs.num_inodes;
    this.block_width = this.canvas.width * (1 - this.inode_space) / this.block_limit;

    this.tasks = [];

    this.registered_inodes = {};
    this.registered_blocks = {};

    this.reading_blocks = [];
    this.selected_inodes = [];

    this.register_inode(0);

    this.duration = null;
    this.timer = null;
    this.reload_duration();
}

FSAnimator.prototype.set_duration = function(duration) {
    duration = Number(duration);

    this.duration = duration;
    console.log("Animation speed is set to", this.duration);

    clearTimeout(this.timer);
    var that = this;
    if (this.duration > 0)
      this.timer = setInterval(() => { that.draw() }, this.duration);
};

FSAnimator.prototype.save_duration = function(duration) {
    this.set_duration(duration);
    localStorage.setItem("ANIMATOR_DURATION", this.duration);
}

FSAnimator.prototype.reload_duration = function() {
    this.set_duration(Number(localStorage.getItem("ANIMATOR_DURATION")) || 100);
};

FSAnimator.prototype.draw = function() {
    var currtask = null;
    if (this.tasks.length) {
        currtask = this.tasks.shift();
        currtask.callback.call(this);
    }

	this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height / 2);
    for (var i = 0; i < this.fs.num_inodes; i++) {
        this.ctx.beginPath();
        this.ctx.rect(i * this.inode_width, 0, this.inode_width, this.ctx.canvas.height / 2);
        if (this.registered_inodes[i]) {
            this.ctx.fillStyle = this.registered_inodes[i];
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    this.ctx.translate(this.canvas.width * this.inode_space, 0);

    for (var i = 0; i < this.block_limit; i++) {
        this.ctx.beginPath();
        this.ctx.rect(i * this.block_width, 0, this.block_width, this.ctx.canvas.height / 2);
        if (this.registered_blocks[i] != null) {
            this.ctx.fillStyle = this.registered_inodes[this.registered_blocks[i]];
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    while (this.reading_blocks.length) {
        var i = this.reading_blocks.shift();
        this.ctx.globalAlpha = 0.2;
        this.ctx.beginPath();
        this.ctx.rect(i * this.block_width, 0, this.block_width, this.ctx.canvas.height / 2);
        if (this.registered_blocks[i] != null) {
            this.ctx.fillStyle = "black";
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        this.ctx.stroke();
    }

    this.ctx.translate(-1 * this.canvas.width * this.inode_space, 0);

    if (currtask) {
        currtask.resolve();
    }
};

// https://stackoverflow.com/questions/1484506/random-color-generator
function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

FSAnimator.prototype.submitTask = async function (callback){
    promise_collector = []
    p = new Promise(resolve => promise_collector.push(resolve));
    while (promise_collector.length == 0) {};

    task = new Task(promise_collector[0], callback);
    this.tasks.push(task);
    return p;
};

FSAnimator.prototype.read_block = async function (blocknum){
   function callback() {
        this.reading_blocks.push(blocknum);
    }
    var p =  this.submitTask(callback);
    await p;
};

FSAnimator.prototype.register_block_to_inode = async function (inodenum, blocknum){
    function callback() {
        this.registered_blocks[blocknum] = inodenum;
    }
    await this.submitTask(callback);
};

FSAnimator.prototype.deregister_block = async function (blocknum){
    function callback(){
        this.registered_blocks[blocknum] = null;
    }
    await this.submitTask(callback);
};

FSAnimator.prototype.deregister_inode = async function (inodenum){
    function callback(){
        this.registered_inodes[inodenum] = null;
    }
    await this.submitTask(callback);
};

FSAnimator.prototype.register_inode = async function (inodenum){
    function callback(){
        var color = getRandomColor();
        this.registered_inodes[inodenum] = color;
    }
    var p = this.submitTask(callback);
    await p;
};

// https://stackoverflow.com/a/6333775/5803067
function canvas_arrow(context, fromx, fromy, tox, toy){
    var headlen = 10;   // length of head in pixels
    var angle = Math.atan2(toy-fromy,0);
    context.beginPath();
    context.moveTo(fromx, fromy);
    context.bezierCurveTo(fromx, fromy + 20, tox, toy + 20, tox, toy);
    context.lineTo(tox-headlen*Math.cos(angle-Math.PI/6),toy-headlen*Math.sin(angle-Math.PI/6));
    context.moveTo(tox, toy);
    context.lineTo(tox-headlen*Math.cos(angle+Math.PI/6),toy-headlen*Math.sin(angle+Math.PI/6));
    context.stroke();
}

FSAnimator.prototype.select_inode = function (inodenum, inode){
    console.log("Selected " + (new Error()).stack);
    this.ctx.translate(0, this.ctx.canvas.height / 2);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height / 2);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, this.inode_width * 5, this.ctx.canvas.height / 2);
    this.ctx.rect(0, 0, this.inode_width * 5, this.ctx.canvas.height / 2);
    this.ctx.fillStyle = this.registered_inodes[inodenum];
    this.ctx.fill();
    this.ctx.stroke();

    var w_offset = this.inode_width * 5 + 5;
    var h_offset = 25;

    var font_size = 20;
    this.ctx.font = font_size + "px Courier New";
    var font_width = this.ctx.measureText(" ").width;

    var num_blocks = Math.ceil(inode.filesize / this.fs.block_size);

    this.ctx.beginPath();
    this.ctx.fillStyle = "black";
    this.ctx.fillText("Inode: " + inodenum, w_offset, h_offset);
    h_offset += 20;

    this.ctx.fillText("Filesize: " + inode.filesize, w_offset, h_offset);
    h_offset += 20;

    if (num_blocks) {
        var num_direct = Math.min(num_blocks, inode.direct.length);
        var direct_blocks_view = new Uint8Array(inode.direct.buffer, 0, num_direct);
        var direct_str = "Direct: " + Array.from(direct_blocks_view).join(" ");
        num_blocks -= num_direct;
        this.ctx.fillText(direct_str, w_offset, h_offset);
        h_offset += 20;
    }

    if (num_blocks) {
        this.ctx.fillText("Indirect: " + Array.from(inode.indirect).join(" "), w_offset, h_offset);
        canvas_arrow(
            this.ctx,
            w_offset + font_width * "Indirect: 0".length,
            h_offset - 10,
            this.inode_width * this.fs.num_inodes + this.block_width * inode.indirect,
            5);
        h_offset += 20;
        var disk_offset = inode.indirect[0] * this.fs.block_size;
        var indirect_array = new Uint8Array(this.fs.disk, disk_offset, num_blocks);
        var indirect_array_str = indirect_array.join(" ");

        this.ctx.fillText(indirect_array_str, w_offset + font_width * "Indirect: ".length, h_offset);
        h_offset += 20;

        num_blocks = 0;
    }

    this.ctx.translate(0, -1 * this.ctx.canvas.height / 2);
};
