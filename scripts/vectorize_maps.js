// Creates vector dataspaces using options: CTF/NF, Element Types (extended, minimal, etc...), and Source (Rotation, Top Maps + Rotation, F-M)

const fs = require('fs');
const util = require('util');
const path = require('path');
const TPMI = require('../tpmi-toolkit');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');

const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);

const SETTINGS = {
	SPACES_FOLDER: path.join(__dirname, '../data/spaces'),
	MAPS_FOLDER: path.join(__dirname, '../data/maps'),
	RANDOM_SEED: "splonktime",
	FLOAT_PRECISION: 4
};

const seed = cyrb128(SETTINGS.RANDOM_SEED);
const random = sfc32(...seed);

class Packer {
	constructor({dimensionsPerElement, numberOfElements, pack}) {
		this.dimensionsPerElement = dimensionsPerElement;
		this.numberOfElements = numberOfElements;
		this.dimensions = this.numberOfElements * this.dimensionsPerElement;
		this.pack = (vMap) => pack(this, vMap);
	}
}

const ELEMENT_PACKERS = {
	OUTER_WALL: new Packer({
		// 50 Wall Nodes: 50x(x, y)
		dimensionsPerElement: 2,
		numberOfElements: 50,
		pack: (self, vectorMap) => {
			let outerWallVector = vectorMap.elements.outerWall.toPoints();
			outerWallVector = adjustPointsToTargetAmount(outerWallVector, self.dimensions);
			outerWallVector = outerWallVector.map(p => [p.x / vectorMap.width, p.y / vectorMap.height]).flat();
			return outerWallVector;
		}
	}),
	ISLANDS: new Packer({
		// 8, 16 Island Node + 1 Exist Param per island: 8x(exists, 16x(x, y))
		dimensionsPerElement: (16 * 2) + 1,
		numberOfElements: 8,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let islandPoints = vectorMap.elements.islands.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			islandPoints = islandPoints.map(i => i.toPoints());
			islandPoints = islandPoints.map(island => adjustPointsToTargetAmount(island, 16));
			islandPoints = markElementsExistence(
				islandPoints.map(island => island.map(p => [p.x / vectorMap.width, p.y / vectorMap.height]).flat()),
				self.numberOfElements,
				Array(16).fill(0).map(p => [centerPoint.x, centerPoint.y]).flat()
			).flat();
			return islandPoints;
		}
	}),
	BOOSTS: new Packer({
		// 16 Boost Nodes + 1 Team Param + 1 Exist Param: 16x(exists, x, y, team)
		dimensionsPerElement: 2 + 1 + 1,
		numberOfElements: 16,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let boostPoints = vectorMap.elements.boosts.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			boostPoints = boostPoints.map(b => [b.shape.x / vectorMap.width, b.shape.y / vectorMap.height, teamToNumber(b.team)]);
			boostPoints = markElementsExistence(boostPoints, self.numberOfElements, [centerPoint.x, centerPoint.y, 0.5]).flat();
			return boostPoints;
		}
	}),
	BOMBS: new Packer({
		// 8 Bomb Nodes + 1 Exist Param: 8x(exists, x, y)
		dimensionsPerElement: 2 + 1,
		numberOfElements: 8,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let bombPoints = vectorMap.elements.bombs.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			bombPoints = bombPoints.map(b => [b.shape.x / vectorMap.width, b.shape.y / vectorMap.height]);
			bombPoints = markElementsExistence(bombPoints, self.numberOfElements, [centerPoint.x, centerPoint.y]).flat();
			return bombPoints;
		}
	}),
	SPIKES: new Packer({
		// 16 Spike Nodes + 1 Exist Param: 16x(exists, x, y)
		dimensionsPerElement: 2 + 1,
		numberOfElements: 8,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let spikePoints = vectorMap.elements.spikes.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			spikePoints = spikePoints.map(b => [b.shape.x / vectorMap.width, b.shape.y / vectorMap.height]);
			spikePoints = markElementsExistence(spikePoints, self.numberOfElements, [centerPoint.x, centerPoint.y]).flat();
			return spikePoints;
		}
	}),
	PORTALS: new Packer({
		// 8 Portal Nodes + 1 Exist Param: 8x(exists, x, y)
		dimensionsPerElement: 2 + 1,
		numberOfElements: 8,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let portalPoints = vectorMap.elements.portals.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			portalPoints = portalPoints.map(b => [b.shape.x / vectorMap.width, b.shape.y / vectorMap.height]);
			portalPoints = markElementsExistence(portalPoints, self.numberOfElements, [centerPoint.x, centerPoint.y]).flat();
			return portalPoints;
		}
	}),
	GATES: new Packer({
		// 8, 16 Gate Nodes + 1 Exist Param per island: 8x(exists, 16x(x, y))
		dimensionsPerElement: (16 * 2) + 1,
		numberOfElements: 8,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let gatePoints = vectorMap.elements.gates.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			gatePoints = gatePoints.map(i => i.toPoints());
			gatePoints = gatePoints.map(gate => adjustPointsToTargetAmount(gate, 16));
			gatePoints = markElementsExistence(
				gatePoints.map(gate => gate.map(p => [p.x / vectorMap.width, p.y / vectorMap.height]).flat()),
				self.numberOfElements,
				Array(16).fill(0).map(p => [centerPoint.x, centerPoint.y]).flat()
			).flat();
			return gatePoints;
		}
	}),
	FLAGS: new Packer({
		// 1 Flag Node + Color
		dimensionsPerElement: 2 + 1,
		numberOfElements: 1,
		pack: (self, vectorMap) => {
			const flag = TPMI.VectorUtilities.getFlagPair(vectorMap.elements.flags)[0];
			return [flag.x, flag.y, teamToNumber(flag.team)];
		}
	}),
	POWERUPS: new Packer({
		// 3 Powerup Nodes + Exists
		dimensionsPerElement: 2 + 1,
		numberOfElements: 3,
		pack: (self, vectorMap) => {
			const centerPoint = TPMI.Flatten.point(vectorMap.width / 2, vectorMap.height / 2);
			// Sort by closest distance to center
			let powerupPoints = vectorMap.elements.powerups.sort((a, b) => {
				return a.shape.distanceTo(centerPoint)[0] - b.shape.distanceTo(centerPoint)[0]
			});
			powerupPoints = powerupPoints.map(b => [b.shape.x / vectorMap.width, b.shape.y / vectorMap.height]);
			powerupPoints = markElementsExistence(powerupPoints, self.numberOfElements, [centerPoint.x, centerPoint.y]).flat();
			return powerupPoints;
		}
	})
};

