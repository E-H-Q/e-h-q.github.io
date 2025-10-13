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
			// tricks the mouse event listener into activating when attack mode is enabled
			update();
			const trick = new MouseEvent('mousemove', {clientX: mouse_pos.x, clientY: mouse_pos.y});
			input.mouse(trick);
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
			
			//update();
			// If update is run, the enemies take infinite turns becuse the mouse movement during thier turn triggers update()
			canvas.clear();
			canvas.grid(); // draws the grid on canvas
			canvas.walls(); // draws the walls
			canvas.player(); // draws the player
			canvas.enemy(); // draws the enemies
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
				const dist = calc.distance(player.x, targetEnemy.x, player.y, targetEnemy.y);
				if (!check || check.length === 0) {
					return;
				}

				if (check) {
					if (check.length < dist) {
						console.log("blocked");
						return;
					}

					const lengthDiff = Math.abs(check.length - dist);	
					if (lengthDiff <= 1) {
						if (dist <= player.attack_range) {
							turns.attack(targetEnemy, player);
						}
					}
				}
				update();
				break;
			default:
				update();
		}
	}
};
