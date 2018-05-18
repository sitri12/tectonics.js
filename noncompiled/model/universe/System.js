
// A "System" is a class representation of an isolated physical system
// it is essentially a node in a scene graph 
// It is designed for on-rails physics simulation over large distances.
// It offers support for constantly changing transformation matrices,
// and allows arbitrary nodes to be designated as the origin of a coordinate system.
// Designating arbitrary nodes as the origin is meant to resolve floating point precision issues 
// that commonly occur for very distant objects, A.K.A. the "Deep Space Kraken" of Kerbal Space Program
function System(parameters) {
	// name of the cycle induced by the system
	this.name 		= parameters['name'];

	// the motion that characterizes all bodies within the system
	// motion can currently either be an "Orbit" or "Spin", although it could be any class that instantiates their methods
	this.motion 	= parameters['motion'] || stop('missing parameter: "motion"');

	// the parent motion of the scene graph node (optional)
	// the motion described by this.motion assumes a coordinate basis that is designated by the parent node
	this.parent 	= parameters['parent'];

	// the child motions of the scene graph node (optional)
	// the motions described by the children assume a coordinate basis that is designated by this node
	this.children 	= parameters['children'] || [];

	// iterate through children and assign their parents
	for (var i = 0; i < this.children.length; i++) {
		this.children[i].parent = this;
	}

	// the body that exhibits the motion (optional)
	// the position/rotation of the body is described by a coordinate basis that is designated by this node
	// remember that a path need not always have a body - 
	// it may for instance describe a group of objects that are gravitationally bound
	this.body		= parameters['body'];

	var mult_matrix = Matrix4x4.mult_matrix;

	// returns a dictionary mapping body ids to transformation matrices
	//  indicating the position/rotation relative to this node 
	this.get_body_matrices = function (state, origin) {
		origin = origin || this;
		var parent 	 = this.parent;
		var children = this.children;
		var system_state = parseFloat(state[this.name] || 0);

		var map = {};
		if (parent !== void 0) {
			// NOTE: don't consider origin, or else an infinite recursive loop will result
			if (parent !== origin) {
				var parent_map = parent.get_body_matrices(state, this);
				for(var key in parent_map){
					map[key] = mult_matrix( this.motion.get_parent_to_child_matrix(system_state), parent_map[key] )
				}
			}
		}
		for (var i = 0; i < children.length; i++) {
			// NOTE: don't consider origin, or else an infinite recursive loop will result
			if (children[i] !== origin) {
				var child_map = children[i].get_body_matrices(state, this);
				var child_state = parseFloat(state[children[i].name] || 0);
				for(var key in child_map){
					map[key] = mult_matrix( children[i].motion.get_child_to_parent_matrix(child_state), child_map[key] )
				}
			}
		}
		if (this.body !== void 0) {
			map[this.body.name] = Matrix4x4.identity();
		}
		return map;
	}
	// gets a list of all nodes at or below this one in the hierarchy
	this.ancestors = function () {
		return [
			...(this.parent === void 0? [] : this.parent.ancestors()), 
			this
		];
	}
	// gets a list of all nodes at or below this one in the hierarchy
	this.descendants = function () {
		return [
			this, 
			...this.children
				.map(child => child.descendants())
				.reduce((acc, e) => acc.concat(e), [])
		];
	}
	this.iterate = function(state) {
		// body...
	}
}