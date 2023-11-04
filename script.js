// SCRIPT.JS: RUNS ALL THE FUNCTIONS IN THIER CORRECT ORDER ***THIS FILE RUNS THE WHOLE THING***

input.init(); // sets up the cursor

function update() {
	camera = {
		x: player.x - Math.round((viewportSize / 2)) + 1,
		y: player.y - Math.round((viewportSize / 2)) + 1
	};
	//if(camera.x < 0){camera.x = 0;}
	//if(camera.y < 0){camera.y = 0;}
	//if((camera.x + viewportSize) > size){camera.x -= (camera.x + viewportSize - size);}
	//if((camera.y + viewportSize) > size){camera.y -= (camera.y + viewportSize - size);}
	canvas.init(); // creates/updates the canvas on page
	valid = [];
	canvas.clear();
	canvas.grid(); // draws the grid on canvas

	canvas.walls(); // draws the walls
	delete click_pos;

	div_for_turns_taken.innerHTML = "TURN #: " + turns_taken;
	div_for_coords.innerHTML = "X: " + player.x + ", Y: " + player.y;
	
	canvas.player(); // draws the player
	canvas.enemy(); // draws the enemies	

	populate.enemies();
	turns.check();
}

document.getElementById("content").classList.remove("hidden"); // un-hides everything on the page
action.selectedIndex = 0; // resets the dropdown
c.onmousemove = input.mouse; // mouse
cursor.addEventListener("click", input.click);
document.addEventListener("keyup", input.keyboard);

var div_for_turns_taken = document.createElement("div"); // creates a div element
document.body.appendChild(div_for_turns_taken);

var div_for_coords = document.createElement("div");
document.body.appendChild(div_for_coords);

update();
