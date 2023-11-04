// LOS.JS: all the fancy math for calculating the line of sight

// line drawing/ linear interpolation code stolen from: https://www.redblobgames.com/grids/line-drawing.html
function lerp(start, end, t) {
	return start + t * (end - start);
}

function lerp_point(p0, p1, t) {
	return new calc.coordinate(lerp(p0.x, p1.x, t), lerp(p0.y, p1.y, t));
}

function diagonal_distance(p0, p1) {
	var dx = p1.x - p0.x;
	var dy = p1.y - p0.y;
	return Math.max(Math.abs(dx), Math.abs(dy));
}

function round_point(p) {
	return new calc.coordinate(Math.round(p.x), Math.round(p.y));
}

function overlap(array, key, value, key2, value2) {
	for (i = 0; i < array.length; i++) {
		if (array[i][key] === value && array[i][key2] === value2) {
			return array.indexOf(array[i]);
		}
	}
}

function line(p0, p1) {
	points = []; // clears the array
	var N = diagonal_distance(p0, p1);
	for (var step = 0; step <= N; step++) {
		var t = N == 0? 0.0 : step / N;
		points.push(round_point(lerp_point(p0, p1, t)));
	}
	return points;
}

