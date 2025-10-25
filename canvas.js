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

		for(let i = 0; i <= viewportSize; i++) {
			const pos = i * tileSize;
			ctx.moveTo(pos, 0);
			ctx.lineTo(pos, c.height);
			ctx.moveTo(0, pos);
			ctx.lineTo(c.width, pos);
		}
		ctx.stroke();
		
		// Draw X on out of bounds tiles
		ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
		ctx.lineWidth = 1;
		
		for(let i = 0; i < viewportSize; i++) {
			for(let j = 0; j < viewportSize; j++) {
				const worldX = camera.x + i;
				const worldY = camera.y + j;
				
				// Check if tile is out of bounds
				if (worldX < 0 || worldY < 0 || worldX >= size || worldY >= size) {
					const screenX = i * tileSize;
					const screenY = j * tileSize;
					
					// Draw X
					ctx.beginPath();
					ctx.moveTo(screenX, screenY);
					ctx.lineTo(screenX + tileSize, screenY + tileSize);
					ctx.moveTo(screenX + tileSize, screenY);
					ctx.lineTo(screenX, screenY + tileSize);
					ctx.stroke();
				}
			}
		}
	},
	walls: function() {
		ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
		for (let i = 0; i < walls.length; i++) {
			ctx.fillRect((walls[i].x - camera.x) * tileSize, (walls[i].y - camera.y) * tileSize, tileSize, tileSize);
		}
	},
	items: function() {
		if (typeof mapItems === 'undefined' || !mapItems) return;
		
		for (let i = 0; i < mapItems.length; i++) {
			const itemDef = itemTypes[mapItems[i].itemType];
			const isEquipment = itemDef && itemDef.type === "equipment";
			
			// Different colors for equipment vs consumables
			ctx.fillStyle = isEquipment ? "rgba(255, 165, 0, 0.8)" : "rgba(255, 255, 255, 0.8)";
			
			const screenX = (mapItems[i].x - camera.x) * tileSize;
			const screenY = (mapItems[i].y - camera.y) * tileSize;
			ctx.fillRect(screenX, screenY, tileSize, tileSize);
			
			// Draw item label if not zoomed out
			if (!isZoomedOut) {
				ctx.fillStyle = isEquipment ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
				ctx.font = 'bold 12px serif';
				ctx.textAlign = 'center';
				switch (mapItems[i].itemType) {
					case "healthPotion":
						ctx.fillText("HP+", screenX + tileSize / 2, screenY + tileSize / 2 + 4);	
						break;
					case "speedPotion":
						ctx.fillText("SP+", screenX + tileSize / 2, screenY + tileSize / 2 + 4);	
						break;
					case "scope":
						ctx.fillText("Scp", screenX + tileSize / 2, screenY + tileSize / 2 + 4);	
						break;
					case "rifle":
						ctx.fillText("Gun", screenX + tileSize / 2, screenY + tileSize / 2 + 4);	
						break;
				}
				ctx.textAlign = 'left';
			}
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
		
		// Only draw text when not zoomed out
		if (!isZoomedOut) {
			ctx.fillStyle = "rgba(255, 255, 255, 1)";
			ctx.font = '16px serif';
			ctx.fillText(entity.hp, screenX, screenY + tileSize);
			
			// Draw "?" if enemy is unaware (seenX and seenY are both 0)
			if (entity !== player && (entity.seenX === 0 && entity.seenY === 0)) {
				ctx.fillStyle = "rgba(255, 255, 255, 1)";
				ctx.font = 'bold 12px serif';
				ctx.textAlign = 'center';
				ctx.fillText("?", screenX + tileSize * 0.75, screenY + tileSize * 0.25);
				ctx.textAlign = 'left'; // Reset alignment
			}
		}
	},
	drawOnionskin: function() {
		// Draw ghost image at peek start position
		if (isPeekMode && peekStep > 0) {
			const screenX = (peekStartX - camera.x) * tileSize;
			const screenY = (peekStartY - camera.y) * tileSize;
			
			ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
			ctx.fillRect(screenX, screenY, tileSize, tileSize);
			
			const img = document.getElementById("pep");
			ctx.globalAlpha = 0.3;
			ctx.drawImage(img, screenX, screenY, tileSize, tileSize);
			ctx.globalAlpha = 1.0;
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
