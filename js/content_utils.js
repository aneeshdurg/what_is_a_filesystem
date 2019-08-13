function create_canvas(id) {
  var canvas = document.getElementById(id);
  var container = canvas.parentElement;
  var width = container.offsetWidth;
  var height = container.offsetHeight;
  canvas.width = width;
  canvas.height = "300";
  canvas.style.border = "1px solid #d3d3d3";
  return canvas;
}

function check_answer(value, correct) {
    var correct = value == correct;
    alert(correct ? 'correct!' : "sorry that's incorrect, try again");
    return false;
}

function cache_input(id, resolution) {
    resolution = resolution || 1000;
    var input = document.getElementById(id);
    input.value = localStorage.getItem(id) || "";
    return setInterval(function() {
        localStorage.setItem(id, input.value);
    }, resolution);
}

async function _import(args) {
  module = await import(args.src);
  if (args.name == '*') {
    if (!args.alias) {
      throw new Error("Alias is required when importing *");
    }

    window[args.alias] = module;
    return;
  }

  function add_to_window(name, alias) {
    alias = alias || name;
    window[alias] = module[name];
    if (typeof(window[alias]) == 'undefined')
      throw new Error("Couldn't find " + name + " in " + args.src);
  }

  if (args.name instanceof Array) {
    if (args.alias) {
      if (!(args.alias instanceof Array)) {
        throw new Error("Alias must be an array");
      }

      if (args.alias.length != args.name.length)
        throw new Error("Alias must have the same length as name");
    } else {
      args.alias = new Array(args.name.length);
    }

    for (var i = 0; i < args.name.length; i++) {
      add_to_window(args.name[i], args.alias[i]);
    }
  } else {
    add_to_window(args.name, args.alias);
  }
}
async function _import(args) {
  module = await import(args.src);
  if (args.name == '*') {
    if (!args.alias) {
      throw new Error("Alias is required when importing *");
    }

    window[args.alias] = module;
    return;
  }

  function add_to_window(name, alias) {
    alias = alias || name;
    window[alias] = module[name];
    if (typeof(window[alias]) == 'undefined')
      throw new Error("Couldn't find " + name + " in " + args.src);
  }

  if (args.name instanceof Array) {
    if (args.alias) {
      if (!(args.alias instanceof Array)) {
        throw new Error("Alias must be an array");
      }

      if (args.alias.length != args.name.length)
        throw new Error("Alias must have the same length as name");
    } else {
      args.alias = new Array(args.name.length);
    }

    for (var i = 0; i < args.name.length; i++) {
      add_to_window(args.name[i], args.alias[i]);
    }
  } else {
    add_to_window(args.name, args.alias);
  }
}