const ELEMENT_CURATIONS = {
	WALLS: ["OUTER_WALL", "ISLANDS"],
	MINIMAL: ["OUTER_WALL", "ISLANDS", "BOOSTS", "BOMBS", "SPIKES", "PORTALS", "GATES", "FLAGS", "POWERUPS"]
};

(async () => {
	const input = process.argv.slice(2);

	const { gameMode, elementsTemplate, sources } = {
		gameMode: (input[0] || "CTF").toUpperCase(),
		elementsTemplate: (input[1] || "WALLS").toUpperCase(),
		sources: (input[2] || "TINY").toUpperCase().split(',').filter(a => a.trim().length)
	};

	const spaceName = `${gameMode}-${elementsTemplate}-${sources.join("-")}`;

	try { fs.unlinkSync(`${SETTINGS.SPACES_FOLDER}/${spaceName}.json`); } catch(e) {  }
	const fileStream = fs.createWriteStream(`${SETTINGS.SPACES_FOLDER}/${spaceName}.json`, {flags: 'a'});

	let mapFilePaths = [];
	
	logger("Reading map sources...");
	for (let i = 0; i < sources.length; i++) {
		const mapsPath = `${SETTINGS.MAPS_FOLDER}/${sources[i].toLowerCase()}`;
		const fileNames = await readdir(mapsPath);
		mapFilePaths = mapFilePaths.concat(fileNames.map(f => `${mapsPath}/${f}`));
	}

	logger("Generating map vectors...");

	const progressBar = new cliProgress.SingleBar({
		format: 'Generating Vectors |' + colors.cyan('{bar}') + '| {percentage}% | {value}/{total} Maps | Processing Map: {mapPath}',
	}, cliProgress.Presets.shades_classic);
	const curationElements = ELEMENT_CURATIONS[elementsTemplate];
	const totalDimensions = curationElements.reduce((acc, val) => acc + ELEMENT_PACKERS[val].dimensions, 0);
	const dimensionRanges = curationElements.reduce((acc, val) => ([
		...acc, [val, ELEMENT_PACKERS[val].dimensions]
	]), []);

	fileStream.write(`{
		"meta": {
			"dimensionRanges": ${JSON.stringify(dimensionRanges)}
		},
		"data": [
	`);

	let completedMaps = 0;
	progressBar.start(mapFilePaths.length, 0);
	for (let i = 0; i < mapFilePaths.length; i++) {
		progressBar.increment({
			mapPath: path.basename(mapFilePaths[i])
		});

		try {
			const tileMap = await TPMI.MapUtilities.fileToTileMap(mapFilePaths[i]);
			
			const vectorMap = TPMI.Vectorizer.createVectorMapFromTileMap(tileMap);
			if(vectorMap.width < 10 || vectorMap.height < 10) continue;

			const flags = TPMI.VectorUtilities.getFlagPair(vectorMap.elements.flags);
			if(flags[0] === null) continue;
			if(flags[0].team === TPMI.CONSTANTS.TEAMS.NONE && gameMode !== "NF") continue;
			if(flags[0].team === TPMI.CONSTANTS.TEAMS.RED && gameMode !== "CTF") continue;

			const symmetry = TPMI.Analyzer.detectVectorMapSymmetry.closest(vectorMap);

			console.log(symmetry);

			let mapVector = [];

			for (let i = 0; i < curationElements.length; i++) {
				const packer = ELEMENT_PACKERS[curationElements[i]];

				mapVector = mapVector.concat(packer.pack(vectorMap));
			}

			mapVector = mapVector.map(n => toPrecision(n, SETTINGS.FLOAT_PRECISION));

			let dataString = JSON.stringify(mapVector);
			fileStream.write(`${dataString}${i !== mapFilePaths.length - 1 ? "," : ""}\n`);
			completedMaps++;
		} catch (e) {
			logger(`An error occurred while processing map "${mapFilePaths[i]}":`, e);
		}

		// Quick wait
		await new Promise(res => setTimeout(res, 0));
	}

	progressBar.stop();

	fileStream.end("]\n}");

	logger(`Finished generating dataspace ${spaceName}.json with ${completedMaps}/${mapFilePaths.length} maps`);
})();

