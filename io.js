// IO.JS: HANDLES LOADING + SAVING MAP DATA

function KILL_ENEMY() { // here temporarily, just a sloppy function passing through ;^)
	enemy.hp = 0;
	update();
}

function save_map() {
	text = JSON.stringify(walls);
	name = "map";
	type = "text/plain";

	var file = new Blob([size + "\n" + text], {type: type});
	save_button.href = URL.createObjectURL(file);
	save_button.download = name;
}

function load_map() {
	input = document.getElementById("file");

	if (input.files.length == 0) return false;
	const load = input.files[0];
	let reader = new FileReader();

	reader.onload = (event) => {
		const load = event.target.result;

		var lines = load.split('\n');
		size = JSON.parse(lines[0]); // will need to be modified for sizeX and sizeY when they exist
		var loaded = lines[1]; // reads the second line (map data)

		//walls = [];
		walls = JSON.parse(loaded);
		update();
	};
	reader.readAsText(load);
}

/*
function save_map() {
	text = walls;
	name = "map";
	type = "text/plain";

	var file = new Blob([size + "\n" + text], {type: type});
	save_button.href = URL.createObjectURL(file);
	save_button.download = name;
}

function load_map() {
	var input = document.getElementById("file");

	if (input.files.length == 0) return false;
	const load = input.files[0];
	let reader = new FileReader();

	reader.onload = (event) => {
		const load = event.target.result;

		var lines = load.split('\n');
		size = lines[0];
		var loaded = lines[1].split(","); // reads the second line (map data)

		walls = [];
		while (loaded.length) {
			walls.push(loaded.splice(0, size));
			console.log(loaded);
		}
		update();
	};
	reader.readAsText(load);
}
*/
