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

// Permissive LOS: checks rays to multiple points on target tile
function hasPermissiveLOS(startX, startY, endX, endY) {
	// Sample points on the target tile (corners + center)
	const offsets = [
		{x: 0.5, y: 0.5},   // center
		{x: 0.2, y: 0.2},   // near corners
		{x: 0.8, y: 0.2},
		{x: 0.2, y: 0.8},
		{x: 0.8, y: 0.8}
	];
	
	const start = {x: startX, y: startY};
	
	// Try each sample point
	for (let offset of offsets) {
		const end = {x: endX + offset.x - 0.5, y: endY + offset.y - 0.5};
		const path = line(start, end);
		
		// Check if this ray is clear (exclude start and end points from wall check)
		let blocked = false;
		for (let i = 1; i < path.length - 1; i++) {
			const point = path[i];
			if (walls.find(w => w.x === point.x && w.y === point.y)) {
				blocked = true;
				break;
			}
		}
		
		// If any ray succeeds, we have LOS
		if (!blocked) {
			return true;
		}
	}
	
	return false;
}
