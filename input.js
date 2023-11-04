 // INPUT.JS: HANDLES USER INPUT

var input = {
	init: function() { // sets up the mouse cursor (move to other file/function?
		cursor.style.position = "absolute";
		cursor.style.visibility = "hidden";
		cursor.style.padding = ((tileSize / 2)) + "px";
		cursor.style.border = "1px solid #FF0000";
	},
	keyboard: function(event) {
		event = event || window.event;
	
		if (event.keyCode == 9) {
			switch (action.value) {
				case "move":
					action.value = "attack";
					break;
				case "attack":
					action.value = "move";
					break;
				default:
					break;
			};
			document.activeElement.blur();
			update();
		}
	},
	mouse: function(event) {
		event = event || window.event
		mouse_pos = {
			x: event.pageX, 
			y: event.pageY
		};
		cursor.style.left = Math.ceil((mouse_pos.x - tileSize) / tileSize) * tileSize + "px";
		cursor.style.top = Math.ceil((mouse_pos.y - tileSize) / tileSize) * tileSize + "px";
		cursor.style.visibility = "visible";

		// LOS follows mouse cursor
		if (action.value == "attack") {	
			var look = { // start + end coords for LOS
				start: {
					x: player.x,
					y: player.y
				},
				end: {
					x: Math.ceil(camera.x + mouse_pos.x / tileSize) - 1,
					y: Math.ceil(camera.y + mouse_pos.y / tileSize) - 1
				}
			};
			update();
			canvas.los(calc.los(look));
		}
	},
	click: function() {
		var click_pos = {
			x: camera.x + Math.ceil((mouse_pos.x - tileSize) / tileSize),
			y: camera.y + Math.ceil((mouse_pos.y - tileSize) / tileSize)
		};
		if (!click_pos.x) click_pos.x = 0;
		if (!click_pos.y) click_pos.y = 0;
		//console.log(click_pos);

		if (edit.checked == true) {
			var dup = walls.findIndex(element => element.x === click_pos.x && element.y === click_pos.y);
			if (dup < 0) {
				walls.push(new calc.coordinate(click_pos.x, click_pos.y));
			} else {
				walls.splice(dup, 1);
			}
			update();
		}
		switch (action.value) {
			case "move":
				for (i = 0; i < valid.length; i++) {
					if (click_pos.x == valid[i].x && click_pos.y == valid[i].y) {
						turns.move(player, click_pos.x, click_pos.y);
					}
				}
				break;
			case "attack":
				if (click_pos.x != enemy.x || click_pos.y != enemy.y) {
					return 0;
				}
				var look = { // start + end coords for LOS
					start: {
						x: player.x,
						y: player.y
					},
					end: {
						x: enemy.x,
						y: enemy.y
					}
				};
				var check = calc.los(look);
				if (check) {
					var dist = calc.distance(player.x, enemy.x, player.y, enemy.y);

					// some hacky shit here vvv might cause issues down the line...
					//console.log(check.length, dist);
					if (check.length == dist) {
						turns.attack(enemy, player); // enemy =/= enemies!
					} else if (check.length == dist + 1) {
						turns.attack(enemy, player);
					} else if (check.length == dist - 1) {
						turns.attack(enemy, player);
					} else {
						//console.log("ERR: check:", check.length, "dist:", dist);
						console.log("PLAYER shoots at the wall...");
						turns_taken++;
					}
					//turns.attack(player, enemy);
				}
				update();

				//console.log(calc.los().length);
				/*
				for (i = 0; i < entities.length; i++) {
					var dist = calc.distance(player.x, entities[i].x, player.y, entities[i].y);
					//console.log(dist);

					// some hacky shit here vvv might cause issues down the line...

					var look = { // start + end coords for LOS
						start: {
							x: player.x,
							y: player.y
						},
						end: {
							x: entities[i].x,
							y: entities[i].y
						}
					};

					if (entities[i].x == click_pos.x && entities[i].y == click_pos.y) {
						if (calc.los(look).length - 1 == dist) {
							turns.attack(enemy, player); // !!! ENEMY =/= ENTITIES??
						} else if (calc.los(look).length == dist) {
							turns.attack(enemy, player);
						}
					}
					break;
				}
				*/
			default:
				update();
				break;
		}
	}
};

