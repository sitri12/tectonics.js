
JsonSerializer = {};
JsonSerializer.serialize = function(world) {
	var supercontinentCycle = world.supercontinentCycle;

	var world_json = {
		radius: world.radius,
		platesNum: world.platesNum,
		mountainWidth: world.mountainWidth,
		age: world.age,
		plates: [],
		grid: undefined,
		supercontinentCycle: {
			duration: supercontinentCycle.duration,
			age: supercontinentCycle.age,
			oldSupercontinentPos: supercontinentCycle.oldSupercontinentPos,
			newSupercontinentPos: supercontinentCycle.newSupercontinentPos,
		},
	};

	for (var i = 0, li = world.plates.length; i < li; i++) {
		plate = world.plates[i]
		var plate_json = {
			eulerPole: 		plate.eulerPole.toArray(),
			angularSpeed: 	plate.angularSpeed,
			densityOffset: 	plate.densityOffset,
			rockColumns: 	{},
			meshMatrix: 	plate.mesh.matrix.toArray()
		};

		var cells = plate._cells
			.filter(function(cell) {
				return cell.content;
			});
		var ids = 			new Uint16Array(cells.length);
		var thicknesses = 	new Uint16Array(cells.length);
		var densities = 	new Uint16Array(cells.length);
		for (var j = 0, lj = cells.length; j < lj; j++) {
			var cell = cells[j];
			ids[j] = cell.id;
			thicknesses[j] = cell.content.thickness;
			densities[j] = cell.content.density;
		};
		plate_json.rockColumns = {
			ids: Base64.encode(ids.buffer),
			thicknesses: Base64.encode(thicknesses.buffer),
			densities: Base64.encode(densities.buffer),
		};

		world_json.plates.push(plate_json);
	};
	return {
		version: 0,
		seed: seed,
		world: world_json
	};
};
JsonSerializer.deserialize = function(json) {
	var _world = new World({
		radius: json.world.radius,
		platesNum: json.world.platesNum,
		mountainWidth: json.world.mountainWidth,
		age: json.world.age,
		grid: world.grid,					// HACK: shouldn't reference world
		supercontinentCycle: undefined,
		plates: [],
	});

	_world.plates = json.world.plates.map(function(plate_json){
		var plate = new Plate(_world, {
			angularSpeed: plate_json.angularSpeed,
			densityOffset: plate_json.densityOffset
		});

		plate.eulerPole.fromArray(plate_json.eulerPole);

		var plateMatrix = plate.mesh.matrix;
		plateMatrix.fromArray(plate_json.meshMatrix);
		plate.mesh.rotation.setFromRotationMatrix( plateMatrix );
		
		var rockColumns_json = plate_json.rockColumns;

		var ids = new Uint16Array(Base64.decode(rockColumns_json.ids));
		var thicknesses = new Uint16Array(Base64.decode(rockColumns_json.thicknesses));
		var densities = new Uint16Array(Base64.decode(rockColumns_json.densities));
		for (var i = 0, li = ids.length; i < li; i++) {
			var rockColumn = new RockColumn(_world, {
				thickness: thicknesses[i],
				density: densities[i]
			});
			rockColumn.isostasy();

			plate._cells[ids[i]].content = rockColumn;
		};
		return plate;
	});
	_world.updateNeighbors();
	_world.updateBorders();
	_world.supercontinentCycle = new SupercontinentCycle(_world, json.world.supercontinentCycle);
	seed = json.seed;
	random = new Random(parseSeed(seed));
	return _world;
}