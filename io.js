// IO.JS: HANDLES SAVING AND LOADING MAPS

function save_map() {
	const map_data = {
		size: size,
		walls: walls,
		allEnemies: allEnemies
	};
	const json = JSON.stringify(map_data);
	const blob = new Blob([json], {type: "application/json"});
	const url = URL.createObjectURL(blob);
	save_button.href = url;
	save_button.download = "map.json";
}

function load_map() {
	const file = fileInput.files[0];
	if (!file) return;
	
	const reader = new FileReader();
	reader.onload = function(e) {
		const content = e.target.result;
		
		try {
			// Parse as JSON object format
			const data = JSON.parse(content);
			
			if (data.walls && Array.isArray(data.walls)) {
				walls = data.walls;
				
				if (data.allEnemies && Array.isArray(data.allEnemies)) {
					allEnemies = data.allEnemies;
				}
				
				// If size is included in the data, update it
				if (data.size && !isNaN(data.size)) {
					size = data.size;
					viewportSize = data.size;
					pts = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
					
					// Populate walls into pts array
					for (let i = 0; i < walls.length; i++) {
						if (pts[walls[i].x] && pts[walls[i].x][walls[i].y] !== undefined) {
							pts[walls[i].x][walls[i].y] = 0;
						}
					}
					
					// Reset player position to center
					player.x = Math.floor(viewportSize / 2);
					player.y = Math.floor(viewportSize / 2);
				}
				
				console.log("Loaded map file: " +'"'+ file.name+'"');
				update();
			}
		} catch (error) {
			console.error("Error loading map:", error);
			alert("Failed to load map file. Check console for details.");
		}
	};
	
	reader.readAsText(file);
}
