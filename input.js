// INPUT.JS: HANDLES USER INPUT

var input = {
	init: function() {
		cursor.style.position = "absolute";
		cursor.style.visibility = "hidden";
		cursor.style.padding = (tileSize / 2) + "px";
		cursor.style.border = "1px solid #FF0000";
	},
	keyboard: function(event) {
		if (event.keyCode === 9) {
			action.value = (action.value === "move") ? "attack" : "move";
			document.activeElement.blur();
			update();
		}
	},
	mouse: function(event) {
		mouse_pos = {
			x: event.pageX, 
			y: event.pageY
		};
		cursor.style.left = Math.ceil((mouse_pos.x - tileSize) / tileSize) * tileSize + "px";
		cursor.style.top = Math.ceil((mouse_pos.y - tileSize) / tileSize) * tileSize + "px";

		if (action.value === "attack") {	
			const endX = Math.ceil(camera.x + mouse_pos.x / tileSize) - 1;
			const endY = Math.ceil(camera.y + mouse_pos.y / tileSize) - 1;
			
			const look = {
				start: { x: player.x, y: player.y },
				end: { x: endX, y: endY }
			};
			
			const dist = calc.distance(player.x, endX, player.y, endY);
			let path = calc.los(look);
			
			// Limit path to player range and remove first element (player position)
			if (path.length > player.attack_range + 1) {
				path = path.slice(1, player.attack_range + 1);
			} else {
				path = path.slice(1);
			}
			
			// Hide red box if out of range
			if (dist > player.attack_range) {
				cursor.style.visibility = "hidden";
			} else {
				cursor.style.visibility = "visible";
			}
			
			update();
			canvas.los(path);
		} else {
			cursor.style.visibility = "visible";
		}
	},
	click: function() {
		const click_pos = {
			x: camera.x + Math.ceil((mouse_pos.x - tileSize) / tileSize) || 0,
			y: camera.y + Math.ceil((mouse_pos.y - tileSize) / tileSize) || 0
		};

		if (edit.checked) {
			const dup = walls.findIndex(el => el.x === click_pos.x && el.y === click_pos.y);
			if (dup < 0) {
				walls.push(new calc.coordinate(click_pos.x, click_pos.y));
			} else {
				walls.splice(dup, 1);
			}
			update();
			return;
		}

		switch (action.value) {
			case "move":
				const validClick = valid.find(v => v.x === click_pos.x && v.y === click_pos.y);
				if (validClick) {
					turns.move(player, click_pos.x, click_pos.y);
				}
				break;
			case "attack":
				// Find which enemy was clicked
				let targetEnemy = null;
				for (let i = 0; i < allEnemies.length; i++) {
					if (click_pos.x === allEnemies[i].x && click_pos.y === allEnemies[i].y && allEnemies[i].hp > 0) {
						targetEnemy = allEnemies[i];
						break;
					}
				}
				
				if (!targetEnemy) return;
				
				const look = {
					start: { x: player.x, y: player.y },
					end: { x: targetEnemy.x, y: targetEnemy.y }
				};
				const check = calc.los(look);
				
				if (check) {
					const dist = calc.distance(player.x, targetEnemy.x, player.y, targetEnemy.y);
					
					// Check if target is within range
					if (dist > player.attack_range) {
						console.log("Target out of range!");
						return;
					}
					
					const lengthDiff = Math.abs(check.length - dist);
					
					if (lengthDiff <= 1) {
						turns.attack(targetEnemy, player);
					} else {
						console.log("PLAYER shoots at the wall...");
					}
				}
				update();
				break;
			default:
				update();
		}
	}
};
