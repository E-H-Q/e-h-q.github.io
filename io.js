// IO.JS: HANDLES LOADING + SAVING MAP DATA

function save_map() {
	save_walls = JSON.stringify(walls);
	save_enemies = JSON.stringify(allEnemies);
	save_player_pos = JSON.stringify({x: player.x, y: player.y});
	name = "map";
	type = "text/plain";

	var file = new Blob([size + "\n" + save_walls + "\n" + save_enemies + "\n" + save_player_pos], {type: type});
	save_button.href = URL.createObjectURL(file);
	save_button.download = name;
}

function load_map() {
	file_input = document.getElementById("file");

	if (file_input.files.length == 0) return false;
	const load = file_input.files[0];
	let reader = new FileReader();

	reader.onload = (event) => {
		const load = event.target.result;

		var lines = load.split('\n');
		size = JSON.parse(lines[0]); // will need to be modified for sizeX and sizeY when they exist
		resizePtsArray(); // Resize pts array to match new map size
		var loaded_walls = lines[1]; // reads the second line (map data)
		var loaded_enemies = lines[2]; // reads the third line (enemy/entity data)
		var loaded_player_pos = lines[3]; // reads the fourth line (player position data)

		//walls = [];
		if (!loaded_walls) {
			console.log("Failed to load map!");
			return;
		} else {
			walls = JSON.parse(loaded_walls);
			if (loaded_enemies) {
				allEnemies = JSON.parse(loaded_enemies);
			} else {
				allEnemies = [];
			}
			
			// Load player position if available
			if (loaded_player_pos) {
				const playerPos = JSON.parse(loaded_player_pos);
				player.x = playerPos.x;
				player.y = playerPos.y;
			}
			
			update();
		}
	};
	reader.readAsText(load);
}
