// CANVAS.JS: DRAWS STUFF ON THE CANVAS "SCREEN"

var canvas = {
	init: function() {
		c.width = c.height = tileSize * viewportSize; // !!! FIRST USE OF THIS VAR
	},
	clear: function() {
		ctx.clearRect(0, 0, c.width, c.height);
	},
	grid: function() { // needs to be made modular for when size has X & Y values
		ctx.beginPath();
		ctx.lineWidth = 0.1;

		for(i = 0; i < size; i++) {
			for(j = 0; j < size; j++) {
				ctx.moveTo(i * tileSize, 0);
				ctx.lineTo(i * tileSize, c.height);
				ctx.moveTo(0, j * tileSize);
				ctx.lineTo(c.width, j * tileSize);
			}
		}
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
		ctx.stroke();
	},
	walls: function() {
		for (i = 0; i < walls.length; i++) {
			ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
			ctx.fillRect((walls[i].x - camera.x) * tileSize, (walls[i].y - camera.y) * tileSize, tileSize, tileSize);
		}
	},
	range: function(res) {
		if (res.length > 0 && res.length <= player.range + 1) {
			if(!valid.find(calc.repeat)) {
				ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
				ctx.fillRect((res[res.length - 1].x - camera.x) * tileSize, (res[res.length - 1].y - camera.y) * tileSize, tileSize, tileSize);
				valid.push(new calc.coordinate(i, j)); // shouldn't be here, but doesn't work anywhere else
			}
		}
	},
	los: function(path) {
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		for (i = 0; i < path.length; i++) {
			ctx.fillRect((path[i].x - camera.x) * tileSize, (path[i].y - camera.y) * tileSize, tileSize, tileSize);
		}
	},
	player: function() { // draws the player on screen
		ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
		ctx.fillRect((player.x - camera.x) * tileSize, (player.y - camera.y) * tileSize, tileSize, tileSize);
		img = document.getElementById("pep");
		ctx.drawImage(pep, (player.x - camera.x) * tileSize, (player.y - camera.y) * tileSize, tileSize, tileSize);
		// HP:
		ctx.fillStyle = "rgba(255, 255, 255, 1)";
		ctx.font = '16px serif';
		ctx.fillText(player.hp, (player.x - camera.x) * tileSize, (player.y+1 - camera.y) * tileSize);
	},
	enemy: function() { // draws the enemies
		if (enemy.hp >= 1) { // version of this is also in turns.attack()
			ctx.fillStyle = "rgba(125, 125, 0, 0.5)";
			ctx.fillRect((enemy.x - camera.x) * tileSize, (enemy.y - camera.y) * tileSize, tileSize, tileSize);
			img = document.getElementById("enemy");
			ctx.drawImage(img, (enemy.x - camera.x) * tileSize, (enemy.y - camera.y) * tileSize, tileSize, tileSize);
			// HP:
			ctx.fillStyle = "rgba(255, 255, 255, 1)";
			ctx.font = '16px serif';
			ctx.fillText(enemy.hp, (enemy.x - camera.x) * tileSize, (enemy.y+1 - camera.y) * tileSize);
		} else {
			return 0;
		}
	}
};
