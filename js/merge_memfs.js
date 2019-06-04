function get_merged_input(el) {
   var clone = el.cloneNode(true);
   var text_box = clone.children[0];
   var content = document.createTextNode(text_box.value);
   text_box.parentElement.replaceChild(content, text_box);
   return clone.textContent;
 }

function get_all_inputs() {
	var data = "";
	for (el of document.querySelectorAll("[id$='_memfs']")) {
		var node = get_merged_input(el);
		data += "\n" + node;
	}
	return data;
}

function get_all_solns() {
	var data = "";
	for (el of document.querySelectorAll("[id$='_soln']")) {
		data += "\n" + el.textContent;
	}
	return data;
}

function get_memfs_from_inputs(use_solution) {
	var source = null;
	if (use_solution)
		source = get_all_solns();
	else
		source = get_all_inputs();
	source = "function MemFS() { this.setup_root(); }; inherit(MemFS, DefaultFS); \n" + source;
	var MemFS = (function() {
		try {
			eval(source);
			return MemFS;
		} catch (e) {
			alert(e);
			return null;
		}
	})();
	return MemFS;
}
