// TURNS.JS: HANDLES TURN ORDER AND TURN ACTIONS
var turns = {
	check: function() { // checks which action function(s) to call, (move, attack, item, etc.)
		if (player.hp < 1) {
			var music = new Audio('sound.wav');
			music.play();
			music.loop = false;
			music.playbackRate = 1.5;
			c.style = "pointer-events: none;";

			console.log("YOU DIED\n")
		}
		// hardcoded vars!:
		if (turns_taken == 4) { // enemy goes every other two turns
			turns_taken = 0;
		}
		if (turns_taken == 2 || turns_taken == 3) { 
			///////////////// -=- ENEMY TURN -=- /////////////////
			if (enemy.hp > 1) {
				var look = { // start + end coords for LOS
					start: {
						x: enemy.x,
						y: enemy.y
					},
					end: {
						x: player.x,
						y: player.y
					}
				};
				/*
				if (calc.los(look)) {
					console.log(calc.los(look));
					turns.attack(player, enemy);
				}
				*/
				var check = calc.los(look);
				if (check) {
					//console.log(check);
					var dist = calc.distance(enemy.x, player.x, enemy.y, player.y);
	
					//console.log(dist);
					// some hacky shit here vvv might cause issues down the line...
					if (check.length == dist || check.length == dist + 1) {
						// REMEMBER WHERE PLAYER IS
						enemy.seenX = player.x;
						enemy.seenY = player.y;
						// ATTACK vvv
						turns.attack(player, enemy); // enemy =/= enemies!
					/*
					} else if (check.length == dist + 1) {
						// ATTACK vvv
						turns.attack(player, enemy);
					*/
					} else {
						//console.log(valid);

						if (enemy.seenX == player.x && enemy.seenY == player.y) {	// if enemy has seen the player (WHAT IF PLAYER IS @ 1,1 ?!?!?!)
							calc.move(enemy);
							//var res = astar.search(graph, graph.grid[enemy.x][enemy.y], graph.grid[enemy.seenX][enemy.seenY]);
							//console.log(res);
							turns.move(enemy, enemy.x+1, enemy.y+1);
						} else {
							var direction = Math.floor(Math.random() * (9 - 1) + 1);
							switch (direction) {
								case 1:
									calc.move(enemy);
									turns.move(enemy, enemy.x-1, enemy.y+1);
									break;
								case 2:
									calc.move(enemy);
									turns.move(enemy, enemy.x, enemy.y+1);
									break;
								case 3:
									calc.move(enemy);
									turns.move(enemy, enemy.x+1, enemy.y+1);
									break;
								case 4:
									calc.move(enemy);
									turns.move(enemy, enemy.x-1, enemy.y);
									break;
								case 5:
									calc.move(enemy);
									console.log("ENEMY does nothing....");
									turns_taken++;
									break;
								case 6:
									calc.move(enemy);
									turns.move(enemy, enemy.x+1, enemy.y);
									break;
								case 7:
									calc.move(enemy);
									turns.move(enemy, enemy.x-1, enemy.y-1);
									break;
								case 8:
									calc.move(enemy);
									turns.move(enemy, enemy.x, enemy.y-1);
									break;
								case 9:
									calc.move(enemy);
									turns.move(enemy, enemy.x+1, enemy.y-1);
									break;
							}
						}
						//turns_taken++;
					}
					//turns.attack(player, enemy);
				}
				update();
			}
		}
		switch(action.value) {
			case "move":
				//console.log("MOVE");
				calc.move(player);
				break;
		}
	},
	move: function(entity, x, y) {	
		if (pts[x][y] != 0) {
			entity.x = x;
			entity.y = y;

			turns_taken++;
			update();
		}
	},
	attack: function(target, entity) {
		//console.log("ATTACK:");		
		var roll = calc.roll(6, 1);
		//console.log(roll);

		// determine hit (w stupid-dnd rules)
		if (roll >= 4) {
			roll = calc.roll(6, 1); // new roll
			target.hp = target.hp - roll;
			console.log("\n", entity.name, "hits", target.name, "for", roll, "DMG!");
			turns_taken++;
			//console.log(roll, "DAMAGE!!");
		} else {
			console.log("\n", entity.name, "attacks and misses", target.name, "...");
			//console.log("\n" + "MISS...");
			turns_taken++;
		}

		/*
		if (target.hp < 1) { // version of this is also in canvas.enemy()
			console.log("\n", entity.name, "kills", target.name, "with", roll, "DMG!!!");
			//console.log("KILL!!!");
			pts[target.x][target.y] = 1;
			entities.pop();
			turns_taken++;
			update();
		}
		*/
	}
};
