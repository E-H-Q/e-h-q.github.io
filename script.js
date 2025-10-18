// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init(); // sets up the cursor

function updateTurnOrder() {
	var turnOrder = document.getElementById("turn-order");
	var html = '';
	
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];
		const isActive = (i === currentEntityIndex);
		const turnsDisplay = isActive ? ` (${currentEntityTurnsRemaining}/${entity.turns})` : ` (${entity.turns})`;
		
		// Add X button for all entities except player
		const killButton = entity !== player ? 
			`<button onclick="killEntity(${i})" style="float: right; background: #ff0000; color: #fff; border: none; margin-left: 6px; cursor: pointer; position: absolute;">X</button>` : '';
		
		html += '<div class="turn-entity ' + (isActive ? 'active' : '') + '">' + 
		        entity.name.toUpperCase() + turnsDisplay + killButton + '</div>';
	}
	
	turnOrder.innerHTML = html;
}

function updateInventory() {
	var inventoryDiv = document.getElementById("inventory-items");
	var html = '';
	
	if (player.inventory.length === 0) {
		html = '<p style="color: #888;">Empty</p>';
	} else {
		for (let i = 0; i < player.inventory.length; i++) {
			const item = player.inventory[i];
			const itemDef = itemTypes[item.itemType];
			html += '<div style="padding: 5px; margin: 3px 0; border: 1px solid #fff;">' +
			        (i + 1) + '. ' + itemDef.displayName + '</div>';
		}
	}
	
	inventoryDiv.innerHTML = html;
}

function killEntity(index) {
	if (index >= 0 && index < entities.length && entities[index] !== player) {
		entities[index].hp = 0;
		//entities.splice(index, 1);
		
		// Adjust current turn if killing an entity before current turn
		if (index < currentEntityIndex) {
			currentEntityIndex--;
		} else if (index === currentEntityIndex) {
			// If killing current entity, skip their turn
			currentEntityTurnsRemaining = 0;
		}
		
		update();
	}
}

function update() {
	// Remove dead enemies from allEnemies
	allEnemies = allEnemies.filter(enemy => enemy.hp >= 1);
	
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
	
	// Center camera on current entity
	const currentEntity = entities[currentEntityIndex] || player;
	camera = {
		x: currentEntity.x - Math.round((viewportSize / 2)) + 1,
		y: currentEntity.y - Math.round((viewportSize / 2)) + 1
	};
	
	canvas.init(); // creates/updates the canvas on page
	valid = [];
	canvas.clear();
	canvas.grid(); // draws the grid on canvas

	canvas.walls(); // draws the walls
	canvas.items(); // draws the items
	
	canvas.player(); // draws the player
	canvas.enemy(); // draws the enemies	

	populate.enemies();
	populate.player();
	turns.check();
	updateTurnOrder();
	updateInventory();

	var elem = document.getElementById("log");
	elem.scrollTop = elem.scrollHeight;
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
cursor.addEventListener("contextmenu", input.right_click);
document.addEventListener("keydown", input.keyboard);
document.addEventListener("keyup", input.keyboard);

var div_for_coords = document.createElement("div");
document.body.appendChild(div_for_coords);

update();
