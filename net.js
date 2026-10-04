// NET.JS: PEER-TO-PEER CO-OP (host-authoritative, star topology)

var net = {
	peer: null,
	host: null,
	self: 'host',
	conns: [],
	acks: {},
	seq: 0,
	last: '',
	lastUi: '',
	anims: [],
	draws: [],
	preview: [],
	lastDraws: '',
	drawing: false,
	from: null,
	applying: false,
	mine: false,

	get guest() { return !!net.host; },

	owns: e => isPlayerControlled(e) && (!net.peer || (e.peer || 'host') === net.self),
	myTurn: () => !net.peer || net.owns(entities[currentEntityIndex]),

	start: hostId => {
		net.peer = new Peer();
		if (hostId) {
			net.host = hostId;
			net.self = null;
		} else {
			document.getElementById('net-host').disabled = true;
			net.peer.on('connection', net.link);
		}
		net.peer.on('open', id => {
			if (!hostId) {
				document.getElementById('net-link').value = location.origin + location.pathname + '?join=' + id;
				return net.status('hosting');
			}
			net.self = id;
			net.guestUi(true);
			net.link(net.peer.connect(hostId, {reliable: true}));
		});
		net.peer.on('error', e => {
			if (net.guest) net.offline();
			net.status(e.type);
		});
	},

	link: c => {
		c.on('open', () => {
			net.conns.push(c);
			net.status(net.guest ? 'connected' : net.conns.length + ' connected');
			if (!net.guest) net.join(c.peer);
		});
		c.on('data', m => net.recv(c, m));
		c.on('close', () => net.drop(c));
	},

	join: id => {
		const e = allPlayers.find((p, i) => i && !p.peer && !helper.hasTrait(p, 'charmed'));
		if (e) e.peer = id;
		else {
			const n = allPlayers.length;
			spawnExtraPlayer();
			if (allPlayers.length > n) allPlayers[n].peer = id;
		}
		net.last = '';
		update();
	},

	drop: c => {
		net.conns = net.conns.filter(o => o !== c);
		delete net.acks[c.peer];
		if (net.guest) {
			net.offline();
			return net.status('host left');
		}
		net.unown(c.peer);
		net.status(net.conns.length + ' connected');
		update();
	},

	offline: () => {
		const p = net.peer;
		net.peer = net.host = null;
		net.self = 'host';
		net.conns = [];
		net.unown();
		net.guestUi(false);
		p.destroy();
		update();
	},

	unown: id => [...allPlayers, ...allEnemies].forEach(e => [e, e._precharm].forEach(o => {
		if (o && (id === undefined || o.peer === id)) delete o.peer;
	})),

	guestUi: on => {
		['enemy-settings', 'player-settings', 'item-settings', 'dungeon-settings', 'edit-row', 'net-host', 'net-link']
			.forEach(id => document.getElementById(id).classList.toggle('hidden', on));
		['map-size', 'turn-delay'].forEach(id => document.getElementById(id).disabled = on);
	},

	status: s => document.getElementById('net-status').textContent = s,

	pack: () => {
		const seen = new Set(), dup = new Set(), ids = new Map();
		const s = {
			size, walls, players: allPlayers, enemies: allEnemies, items: mapItems, nextItemId,
			blood: [...bloodTiles], cur: currentEntityIndex, left: currentEntityTurnsRemaining, taken: turns_taken,
			delay: document.getElementById('turn-delay').value
		};
		const walk = o => {
			if (!o || typeof o !== 'object') return;
			if (seen.has(o)) return dup.add(o);
			seen.add(o);
			Object.values(o).forEach(walk);
		};
		walk(s);
		return JSON.stringify(s, (k, v) => {
			if (!dup.has(v) || Array.isArray(v)) return v;
			if (ids.has(v)) return {$r: ids.get(v)};
			ids.set(v, ids.size);
			return {...v, $i: ids.size - 1};
		});
	},

	unpack: str => {
		const s = JSON.parse(str), objs = [];
		const sel = [...allPlayers, ...allEnemies].indexOf(specialModeEntity);
		const tag = o => {
			if (!o || typeof o !== 'object') return;
			if (o.$i !== undefined) {
				objs[o.$i] = o;
				delete o.$i;
			}
			Object.values(o).forEach(tag);
		};
		const link = o => {
			for (const k in o) {
				const v = o[k];
				if (!v || typeof v !== 'object') continue;
				if (v.$r === undefined) link(v);
				else o[k] = objs[v.$r];
			}
		};
		tag(s);
		link(s);
		const ents = [...s.players, ...s.enemies];
		if (s.size !== size) {
			size = s.size;
			resizePtsArray();
		}
		({walls, players: allPlayers, enemies: allEnemies, items: mapItems, nextItemId,
			cur: currentEntityIndex, left: currentEntityTurnsRemaining, taken: turns_taken} = s);
		bloodTiles = new Map(s.blood);
		specialModeEntity = ents[sel] || null;
		document.getElementById('turn-delay').value = document.getElementById('delay-value').textContent = s.delay;
	},

	ui: () => JSON.stringify({
		c: window.cursorWorldPos, a: action.value, s: specialMode,
		e: [...allPlayers, ...allEnemies].indexOf(specialModeEntity),
		g: window.throwingGrenadeIndex ?? null, j: adjacentSelect, p: [peekStep, peekStartX, peekStartY]
	}),

	applyUi: str => {
		const u = JSON.parse(str);
		window.cursorWorldPos = u.c;
		cursorVisible = true;
		action.value = u.a;
		specialMode = u.s;
		specialModeEntity = [...allPlayers, ...allEnemies][u.e] || null;
		window.throwingGrenadeIndex = u.g ?? undefined;
		adjacentSelect = u.j;
		[peekStep, peekStartX, peekStartY] = u.p;
	},

	drawPreview: () => {
		const ents = [...allPlayers, ...allEnemies];
		net.preview.forEach(([k, a]) => canvas[k](...(k === 'path' ? [a[0], a[1], a[2], ents[a[3]]] : a)));
	},

	sync: () => {
		const p = net.draws, d = JSON.stringify(p);
		net.draws = [];
		if (!net.peer || EntitySystem._explosionPending) return;
		const s = net.pack(), mine = net.owns(entities[currentEntityIndex]), was = net.mine;
		net.mine = mine;
		if (net.applying) {
			net.last = s;
			net.anims = [];
			return;
		}
		if (mine) {
			const u = net.ui();
			if (u !== net.lastUi) {
				net.lastUi = u;
				net.conns.forEach(c => c.send({t: 'ui', u}));
			}
		}
		if ((s === net.last && d === net.lastDraws) || (net.guest && !mine && !was)) return;
		net.last = s;
		net.lastDraws = d;
		net.seq++;
		net.conns.forEach(c => c.send({t: 'state', s, seq: net.seq, ack: net.acks[c.peer], p, a: net.anims.filter(x => x.by !== c.peer)}));
		net.anims = [];
	},

	recv: (c, m) => {
		if (m.t === 'ui') {
			if (!net.guest) net.conns.forEach(o => o !== c && o.send(m));
			if (net.owns(entities[currentEntityIndex])) return;
		} else if (net.guest) {
			if ((m.ack || 0) < net.seq) return;
		} else net.acks[c.peer] = m.seq;

		net.applying = net.guest;
		net.from = c.peer;
		if (m.t === 'ui') net.applyUi(m.u);
		else {
			net.preview = m.p;
			net.unpack(m.s);
			m.a.forEach(x => canvas[x.k](...x.a));
		}
		update();
		net.applying = false;
		net.from = null;
	}
};

{
	const xy = a => a && a.map(p => ({x: p.x, y: p.y}));
	const previewArgs = {
		path: (p, x, y, e) => [xy(p), x, y, [...allPlayers, ...allEnemies].indexOf(e)],
		los: (p, d, h) => [xy(p), d, xy(h)],
		crosshair: (x, y) => [x, y]
	};
	Object.keys(previewArgs).forEach(k => {
		const f = canvas[k];
		canvas[k] = (...a) => {
			if (net.drawing) return f(...a);
			if (net.peer && !net.guest && !isPlayerControlled(entities[currentEntityIndex])) net.draws.push([k, previewArgs[k](...a)]);
			net.drawing = true;
			try { f(...a); } finally { net.drawing = false; }
		};
	});
}

['deathAnim', 'explosionAnim'].forEach(k => {
	const f = canvas[k];
	canvas[k] = (...a) => {
		if (net.peer) net.anims.push({k, by: net.from, a: k === 'deathAnim' ? [{x: a[0].x, y: a[0].y}] : a});
		f(...a);
	};
});

const joinId = new URLSearchParams(location.search).get('join');
if (joinId) net.start(joinId);