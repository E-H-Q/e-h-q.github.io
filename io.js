// IO.JS: HANDLES LOADING + SAVING MAP DATA

function save_map() {
	const save_walls   = JSON.stringify(walls);
	const save_enemies = JSON.stringify(allEnemies);
	const save_player  = JSON.stringify(player);
	const save_items   = JSON.stringify(mapItems);
	const save_players = JSON.stringify(allPlayers);
	const name = "map";
	const type = "text/plain";

	const file = new Blob(
		[size + "\n" + save_walls + "\n" + save_enemies + "\n" + save_player + "\n" + save_items + "\n" + save_players],
		{type: type}
	);
	save_button.href = URL.createObjectURL(file);
	save_button.download = name;
}

function load_map() {
	const file_input = document.getElementById("file");
	if (file_input.files.length == 0) return false;
	const load = file_input.files[0];
	const reader = new FileReader();

	reader.onload = (event) => {
		const load = event.target.result;
		const lines = load.split('\n');

		size = JSON.parse(lines[0]);
		resizePtsArray();

		const loaded_walls   = lines[1];
		const loaded_enemies = lines[2];
		const loaded_player  = lines[3];
		const loaded_items   = lines[4];
		const loaded_players = lines[5]; // new — extra player-controlled entities

		if (!loaded_walls) {
			console.log("Failed to load map!");
			return;
		}

		walls = JSON.parse(loaded_walls);
		// Convert old wall format to new format
		walls = walls.map(wall => wall.type ? wall : {x: wall.x, y: wall.y, type: 'wall'});

		allEnemies = loaded_enemies ? JSON.parse(loaded_enemies) : [];

		if (loaded_player) {
			player = JSON.parse(loaded_player);
			if (player.equipment) {
				player.attack_range = 4;
				player.damage = 0;
				player.armor = 0;
				for (let slot in player.equipment) {
					if (player.equipment[slot]) {
						const itemDef = itemTypes[player.equipment[slot].itemType];
						if (itemDef) applyEquipmentEffects(player, itemDef, true);
					}
				}
			}
		} else {
			updatePlayer();
		}

		if (loaded_items) {
			try {
				mapItems = JSON.parse(loaded_items);
				if (mapItems.length > 0) {
					const maxId = Math.max(...mapItems.map(item => item.id));
					nextItemId = maxId + 1;
				}
				console.log("Loaded " + mapItems.length + " items");
			} catch (e) {
				mapItems = [];
			}
		} else {
			mapItems = [];
		}

		// Load extra player-controlled entities (backward compat: older saves have no line 5)
		try {
			allPlayers = loaded_players ? JSON.parse(loaded_players) : [];
		} catch (e) {
			allPlayers = [];
		}

		if (typeof updatePlayerSelect === 'function') updatePlayerSelect();
		turns.checkEnemyLOS();
		update();
	};
	reader.readAsText(load);
}
