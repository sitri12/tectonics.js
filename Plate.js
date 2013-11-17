_isDefined = function(value){
	return value != void 0;
}
_hashVector = function(vector){
	return vector.id.toString()
}

function Plate(world, center, eulerPole, angularSpeed)
{
	this.world = world;
	this.center = center; // TODO: remove
	this.eulerPole = eulerPole;
	this.angularSpeed = angularSpeed;
	this.densityOffset = world.getRandomPlateDensityEffect();
	
	//efficiency attributes, AKA attributes of attributes:
	this._grid = world.grid;
	this._crust = world.crust;
	this._geometry = world.grid.initializer(world.NA);
	this._vertices = this._geometry.vertices;
	this._material	= new THREE.MeshBasicMaterial({color: random.random() * 0xffffff, transparent:true, opacity:1});
	this._neighbors = [];
	this.mesh	= new THREE.Mesh( this._geometry, this._material ); 
	
	for(var i = 0, length = this._vertices.length, vertices = this._vertices; i<length; i++){
		vertices[i].plate = this;
		vertices[i].id = i;
	}
}
Plate.prototype.get = function(i){
	return this._vertices[i];
}
Plate.prototype.getSize = function(){
	return this._vertices.filter(function(vertex){return vertex.length() > this.world.THRESHOLD}).length;
}
Plate.prototype.getRandomPoint = function(){
	var points = this._collideable.filter(function(vertex){return vertex.length() > this.world.THRESHOLD});
	var i = Math.floor(random.random()*points.length);
	return points[i];
}
Plate.prototype.updateNeighbors = function(){
	var _this = this;
	this._neighbors = this.world.plates.
		filter(function(platemesh){return platemesh.mesh.uuid != _this.mesh.uuid});
}
Plate.prototype.updateBorders = function(){
	var collideable = [];
	var riftable = [];
	var THRESHOLD = this.world.THRESHOLD;
	var a,b,c;
	for(var i=0, vertices = this._vertices, length = this._geometry.faces.length; i<length; i++){
		var face = this._geometry.faces[i];
		a = vertices[face.a].length()> THRESHOLD;
		b = vertices[face.b].length()> THRESHOLD;
		c = vertices[face.c].length()> THRESHOLD;
		if((a != b || b != c)){
			if(a){ collideable[face.a] = vertices[face.a]; }
			else { riftable[face.a] = vertices[face.a]; }
			if(b){ collideable[face.b] = vertices[face.b]; }
			else { riftable[face.b] = vertices[face.b]; }
			if(c){ collideable[face.c] = vertices[face.c]; }
			else { riftable[face.c] = vertices[face.c]; }
		}
	}
	this._collideable = collideable;
	this._riftable = riftable;
}
Plate.prototype.move = function(timestep){
	this.increment = this.angularSpeed * timestep;
	this.mesh.rotateOnAxis(this.eulerPole, this.increment);
}

Plate.prototype._getIntersections = function(absolute, plates, grid, getIntersection){
	for(var j=0, lj = plates.length; j<lj; j++){
		var plate = plates[j];
		var relative = plate.mesh.worldToLocal(absolute.clone());
		var id = grid.getNearestId(relative);
		var intersection = getIntersection(id, plate);
		if(intersection) {
			this._neighbors.splice(j, 1);
			this._neighbors.unshift(plate);
			return intersection; 
		}
	}
}

_getCollisionIntersection = function(id, plate) {
	var intersected = plate._vertices[id];
	if (intersected.length() > plate.world.THRESHOLD && !plate._collideable[id]) {
		return intersected;
	}
}
Plate.prototype.deform = function(){
	var mesh = this.mesh;
	var plates = this._neighbors;
	var geometry = this._geometry;
	var grid = this._grid;
	var collideable = this._collideable;
	var vertex, intersected;
	for(i=0, li = collideable.length; i<li; i++){
		var vertex = collideable[i];
		if(_.isUndefined(vertex)){
			continue;
		}
		var absolute = mesh.localToWorld(vertex.clone().normalize());
		var intersected = this._getIntersections(absolute, plates, grid, _getCollisionIntersection);
		if(intersected){
			this._crust.collide(vertex, intersected);
			this._geometry.verticesNeedUpdate  = true;
		}
	}
}

_getRiftIntersection = function(id, plate) {
	var intersected = plate._vertices[id];
	if (intersected.length() > plate.world.THRESHOLD || plate._riftable[id]) {
		return intersected;
	}
}
Plate.prototype.rift = function(){
	var mesh = this.mesh;
	var plates = this._neighbors;
	var geometry = this._geometry;
	var grid = this.world.grid;
	var vertex, intersected;
	var riftable = this._riftable;
	var OCEAN = this.world.OCEAN;
	var OCEAN_CRUST_DENSITY = this.world.OCEAN_CRUST_DENSITY;
	for(i=0, li = this._riftable.length; i<li; i++){
		vertex = riftable[i];
		if(_.isUndefined(vertex)){
			continue;
		}
		var absolute = mesh.localToWorld(vertex.clone().normalize());
		intersected = this._getIntersections(absolute, plates, grid, _getRiftIntersection);
		if(!intersected){
			this._crust.create(vertex, OCEAN, OCEAN_CRUST_DENSITY);
			geometry.verticesNeedUpdate  = true;
		}
	}
}

Plate.prototype.dock = function(subjugated){
	var crust = this._crust;
	var grid = this._grid;
	var vertices = this._vertices;
	var subjugatedPlate = subjugated.plate
	var otherMesh = subjugatedPlate.mesh
	var mesh = this.mesh.clone();
	
	var increment =    new THREE.Matrix4().makeRotationAxis( this.eulerPole, 		    -this.increment );
	increment.multiply(new THREE.Matrix4().makeRotationAxis( subjugatedPlate.eulerPole, -subjugatedPlate.increment ));
	var temp = subjugated.clone();
	
	for(var i = 0; true; i++){
		//move subjugated back by increment
		temp.applyMatrix4(increment);
		
		//check for continental collision
		var absolute = otherMesh.localToWorld(temp.clone().normalize());
		var relative = mesh.worldToLocal(absolute);
		var id = grid.getNearestId(relative);
		var hit = vertices[id];
		
		if(!crust.isContinental(hit) || i > 200){
			crust.replace(hit, subjugated);
			crust.destroy(subjugated);
			break;
		}
	}
}