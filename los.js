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
				//startTilesToCheck.push(tile); // comment out to remove permissive LOS
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
	
	// Use raw line instead of LOS-blocked path for center direction
	const rawCenterPath = line({x: startX, y: startY}, {x: endX, y: endY});
	let centerPath = rawCenterPath.slice(1); // Remove start position
	if (centerPath.length > maxRange) {
		centerPath = centerPath.slice(0, maxRange);
	}
	
	// Add center path tiles
	for (let point of centerPath) {
		coneTiles.add(`${point.x},${point.y}`);
	}
	
	const dx = endX - startX;
	const dy = endY - startY;
	const distance = Math.sqrt(dx * dx + dy * dy);
	
	if (distance < 1) {
		return Array.from(coneTiles).map(s => {
			const [x, y] = s.split(',').map(Number);
			return {x, y};
		});
	}
	
	// Perpendicular vector for spreading
	const perpX = -dy / distance;
	const perpY = dx / distance;
	
	const tilesPerSide = Math.floor(spread / 2);
	const allSidePaths = [];
	
	// Generate side rays
	for (let side of [-1, 1]) {
		for (let offset = 1; offset <= tilesPerSide; offset++) {
			// Scale offset based on distance to create cone shape
			const spreadAmount = offset * (1 + distance / maxRange * 0.5);
			
			const offsetX = Math.round(endX + perpX * spreadAmount * side);
			const offsetY = Math.round(endY + perpY * spreadAmount * side);
			
			if (hasPermissiveLOS(startX, startY, offsetX, offsetY)) {
				const sideLook = {
					start: { x: startX, y: startY },
					end: { x: offsetX, y: offsetY }
				};
				let sidePath = calc.los(sideLook);
				
				if (sidePath.length > maxRange + 1) {
					sidePath = sidePath.slice(1, maxRange + 1);
				} else if (sidePath.length > 1) {
					sidePath = sidePath.slice(1);
				}
				
				allSidePaths.push(sidePath);
				
				for (let point of sidePath) {
					coneTiles.add(`${point.x},${point.y}`);
				}
			}
		}
	}
	
	// Fill between all paths
	const allPaths = [centerPath, ...allSidePaths];
	
	let maxLen = 0;
	for (let p of allPaths) {
		if (p.length > maxLen) maxLen = p.length;
	}
	
	// For each distance step, fill between adjacent paths
	for (let i = 0; i < maxLen; i++) {
		const pointsAtDepth = [];
		
		for (let pathIdx = 0; pathIdx < allPaths.length; pathIdx++) {
			const path = allPaths[pathIdx];
			const pt = path[Math.min(i, path.length - 1)];
			if (pt) pointsAtDepth.push(pt);
		}
		
		// Fill between all points at this depth
		for (let j = 0; j < pointsAtDepth.length - 1; j++) {
			const pt1 = pointsAtDepth[j];
			const pt2 = pointsAtDepth[j + 1];
			
			const fillLine = line({x: pt1.x, y: pt1.y}, {x: pt2.x, y: pt2.y});
			for (let pt of fillLine) {
				coneTiles.add(`${pt.x},${pt.y}`);
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
