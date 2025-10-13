// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init(); // sets up the cursor

function updateTurnOrder() {
	var turnOrder = document.getElementById("turn-order");
	var html = '';
	
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];
		const isActive = (i === currentEntityIndex);
		const turnsDisplay = isActive ? ` (${currentEntityTurnsRemaining}/${entity.turns})` : ` (${entity.turns})`;
		html += '<div class="turn-entity ' + (isActive ? 'active' : '') + '">' + 
		        entity.name.toUpperCase() + turnsDisplay + '</div>';
	}
	
	turnOrder.innerHTML = html;
}

function update() {
	// Populate entities array in turn order - player first, then living enemies
	entities = [player];
	for (let i = 0; i < allEnemies.length; i++) {
		if (allEnemies[i].hp >= 1) {
			entities.push(allEnemies[i]);
		}
	}
	
	// Reset turn index if player was removed/re-added
	if (currentEntityIndex >= entities.length) {
		currentEntityIndex = 0;
		currentEntityTurnsRemaining = 0;
	}
	
	camera = {
		x: player.x - Math.round((viewportSize / 2)) + 1,
		y: player.y - Math.round((viewportSize / 2)) + 1
	};
	canvas.init(); // creates/updates the canvas on page
	valid = [];
	canvas.clear();
	canvas.grid(); // draws the grid on canvas

	canvas.walls(); // draws the walls

	div_for_coords.innerHTML = "X: " + player.x + ", Y: " + player.y;
	
	canvas.player(); // draws the player
	canvas.enemy(); // draws the enemies	

	populate.enemies();
	populate.player();
	turns.check();
	updateTurnOrder();
}

document.getElementById("content").classList.remove("hidden"); // un-hides everything on the page
action.selectedIndex = 0; // resets the dropdown

function handleMouseMove(event) {
	if (currentEntityIndex >= 0 && entities[currentEntityIndex] !== player) {
		return; // Ignore mouse during enemy turns
	}
	input.mouse(event);
}

c.onmousemove = handleMouseMove; // mouse
cursor.addEventListener("click", input.click);
document.addEventListener("keyup", input.keyboard);

var div_for_coords = document.createElement("div");
document.body.appendChild(div_for_coords);

update();
