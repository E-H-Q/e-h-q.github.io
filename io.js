// IO.JS: HANDLES LOADING + SAVING MAP DATA

function save_map() {
	// player is allPlayers[0]; serialize all together
	const allEntities = [...allPlayers, ...allEnemies];

	function serializeEntities(arr) {
		return arr.map(e => {
			const out = Object.assign({}, e);
			if (out.following) out.following = allEntities.indexOf(out.following);
			else delete out.following;
			return out;
		});
	}

	const save_walls   = JSON.stringify(walls);
	const save_enemies = JSON.stringify(serializeEntities(allEnemies));
	const save_players = JSON.stringify(serializeEntities(allPlayers));
	const save_items   = JSON.stringify(mapItems);
	const name = "map";
	const type = "text/plain";

	const file = new Blob(
		[size + "\n" + save_walls + "\n" + save_enemies + "\n" + save_players + "\n" + save_items],
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

        const line3 = lines[3] ? lines[3].trim() : '';
        const isLegacy = line3.startsWith('{');
        const legacy_player  = isLegacy ? line3 : null;
        const loaded_players = isLegacy ? lines[5] : lines[3];
        const loaded_items   = lines[4];

        if (!loaded_walls) {
            console.log("Failed to load map!");
            return;
        }

        walls = JSON.parse(loaded_walls);
        walls = walls.map(wall => wall.type ? wall : {x: wall.x, y: wall.y, type: 'wall'});

        allEnemies = loaded_enemies ? JSON.parse(loaded_enemies) : [];

        if (legacy_player) {
            try {
                const p = JSON.parse(legacy_player);
                if (!p.traits) p.traits = [];
                if (!p.traits.includes('player')) p.traits.push('player');
                if (!p.playerColor) p.playerColor = "rgba(0, 0, 255, 0.5)";

                if (loaded_players) {
                    // if legacy player and line 5 players exist, append legacy player to allPlayers[]
                    allPlayers = JSON.parse(loaded_players);
                    allPlayers.push(p);
                } else {
                    allPlayers = [p];
                }
                player = allPlayers[0];

                // restore equipment + traits for every player (including the appended one)
                allPlayers.forEach(pp => {
                    if (pp.equipment) {
                        pp.attack_range = pp.attack_range || 4;
                        pp.damage = 0;
                        pp.armor = 0;
                        for (let slot in pp.equipment) {
                            if (pp.equipment[slot]) {
                                const itemDef = itemTypes[pp.equipment[slot].itemType];
                                if (itemDef) applyEquipmentEffects(pp, itemDef, true);
                            }
                        }
                    }
                    if (!pp.traits) pp.traits = [];
                    if (!pp.traits.includes('player')) pp.traits.push('player');
                });
            } catch(e) { console.log("Failed to load legacy player."); }
        }

        if (loaded_players && !legacy_player) {
            try {
                allPlayers = JSON.parse(loaded_players);
                allPlayers.forEach(p => {
                    if (p.equipment) {
                        p.attack_range = player.attack_range; // Uses DEFAULT PLAYER from main.js (Stops bug of map loading increasing attack_ranges)
                        p.damage = 0;
                        p.armor = 0;
                        for (let slot in p.equipment) {
                            if (p.equipment[slot]) {
                                const itemDef = itemTypes[p.equipment[slot].itemType];
                                if (itemDef) applyEquipmentEffects(p, itemDef, true);
                            }
                        }
                    }
                    if (!p.traits) p.traits = [];
                    if (!p.traits.includes('player')) p.traits.push('player');
                });
                if (allPlayers.length > 0) player = allPlayers[0];
                else updatePlayer();
            } catch(e) {
                console.log("Failed to load players, using default.");
            }
        } else if (!legacy_player) {
            updatePlayer();
        }

        if (loaded_items) {
            try {
                mapItems = JSON.parse(loaded_items);
                if (mapItems.length > 0) {
                    const maxId = Math.max(...mapItems.map(item => item.id));
                    nextItemId = maxId + 1;
                }
            } catch (e) {
                mapItems = [];
            }
        } else {
            mapItems = [];
        }

        if (loaded_items) {
            try {
                mapItems = JSON.parse(loaded_items);
                if (mapItems.length > 0) {
                    const maxId = Math.max(...mapItems.map(item => item.id));
                    nextItemId = maxId + 1;
                }
            } catch (e) {
                mapItems = [];
            }
        } else {
            mapItems = [];
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

		// Restore following references from saved indices
		const allEntities = [...allPlayers, ...allEnemies];
		allEntities.forEach(e => {
			if (typeof e.following === 'number') {
				e.following = allEntities[e.following] || null;
			} else {
				e.following = null;
			}
		});

		if (typeof updatePlayerSelect === 'function') updatePlayerSelect();
		turns.checkEnemyLOS();
		update();
	};
	reader.readAsText(load);
}