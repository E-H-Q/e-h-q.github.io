// LOS.JS: LINE OF SIGHT CALCULATIONS USING BRESENHAM/LERP

function lerp(start, end, t) {
	return start + t * (end - start);
}

function lerp_point(p0, p1, t) {
	return new calc.coordinate(lerp(p0.x, p1.x, t), lerp(p0.y, p1.y, t));
}

function chebyshev_distance(p0, p1) {
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	return Math.max(Math.abs(dx), Math.abs(dy));
}

function round_point(p) {
	return new calc.coordinate(Math.round(p.x), Math.round(p.y));
}

function line(p0, p1) {
	const points = [];
	const N = chebyshev_distance(p0, p1);
	for (let step = 0; step <= N; step++) {
		const t = N === 0 ? 0.0 : step / N;
		points.push(round_point(lerp_point(p0, p1, t)));
	}
	return points;
}

function hasPermissiveLOS(startX, startY, endX, endY) {
	const startTilesToCheck = [{x: startX, y: startY}];

	if (typeof helper !== 'undefined' && helper.getAdjacentTiles) {
		const adjacentTiles = helper.getAdjacentTiles(startX, startY, true);
		for (let tile of adjacentTiles) {
			const hasWall = walls.find(w => w.x === tile.x && w.y === tile.y);
			const hasEntity = entities?.find(e => e.hp > 0 && e.x === tile.x && e.y === tile.y);
			if (!hasWall && !hasEntity) {
				startTilesToCheck.push(tile);
			}
		}
	}

	const end = {x: endX, y: endY};

	for (let startTile of startTilesToCheck) {
		const start = {x: startTile.x, y: startTile.y};
		const path = line(start, end);

		let blocked = false;
		for (let i = 1; i < path.length - 1; i++) {
			const point = path[i];
			if (walls.find(w => w.x === point.x && w.y === point.y)) {
				blocked = true;
				break;
			}
		}

		if (!blocked) {
			return true;
		}
	}

	return false;
}

function calculateCone(path, startX, startY, endX, endY, maxRange, spread) {
	spread = spread || 3;
	const coneTiles = new Set();
	
	const startIdx = path.length > 1 ? 1 : 0;
	for (let i = startIdx; i < path.length; i++) {
		coneTiles.add(`${path[i].x},${path[i].y}`);
	}
	
	const dx = endX - startX;
	const dy = endY - startY;
	const distance = Math.sqrt(dx * dx + dy * dy);
	
	if (distance < 2 || spread <= 1) {
		return Array.from(coneTiles).map(s => {
			const [x, y] = s.split(',').map(Number);
			return {x, y};
		});
	}
	
	const length = distance;
	const perpX = -dy / length;
	const perpY = dx / length;
	const tilesPerSide = Math.floor((spread - 1) / 2);
	const allSidePaths = [];
	
	for (let offset = 1; offset <= tilesPerSide; offset++) {
		const scaledOffset = Math.min(offset, (distance - 1) * (offset / tilesPerSide));
		
		const leftEndX = Math.round(endX + perpX * scaledOffset);
		const leftEndY = Math.round(endY + perpY * scaledOffset);
		
		if (hasPermissiveLOS(startX, startY, leftEndX, leftEndY)) {
			const leftLook = {
				start: { x: startX, y: startY },
				end: { x: leftEndX, y: leftEndY }
			};
			let leftPath = calc.los(leftLook);
			
			if (leftPath.length > maxRange + 1) {
				leftPath = leftPath.slice(1, maxRange + 1);
			} else if (leftPath.length > 1) {
				leftPath = leftPath.slice(1);
			}
			
			allSidePaths.push(leftPath);
			
			for (let point of leftPath) {
				coneTiles.add(`${point.x},${point.y}`);
			}
		}
		
		const rightEndX = Math.round(endX - perpX * scaledOffset);
		const rightEndY = Math.round(endY - perpY * scaledOffset);
		
		if (hasPermissiveLOS(startX, startY, rightEndX, rightEndY)) {
			const rightLook = {
				start: { x: startX, y: startY },
				end: { x: rightEndX, y: rightEndY }
			};
			let rightPath = calc.los(rightLook);
			
			if (rightPath.length > maxRange + 1) {
				rightPath = rightPath.slice(1, maxRange + 1);
			} else if (rightPath.length > 1) {
				rightPath = rightPath.slice(1);
			}
			
			allSidePaths.push(rightPath);
			
			for (let point of rightPath) {
				coneTiles.add(`${point.x},${point.y}`);
			}
		}
	}
	
	const centerPath = path.slice(startIdx);
	const allPaths = [centerPath, ...allSidePaths];
	
	let maxLen = 0;
	for (let p of allPaths) {
		if (p.length > maxLen) maxLen = p.length;
	}
	
	for (let i = 0; i < maxLen; i++) {
		for (let j = 0; j < allPaths.length - 1; j++) {
			const path1 = allPaths[j];
			const path2 = allPaths[j + 1];
			
			const pt1 = path1[Math.min(i, path1.length - 1)];
			const pt2 = path2[Math.min(i, path2.length - 1)];
			
			if (pt1 && pt2) {
				const fillLine = line({x: pt1.x, y: pt1.y}, {x: pt2.x, y: pt2.y});
				for (let pt of fillLine) {
					coneTiles.add(`${pt.x},${pt.y}`);
				}
			}
		}
	}
	
	return Array.from(coneTiles).map(s => {
		const [x, y] = s.split(',').map(Number);
		return {x, y};
	});
}

function getEntitiesInCone(path, startX, startY, endX, endY, maxRange, spread) {
	const coneTiles = calculateCone(path, startX, startY, endX, endY, maxRange, spread);
	const entitiesHit = [];
	
	for (let tile of coneTiles) {
		for (let entity of entities) {
			if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0) {
				if (!entitiesHit.includes(entity)) {
					entitiesHit.push(entity);
				}
			}
		}
	}
	
	return entitiesHit;
}

function getEntitiesInPath(path) {
	const entitiesHit = [];
	
	for (let tile of path) {
		for (let entity of entities) {
			if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0) {
				if (!entitiesHit.includes(entity)) {
					entitiesHit.push(entity);
				}
			}
		}
	}
	return entitiesHit;
}

function getEntitiesInArea(areaTiles) {
	const entitiesHit = [];
	
	for (let tile of areaTiles) {
		for (let entity of entities) {
			if (entity.x === tile.x && entity.y === tile.y && entity.hp > 0) {
				if (!entitiesHit.includes(entity)) {
					entitiesHit.push(entity);
				}
			}
		}
	}
	
	return entitiesHit;
}
