// CANVAS.JS: DRAWS STUFF ON THE CANVAS "SCREEN"

var canvas = {
	init: function() {
		c.width = c.height = tileSize * viewportSize;
	},
	clear: function() {
		ctx.clearRect(0, 0, c.width, c.height);
	},
	grid: function() {
		ctx.beginPath();
		ctx.lineWidth = 0.1;
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";

		for(let i = 0; i <= size; i++) {
			const pos = i * tileSize;
			ctx.moveTo(pos, 0);
			ctx.lineTo(pos, c.height);
			ctx.moveTo(0, pos);
			ctx.lineTo(c.width, pos);
		}
		ctx.stroke();
	},
	walls: function() {
		ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
		for (let i = 0; i < walls.length; i++) {
			ctx.fillRect((walls[i].x - camera.x) * tileSize, (walls[i].y - camera.y) * tileSize, tileSize, tileSize);
		}
	},
	range: function(res, entity) {
		if (res.length > 0 && res.length <= entity.range + 1) {
			const coord = new calc.coordinate(res[res.length - 1].x, res[res.length - 1].y);
			
			// Only add to valid array for player
			if (entity === player && !valid.find(item => item.x === coord.x && item.y === coord.y)) {
				valid.push(coord);
			}
			
			ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
			ctx.fillRect((coord.x - camera.x) * tileSize, (coord.y - camera.y) * tileSize, tileSize, tileSize);
		}
	},
	los: function(path) {
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		for (let i = 0; i < path.length; i++) {
			ctx.fillRect((path[i].x - camera.x) * tileSize, (path[i].y - camera.y) * tileSize, tileSize, tileSize);
		}
	},
	drawEntity: function(entity, color, imgId) {
		ctx.fillStyle = color;
		const screenX = (entity.x - camera.x) * tileSize;
		const screenY = (entity.y - camera.y) * tileSize;
		ctx.fillRect(screenX, screenY, tileSize, tileSize);
		
		const img = document.getElementById(imgId);
		ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
		
		ctx.fillStyle = "rgba(255, 255, 255, 1)";
		ctx.font = '16px serif';
		ctx.fillText(entity.hp, screenX, screenY + tileSize);
		
		// Draw "?" if enemy is unaware (no seenX/seenY)
		if (entity !== player && entity.seenX === 0 && entity.seenY === 0) {
			ctx.fillStyle = "rgba(255, 255, 255, 1)";
			ctx.font = 'bold 12px serif';
			ctx.textAlign = 'center';
			ctx.fillText("?", screenX + tileSize * 0.75, screenY + tileSize * 0.25);
			ctx.textAlign = 'left'; // Reset alignment
		}
	},
	player: function() {
		if (player.hp >= 1) {
			this.drawEntity(player, "rgba(0, 0, 255, 0.5)", "pep");
		}
	},
	enemy: function() {
		for (var i = 0; i < allEnemies.length; i++) {
		if (allEnemies[i].hp >= 1) {
			this.drawEntity(allEnemies[i], "rgba(125, 125, 0, 0.5)", "enemy");
		}
	}
}
};
