// CIRCLE.JS: BRESENHAM CIRCLE ALGORITHM FOR MOVEMENT RANGE

function circle(xc, yc, r) {
	array = new Uint8Array(size * size);
	if (r < 1) return;

	let xoff = 0;
	let yoff = r;
	let b = -r;

	while (xoff <= yoff) {
		const p0 = xc - xoff;
		const p1 = xc - yoff;
		const w0 = xoff + xoff;
		const w1 = yoff + yoff;

		hl(p0, yc - yoff, yc + yoff, w0);
		hl(p1, yc - xoff, yc + xoff, w1);

		if ((b += xoff++ + xoff) >= 0) {
			b -= --yoff + yoff;
		}
	}

	function hl(x, y1, y2, w) {
		w++;
		while (w--) {
			const xw = x + w;
			if (xw >= 0 && xw < size && y1 >= 0 && y1 < size) {
				array[y1 * size + xw] = 1;
			}
			if (xw >= 0 && xw < size && y2 >= 0 && y2 < size) {
				array[y2 * size + xw] = 1;
			}
		}
	}
}

function convert() {
	pts = [];
	const conv = Array.from(array);
	while (conv.length) {
		pts.push(conv.splice(0, size));
	}
	
	walls.forEach(wall => {
		if (pts[wall.x]?.[wall.y] !== undefined) {
			pts[wall.x][wall.y] = 0;
		}
	});

	array = new Uint8Array(size * size);
}
