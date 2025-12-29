// CANVAS.JS: DRAWS STUFF ON THE CANVAS "SCREEN"

var canvas = {
	init: () => {
		c.width = c.height = tileSize * viewportSize;
	},
	
	clear: () => {
		ctx.clearRect(0, 0, c.width, c.height);
	},
	
	grid: () => {
		ctx.beginPath();
		ctx.lineWidth = 0.1;
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";

		for (let i = 0; i <= viewportSize; i++) {
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
		
		for (let i = 0; i < viewportSize; i++) {
			for (let j = 0; j < viewportSize; j++) {
				const worldX = camera.x + i;
				const worldY = camera.y + j;
				
				if (worldX < 0 || worldY < 0 || worldX >= size || worldY >= size) {
					const screenX = i * tileSize;
					const screenY = j * tileSize;
					
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
	
	walls: () => {
		ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
		walls.forEach(wall => {
			ctx.fillRect((wall.x - camera.x) * tileSize, (wall.y - camera.y) * tileSize, tileSize, tileSize);
		});
	},
	
	items: () => {
		if (!mapItems) return;

		mapItems.forEach(item => {
			const itemDef = itemTypes[item.itemType];
			const isEquipment = itemDef?.type === "equipment";
			
			ctx.fillStyle = isEquipment ? "rgba(255, 165, 0, 0.8)" : "rgba(255, 255, 255, 0.8)";
			
			const screenX = (item.x - camera.x) * tileSize;
			const screenY = (item.y - camera.y) * tileSize;
			ctx.fillRect(screenX, screenY, tileSize, tileSize);
			
			// Draw item label if not zoomed out
			if (!isZoomedOut && itemLabels[item.itemType]) {
				ctx.fillStyle = isEquipment ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
				ctx.font = 'bold 12px serif';
				ctx.textAlign = 'center';
				ctx.fillText(itemLabels[item.itemType], screenX + tileSize / 2, screenY + tileSize / 2 + 4);
				ctx.textAlign = 'left';
			}
		});
	},
	
	range: (res, entity) => {
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
	
	los: (path) => {
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => {
			ctx.fillRect((point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
		});
	},
	
	path: (path) => {
		ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
		path.forEach(point => {
			ctx.fillRect((point.x - camera.x) * tileSize, (point.y - camera.y) * tileSize, tileSize, tileSize);
		});
	},
	
	drawEntity: (entity, color, imgId) => {
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
		}
		// Draw "?" if enemy is unaware
		if (entity !== player && entity.seenX === 0 && entity.seenY === 0) {
			ctx.fillStyle = "rgba(255, 255, 255, 1)";
			ctx.font = 'bold 12px serif';
			ctx.textAlign = 'center';
			ctx.fillText("?", screenX + tileSize * 0.75, screenY + tileSize * 0.25);
			ctx.textAlign = 'left';
		}
	},
	
	drawOnionskin: () => {
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
	
	player: () => {
		if (player.hp >= 1) canvas.drawEntity(player, "rgba(0, 0, 255, 0.5)", "pep");
	},
	
	enemy: () => {
		allEnemies.forEach(enemy => {
			if (enemy.hp >= 1) canvas.drawEntity(enemy, "rgba(125, 125, 0, 0.5)", "enemy");
		});
	}
};
