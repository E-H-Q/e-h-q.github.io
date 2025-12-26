// IO.JS: HANDLES LOADING + SAVING MAP DATA

function save_map() {
	save_walls = JSON.stringify(walls);
	save_enemies = JSON.stringify(allEnemies);
	save_player = JSON.stringify(player);
	save_items = JSON.stringify(mapItems);
	name = "map";
	type = "text/plain";

	var file = new Blob([size + "\n" + save_walls + "\n" + save_enemies + "\n" + save_player + "\n" + save_items], {type: type});
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
		var loaded_player = lines[3]; // reads the fourth line (player position data)
		var loaded_items = lines[4]; // reads the fifth line (items data)

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
			if (loaded_player) {
				player = JSON.parse(loaded_player);
				
				// Reapply equipment effects after loading using helper function
				if (player.equipment) {
					// Reset to base stats
					player.attack_range = 4; // Default player attack range
					player.damage = 0;
					player.armor = 0;
					
					// Reapply all equipped items
					for (let slot in player.equipment) {
						if (player.equipment[slot]) {
							const itemDef = itemTypes[player.equipment[slot].itemType];
							if (itemDef) {
								applyEquipmentEffects(player, itemDef, true);
							}
						}
					}
				}
			} else {
				updatePlayer();
			}
			
			// Load items if available
			if (loaded_items) {
				try {
					mapItems = JSON.parse(loaded_items);
					// Update nextItemId to be higher than any loaded item id
					if (mapItems.length > 0) {
						const maxId = Math.max(...mapItems.map(item => item.id));
						nextItemId = maxId + 1;
					}
					console.log("Loaded " + mapItems.length + " items");
				} catch (e) {
					console.log("No items to load or invalid item data");
					mapItems = [];
				}
			} else {
				mapItems = [];
			}
			
			// Check enemy LOS after loading
			turns.checkEnemyLOS();
			
			update();
		}
	};
	reader.readAsText(load);
}
