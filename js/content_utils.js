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
