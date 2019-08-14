class Task{
    constructor(resolve, callback) {
        this.resolve = resolve;
        this.callback = callback;
    }
}

class ReadTask extends Task {
    constructor(resolve, blocknum, is_write) {
        super(resolve, function() {
            this.reading_blocks.push({
                blocknum: blocknum,
                is_write: is_write,
            });
        });
    }
}

export class FSAnimator {
    constructor(fs, canvas, block_limit) {
        var that = this;

        this.canvas = canvas;
        this.canvas.onclick = async function (event) {
            // https://stackoverflow.com/a/18053642/5803067
            const rect = that.canvas.getBoundingClientRect()
            const x = event.clientX - rect.left
            const y = event.clientY - rect.top

            if (y > (that.canvas.height / 2)) {
                that.selected_inode = null;
                return;
            }

            if (x < (that.canvas.width * that.inode_space) ) {
                // clicked on an inode
                const inodenum = Math.floor(x / that.inode_width);
                const inode = that.fs.inodes[inodenum];
                that.select_inode(inodenum, inode);
            } else {
                // clicked on a block
                this._disable = true;
                const blocknum = Math.floor((x - (that.canvas.width * that.inode_space)) / that.block_width);
                const lookup = await that.fs.get_inode_from_blocknum(blocknum);
                if (lookup) {
                    console.log(lookup);
                    that.select_inode(lookup.inodenum, lookup.inode);
                } else {
                    that.selected_inode = null;
                }

                this._disable = false;
            }
        }
        this.ctx = canvas.getContext("2d");
        this.fs = fs; // instance of MyFS
        if (!block_limit)
            block_limit = 50
        this.inode_space = 0.35;
        this.block_limit = Math.min(block_limit, this.fs.num_blocks);

        this.inode_width = this.canvas.width * this.inode_space / this.fs.num_inodes;
        this.block_width = this.canvas.width * (1 - this.inode_space) / this.block_limit;

        this.tasks = [];

        this.registered_inodes = {};
        this.registered_blocks = {};
        this.registered_colors = new Set();

        this.register_inode(0);

        this.reading_blocks = [];

        this.show_ptr = false;
        this.ptr_pos = 0;
        this.ptr_speed = 0;

        this.cache_enable = false;
        this.cache_size = 8;
        this.cache = [];
        this.cache_policy = null; // TODO allow changing the cache policy (currently LRU)
        this.setup_cache();

        this.selected_inode = null;

        this.duration = null;
        this.timer = null;
        this.reload_duration();

        this._disable = false;
    }

    setup_cache() {
        this.cache = [];
        for (let i = 0; i < this.cache_size; i++)
            this.cache.push(0);
    }

    set_ptr_speed(speed) {
        this.ptr_speed = speed * this.block_width;
    }

    set_duration(duration) {
        duration = Number(duration);

        this.duration = duration;
        console.log("Animation speed is set to", this.duration);

        clearTimeout(this.timer);
        var that = this;
        if (this.duration > 0)
          this.timer = setInterval(() => { that.draw() }, this.duration);
    }

    save_duration(duration) {
        this.set_duration(duration);
        localStorage.setItem("ANIMATOR_DURATION", this.duration);
    }

    reload_duration() {
        this.set_duration(Number(localStorage.getItem("ANIMATOR_DURATION")) || 100);
    }