function adjustPointsToTargetAmount(points, targetPoints) {
	points = points.map(p => TPMI.Flatten.point(p.x, p.y));
	const getP = i => points.at(i % points.length);

	if(points.length > targetPoints) {
		let pointAreas = [];
		let amountOfPointsToRemove = points.length - targetPoints;
		for (let i = 0; i < points.length; i++) {
			pointAreas.push({idx: i, area: triangleArea(getP(i-1), getP(i), getP(i+1))});
		}

		pointAreas = pointAreas.sort((a, b) => a.area - b.area);

		for (let i = amountOfPointsToRemove - 1; i >= 0; i--) {
			points.splice(pointAreas[i].idx, 1);
		}
	} else if(points.length < targetPoints) {
		let pointDistances = [];
		let amountOfPointsToAdd = targetPoints - points.length;
		for (let i = 0; i < points.length; i++) {
			pointDistances.push({idx: i, dist: TPMI.Utilities.distanceBetween(getP(i), getP(i+1))});
		}

		pointDistances = pointDistances.sort((a, b) => b.dist - a.dist);

		for (let i = amountOfPointsToAdd - 1; i >= 0; i--) {
			points.splice(pointDistances[i % pointDistances.length].idx, 0, midpoint(getP(i), getP(i+1)));
		}
	}

	return points;
}

function markElementsExistence(elements, targetElementAmount, defaultElement=["No Default Element"]) {
	let existenceMarked = elements.map(e => [1].concat(e));
	defaultElement = [0].concat(defaultElement);

	if(targetElementAmount > existenceMarked.length) {
		existenceMarked = existenceMarked.concat(
			duplicateArrayElementsToAmount(existenceMarked, targetElementAmount, defaultElement, elem => {
				elem[0] = 0;
				return elem;
			})
		);
	} else if(targetElementAmount < existenceMarked.length) {
		existenceMarked = existenceMarked.slice(0, targetElementAmount);
	}

	return existenceMarked;
}

function duplicateArrayElementsToAmount(array, targetAmount, defaultElement, newElementMapFunc) {
	if(array.length === 0) return Array(targetAmount).fill(0).map(e => Array.from(defaultElement));
	const newArray = [];

	for (let i = 0; i < targetAmount; i++) {
		const sourceArrayIndex = i % array.length;

		let newElement = Array.from(array[sourceArrayIndex]);
		
		if(newElementMapFunc && i > array.length - 1) newElement = newElementMapFunc(newElement);
		newArray.push(newElement);
	}

	return newArray;
}

function teamToNumber(team) {
	if(team === TPMI.CONSTANTS.TEAMS.RED) return 0;
	if(team === TPMI.CONSTANTS.TEAMS.BLUE) return 1;
	return 0.5;
}

function triangleArea(p1, p2, p3) {
	return ((p1.x * (p2.y - p3.y)) + (p2.x * (p3.y - p1.y)) + (p3.x * (p1.y - p2.y))) / 2;
}

function midpoint(p1, p2) {
	return TPMI.Flatten.point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
}

function logger(...args) {
	console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
}

function cyrb128(str) {
	let h1 = 1779033703, h2 = 3144134277,
		h3 = 1013904242, h4 = 2773480762;
	for (let i = 0, k; i < str.length; i++) {
		k = str.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function sfc32(a, b, c, d) {
	return function() {
		a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
		let t = (a + b) | 0;
		a = b ^ b >>> 9;
		b = c + (c << 3) | 0;
		c = (c << 21 | c >>> 11);
		d = d + 1 | 0;
		t = t + d | 0;
		c = c + t | 0;
		return (t >>> 0) / 4294967296;
	}
}

function toPrecision(num, decimalPlaces) {
	return Math.round(num * (10 ** decimalPlaces)) / (10 ** decimalPlaces);
}