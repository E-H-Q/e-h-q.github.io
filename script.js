// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init(); // sets up the cursor

// Override console.log to display in both browser console and HTML
var logDiv = document.getElementById("log");
var originalLog = console.log;
console.log = function() {
	// Call original console.log
	originalLog.apply(console, arguments);
	
	// Display in HTML
	var message = Array.from(arguments).map(arg => 
		typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
	).join(' ');
	
	logDiv.innerHTML += message + '<br>';
	logDiv.scrollTop = logDiv.scrollHeight;
};

function updateTurnOrder() {
	var turnOrder = document.getElementById("turn-order");
	var html = '';
	
	for (let i = 0; i < entities.length; i++) {
		const entity = entities[i];
		const isActive = (i === currentEntityIndex);
		const turnsDisplay = isActive ? ` (${currentEntityTurnsRemaining}/${entity.turns})` : ` (${entity.turns})`;
		
		// Add X button for all entities except player
		const killButton = entity !== player ? 
			`<button onclick="killEntity(${i})" style="float: right; background: #ff0000; color: #fff; border: none; padding: 2px 6px; cursor: pointer;">X</button>` : '';
		
		html += '<div class="turn-entity ' + (isActive ? 'active' : '') + '">' + 
		        entity.name.toUpperCase() + turnsDisplay + killButton + '</div>';
	}
	
	turnOrder.innerHTML = html;
}

function killEntity(index) {
	if (index >= 0 && index < entities.length && entities[index] !== player) {
		entities[index].hp = 0;
		
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
	
	// Rebuild pts array with walls
	pts = createAndFillTwoDArray({rows: size, columns: size, defaultValue: 1});
	for (let i = 0; i < walls.length; i++) {
		if (pts[walls[i].x] && pts[walls[i].x][walls[i].y] !== undefined) {
			pts[walls[i].x][walls[i].y] = 0;
		}
	}
	
	valid = [];
	canvas.clear();
	canvas.grid(); // draws the grid on canvas

	canvas.walls(); // draws the walls
	
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
