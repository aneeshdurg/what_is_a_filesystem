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
    this.registered_blocks = {};

    this.reading_blocks = [];
    this.selected_inodes = [];

    this.register_inode(0);
    this.draw();
}

FSAnimator.prototype.draw = function() {
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

    this.ctx.translate(this.canvas.width * 0.25, 0);

    for (var i = 0; i < this.block_limit; i++) {
        this.ctx.beginPath();
        this.ctx.rect(i * this.block_width, 0, this.block_width, this.ctx.canvas.height / 2);
        if (this.registered_blocks[i] != null) {
            this.ctx.fillStyle = this.registered_inodes[this.registered_blocks[i]];
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    var read_count = 0;
    while (read_count < this.block_limit/2 && this.reading_blocks.length) {
        read_count++;
        var i = this.reading_blocks.shift();
        console.log("Operating on block", i);
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

    this.ctx.translate(-1 * this.canvas.width * 0.25, 0);

    var that = this;
    setTimeout(() => { that.draw() }, this.duration);
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

FSAnimator.prototype.read_block = function (blocknum){
    this.reading_blocks.push(blocknum);
};

FSAnimator.prototype.register_block_to_inode = function (inodenum, blocknum){
    this.registered_blocks[blocknum] = inodenum;
};

FSAnimator.prototype.deregister_block = function (blocknum){
    //this.after_pending_operations(function (){
        this.registered_blocks[blocknum] = null;
    //})
};

FSAnimator.prototype.deregister_inode = function (inodenum){
    //this.after_pending_operations(function (){
        this.registered_inodes[inodenum] = null;
    //});
};

FSAnimator.prototype.register_inode = function (inodenum){
    //this.after_pending_operations(function (){
        console.log("Registered", inodenum);
        var color = getRandomColor();
        this.registered_inodes[inodenum] = color;
    //});
};

FSAnimator.prototype.select_inode = function (inodenum){
};