    draw() {
        var currtask = null;
        if (this.tasks.length) {
            currtask = this.tasks.shift();
            currtask.callback.call(this);
        }

      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
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
            } else {
                this.ctx.fillStyle = "white";
                this.ctx.fill();
            }
            this.ctx.stroke();
        }

        let waiting_for_disk = false;
        if (this.reading_blocks.length) {
            var entry = this.reading_blocks.shift();
            var i = entry.blocknum;
            var ptr_target = i * this.block_width;

            var found_in_cache = false;
            if (this.cache_enable && (this.cache.indexOf(i) >= 0)) {
                found_in_cache = true;
                this.cache = this.cache.concat(this.cache.splice(this.cache.indexOf(i), 1));
            }

            var needs_ptr_move = (!found_in_cache) || entry.is_write;
            if (needs_ptr_move) {
                var sign = ptr_target > this.ptr_pos ? 1 : -1;
                if (this.ptr_speed)
                    this.ptr_pos += sign * Math.min(Math.abs(ptr_target - this.ptr_pos), this.ptr_speed);
                else
                    this.ptr_pos = ptr_target;
            }

            if (needs_ptr_move && this.ptr_pos != ptr_target) {
                this.tasks.unshift(currtask);
                waiting_for_disk = true;
            } else {
                if (this.cache_enable && !found_in_cache) {
                    this.cache.shift();
                    this.cache.push(i);
                }
                this.ctx.beginPath();
                this.ctx.globalAlpha = 0.2;
                this.ctx.rect(i * this.block_width, 0, this.block_width, this.ctx.canvas.height / 2);
                if (this.registered_blocks[i] != null) {
                    this.ctx.fillStyle = "black";
                    this.ctx.fill();
                }
                this.ctx.stroke();
                this.ctx.globalAlpha = 1;
            }

            this.draw_ptr();
        }

        this.draw_ptr();

        this.ctx.translate(-1 * this.canvas.width * this.inode_space, 0);

        this.draw_selected_inode();

        if (currtask && !waiting_for_disk) {
            currtask.resolve();
        }
    }

    draw_ptr() {
        if (!this.show_ptr)
            return;

        this.ctx.fillStyle = "white";

        this.ctx.beginPath();
        this.ctx.rect(this.ptr_pos - this.block_width/2, 0, this.block_width * 2, 20); // disk ptr
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.ptr_pos, 20);
        this.ctx.lineTo(this.ptr_pos +  this.block_width, 20);
        this.ctx.lineTo(this.ptr_pos + 0.5 * this.block_width, 25);
        this.ctx.fill();
        this.ctx.closePath();
    }

    async submitTask(callback){
        if (this._disable)
            return;
        var promise_collector = []
        var p = new Promise(resolve => promise_collector.push(resolve));
        while (promise_collector.length == 0) {};

        var task = new Task(promise_collector[0], callback);
        this.tasks.push(task);
        return p;
    }

    async submitReadTask(blocknum, is_write){
        if (this._disable)
            return;
        var promise_collector = []
        var p = new Promise(resolve => promise_collector.push(resolve));
        while (promise_collector.length == 0) {};

        var task = new ReadTask(promise_collector[0], blocknum, is_write);
        this.tasks.push(task);
        return p;
    }

    async read_block(blocknum, is_write){
        await this.submitReadTask(blocknum, is_write);
    }

    async register_block_to_inode(inodenum, blocknum){
        function callback() {
            this.registered_blocks[blocknum] = inodenum;
        }
        await this.submitTask(callback);
    }

    async deregister_block(blocknum){
        function callback(){
            this.registered_blocks[blocknum] = null;
        }
        await this.submitTask(callback);
    }

    async deregister_inode(inodenum){
        function callback(){
            if (this.registered_inodes[inodenum]) {
                this.registered_colors.delete(this.registered_inodes[inodenum]);
                this.registered_inodes[inodenum] = null;
            }
        }
        await this.submitTask(callback);
    }

    // https://stackoverflow.com/questions/1484506/random-color-generator
    getRandomColor() {
      var letters = '0123456789ABCDEF';
      var color = '#';
      for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    }

    async register_inode(inodenum){
        function callback(){
            var color = null;
            while (true) {
                color = this.getRandomColor();
                if (this.registered_colors.has(color))
                    continue

                this.registered_colors.add(color);
                break;
            }
            this.registered_inodes[inodenum] = color;
        }
        var p = this.submitTask(callback);
        await p;
    }

    select_inode(inodenum, inode){
        this.selected_inode = {
            inodenum: inodenum,
            inode: inode,
        }
    }

    // https://stackoverflow.com/a/6333775/5803067
    canvas_arrow(context, fromx, fromy, tox, toy){
        var headlen = 10;   // length of head in pixels
        var angle = Math.atan2(toy-fromy,0);
        context.beginPath();
        context.moveTo(fromx, fromy);
        context.bezierCurveTo(fromx, fromy + 20, tox, toy + 20, tox, toy);
        //context.lineTo(tox-headlen*Math.cos(angle-Math.PI/6),toy-headlen*Math.sin(angle-Math.PI/6));
        //context.moveTo(tox, toy);
        //context.lineTo(tox-headlen*Math.cos(angle+Math.PI/6),toy-headlen*Math.sin(angle+Math.PI/6));
        context.stroke();
    }

    draw_selected_inode() {
        if (!this.selected_inode)
            return;

        var inodenum = this.selected_inode.inodenum;
        var inode = this.selected_inode.inode;

        this.ctx.translate(0, this.ctx.canvas.height / 2);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height / 2);
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.inode_width * 5, this.ctx.canvas.height / 2);
        this.ctx.rect(0, 0, this.inode_width * 5, this.ctx.canvas.height / 2);
        this.ctx.fillStyle = inode.num_links ? this.registered_inodes[inodenum] : "white";
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
            var indirect_label = "Indirect: " + Array.from(inode.indirect).join(" ");
            this.ctx.fillText(indirect_label, w_offset, h_offset);
            var ind_x = this.inode_width * this.fs.num_inodes + this.block_width * inode.indirect + this.block_width/2;
            var ind_y = 1;
            this.canvas_arrow(
                this.ctx,
                w_offset + font_width * indirect_label.length,
                h_offset - 10,
                ind_x,
                ind_y);
            h_offset += 20;
            var disk_offset = inode.indirect[0] * this.fs.block_size;
            var indirect_array = new Uint8Array(this.fs.disk, disk_offset, num_blocks);
            var indirect_array_str = indirect_array.join(" ");
            for (let block_idx of indirect_array) {
                this.ctx.beginPath();
                this.ctx.moveTo(ind_x, ind_y);
                var to_x = this.inode_width * this.fs.num_inodes + this.block_width * block_idx + this.block_width/2;
                var to_y = ind_y;
                this.ctx.bezierCurveTo(ind_x, ind_y + 20, to_x, to_y + 20, to_x, to_y);
                this.ctx.stroke();
            }

            this.ctx.fillText(indirect_array_str, w_offset + font_width * "Indirect: ".length, h_offset);
            h_offset += 20;

            num_blocks = 0;
        }

        this.ctx.translate(0, -1 * this.ctx.canvas.height / 2);

    }
}
