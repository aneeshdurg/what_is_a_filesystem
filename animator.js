function FSAnimator(fs, canvas, block_limit) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fs = fs;
    if (!block_limit)
        block_limit = 100
    this.block_limit = Math.min(block_limit, this.fs.num_blocks);

    this.inode_width = Math.ceil(this.canvas.width * 0.25 / this.fs.num_inodes);
    this.block_width = Math.ceil(this.canvas.width * 0.75 / this.block_limit);
    this.ctx.stroke();

    this.duration = 500;

    this.registered_inodes = {};
    this.selected_inodes = [];

    this.register_inode(0);
}

FSAnimator.prototype.draw = function() {
	this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    for (var i = 0; i < this.fs.num_inodes; i++) {
        this.ctx.beginPath();
        this.ctx.rect(i * this.inode_width, 0, this.inode_width, this.ctx.canvas.height);
        if (this.registered_inodes[i]) {
            this.ctx.fillStyle = this.registered_inodes[i];
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    this.ctx.translate(this.canvas.width * 0.25, 0);

    for (var i = 0; i < this.block_limit; i++) {
        this.ctx.rect(i * this.block_width, 0, this.block_width, this.ctx.canvas.height);
        this.ctx.stroke();
    }

    this.ctx.translate(-1 * this.canvas.width * 0.25, 0);
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

FSAnimator.prototype.redraw = () => {};

FSAnimator.prototype.highlight_block = () => {};
FSAnimator.prototype.read_block_at = () => {};
FSAnimator.prototype.register_block_to_inode = () => {};
FSAnimator.prototype.deregister_block = () => {};

FSAnimator.prototype.deregister_inode = () => {};
FSAnimator.prototype.register_inode = function (inodenum) {
    console.log("Registered", inodenum);
    var color = getRandomColor();
    this.registered_inodes[inodenum] = color;
    this.draw();
};

FSAnimator.prototype.select_inode = () => {};
