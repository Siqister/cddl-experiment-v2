import {
	COLOR_RAMP,

	OFFSET_LOCATION,
	ROTATION_LOCATION,
	POSITION_LOCATION,
	COLOR_LOCATION,
	AGE_LOCATION,
	INIT_OFFSET_LOCATION,
	PICKING_COLOR_LOCATION
} from './config';

import {
	compileShader, 
	createProgram, 
	initVAOs,
	generateShuffledCategories,
	pieLayout,
	columnsLayout
} from './utils';

import {
	vs,fs,transformVs,transformFs
} from './shader';

import {randomNormal, pie} from 'd3';
import {Color} from 'three';

function GLModule(gl){

	//Private variables
	let _w = 800, _h = 600;
	let _instances = 10;
	let _proportions = [1,1,1,1,1,1,1,1,1,1];
	let _motion_decay = 0.009;
	let _motion_random = 0.5;
	let _motion_angular = 1.0;
	let _motion_radial = 1.0;
	let sourceIdx = 0;
	let _categories = generateShuffledCategories(_proportions, _instances);
	let _byCat = false;

	//Initialize shaders and gl context upon module creation
	const vertexShader = compileShader(gl, vs, gl.VERTEX_SHADER);
	const fragmentShader = compileShader(gl, fs, gl.FRAGMENT_SHADER);
	const program = createProgram(gl, vertexShader, fragmentShader);
	const tfVertexShader = compileShader(gl, transformVs, gl.VERTEX_SHADER);
	const tfFragmentShader = compileShader(gl, transformFs, gl.FRAGMENT_SHADER);
	const tfProgram = createProgram(gl, tfVertexShader, tfFragmentShader, 'v_offset', 'v_rotation', 'v_age');

	//Uniform locations
	const uWLocation = gl.getUniformLocation(program, 'u_w');
	const uHLocation = gl.getUniformLocation(program, 'u_h');
	const uUsePickingColorLocation = gl.getUniformLocation(program, 'u_usePickingColor');
	const tf_uTimeLocation = gl.getUniformLocation(tfProgram, 'u_time');
	const tf_uWLocation = gl.getUniformLocation(tfProgram, 'u_w');
	const tf_uHLocation = gl.getUniformLocation(tfProgram, 'u_h');
	const tf_uDecay = gl.getUniformLocation(tfProgram, 'u_decay');
	const tf_uRandomWalkSpeed = gl.getUniformLocation(tfProgram, 'u_random_walk_speed');
	const tf_uCircularSpeed = gl.getUniformLocation(tfProgram, 'u_circular_speed');
	const tf_uRadialSpeed = gl.getUniformLocation(tfProgram, 'u_radial_speed');

	//VAOs, transformFeedback
	//Initialize two sets of VAOs and transformFeedBack objects, to be ping-ponged
	const {vaos, tfs, buffers} = initVAOs(gl);

	//Set up framebuffer object for off screen rendering and picking
	const framebuffer = gl.createFramebuffer();
	const texture = gl.createTexture();
	const depthbuffer = gl.createRenderbuffer();

	function exports(){

		console.log('Run GLModule');

		//Re-initialize gl environment
		gl.viewport(0, 0, _w, _h);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
	  gl.enable(gl.BLEND);
	  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	  //Update uniform values
		gl.useProgram(program);
		gl.uniform1f(uWLocation, _w);
		gl.uniform1f(uHLocation, _h);

		gl.useProgram(tfProgram);
		gl.uniform1f(tf_uWLocation, _w);
		gl.uniform1f(tf_uHLocation, _h);
		gl.uniform1f(tf_uDecay, _motion_decay);
		gl.uniform1f(tf_uRandomWalkSpeed, _motion_random);
		gl.uniform1f(tf_uCircularSpeed, _motion_angular);
		gl.uniform1f(tf_uRadialSpeed, _motion_radial);

		//Update attribute values
		_updateBufferData(buffers);

		//Update FBO for off canvas rendering
		_updateFBO(framebuffer, texture, depthbuffer, _w, _h);

		//Enter render loop
		_render();

	}

	function _updateFBO(framebuffer, texture, depthbuffer, _w, _h){

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, _w, _h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		framebuffer.texture = texture;

    gl.bindRenderbuffer(gl.RENDERBUFFER, depthbuffer); // Bind the object to target
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, _w, _h);
    
    // Attach the texture and the renderbuffer object to the FBO
   	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthbuffer);

    // Check if FBO is configured correctly
    var e = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    console.log(e);
    if (gl.FRAMEBUFFER_COMPLETE !== e) {
      console.log('Frame buffer object is incomplete: ' + e.toString());
      return error();
    }

    // Unbind the buffer object
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	}

	//Getter and setter methods
	exports.setSize = function([w, h]){
		_w = w;
		_h = h;
		return this;
	}

	exports.setInstances = function(_){
		_instances = _;
		//Regenerate categories whenever _proportions or _instances update
		_categories = generateShuffledCategories(_proportions, _instances);
		_updateBufferData(buffers);
		return this;
	}

	exports.setProportions = function(_){
		_proportions = _;
		//Regenerate categories whenever _proportions or _instances update
		_categories = generateShuffledCategories(_proportions, _instances);
		_updateColorBuffer(buffers);
		_updateOffsetBuffer(buffers, _byCat, false);
		return this;
	}

	exports.separateByCat = function(_){
		_byCat = _;
		_updateOffsetBuffer(buffers, _byCat, false);
		return this;
	}

	exports.onClick = function(cb, target){
		//Implement mousepicking logic here, and invoke callback function
		target.addEventListener('click', function(e){
			//Basic logic
			//Render to an offscreen canvas with unique colors for each instance
		 	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); //render to off screen framebuffer
		 	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		 	gl.useProgram(program);
		  gl.uniform1f(uUsePickingColorLocation, 1.0); //render pass does not use pickingColor
		  gl.bindVertexArray(vaos[sourceIdx]);
		  gl.vertexAttribDivisor(OFFSET_LOCATION, 1);
		  gl.vertexAttribDivisor(ROTATION_LOCATION, 1);
		  gl.vertexAttribDivisor(AGE_LOCATION, 1);
		  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, _instances);

			//Then, read the value of the clicked pixel
			const [x,y] = [e.clientX, _h - e.clientY];
			const pixels = new Uint8Array(4);
			gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

			//Re-construct the id of the card, and emit callback
			const index = ( pixels[0] << 16 ) | ( pixels[1] << 8 ) | ( pixels[2] );

			if(index){
				cb(index, _categories[index]);
			}
		});
		return this;
	}

	exports.setDecay = function(_){
		_motion_decay = _;
		gl.useProgram(tfProgram);
		gl.uniform1f(tf_uDecay, _motion_decay);
		return this;
	}

	exports.setMotionRandom = function(_){
		_motion_random = _;
		gl.useProgram(tfProgram);
		gl.uniform1f(tf_uRandomWalkSpeed, _motion_random);
		return this;
	}

	exports.setMotionAngular = function(_){
		_motion_angular = _;
		gl.useProgram(tfProgram);
		gl.uniform1f(tf_uCircularSpeed, _motion_angular);
		return this;
	}

	exports.setMotionRadial = function(_){
		_motion_radial = _;
		gl.useProgram(tfProgram);
		gl.uniform1f(tf_uRadialSpeed, _motion_radial);
		return this;
	}

	//Private methods
	function _render(){
		_transform();

	  gl.bindFramebuffer(gl.FRAMEBUFFER, null); //render to screen
	  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	  gl.useProgram(program);
	  gl.uniform1f(uUsePickingColorLocation, 0.0); //render pass does not use pickingColor
	  gl.bindVertexArray(vaos[sourceIdx]);
	  gl.vertexAttribDivisor(OFFSET_LOCATION, 1);
	  gl.vertexAttribDivisor(ROTATION_LOCATION, 1);
	  gl.vertexAttribDivisor(AGE_LOCATION, 1);
	  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, _instances);

	  requestAnimationFrame(_render);
	}

	function _transform(){
		const destIdx = (sourceIdx + 1)%2;
		const sourceVAO = vaos[sourceIdx];
		const destTf = tfs[destIdx];
		const destBuffer = buffers[destIdx];

		gl.useProgram(tfProgram);

		gl.bindVertexArray(sourceVAO);
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, destTf);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, destBuffer[OFFSET_LOCATION]);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, destBuffer[ROTATION_LOCATION]);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, destBuffer[AGE_LOCATION]);

		gl.vertexAttribDivisor(OFFSET_LOCATION, 0);
		gl.vertexAttribDivisor(ROTATION_LOCATION, 0);
		gl.vertexAttribDivisor(AGE_LOCATION, 0);

		gl.enable(gl.RASTERIZER_DISCARD);

		gl.uniform1f(tf_uTimeLocation, Math.random());

		//Run transformFeedback
		gl.beginTransformFeedback(gl.POINTS);
		gl.drawArrays(gl.POINTS, 0, _instances);
		gl.endTransformFeedback();

		//Restore state
	  gl.disable(gl.RASTERIZER_DISCARD);
	  gl.useProgram(null);
	  gl.bindBuffer(gl.ARRAY_BUFFER, null);
	  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
	  gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

	  //Update idx to ping-pong
	  sourceIdx = (sourceIdx + 1)%2;
	}

	function _updatePositionBuffer(buffers){
		const positions = new Float32Array([
		  6.0, 3.5,
		  -6.0, 3.5,
		  -6.0, -3.5,
		  -6.0, -3.5,
		  6.0, -3.5,
		  6.0, 3.5
		]); //triangular vertices of each instance
		buffers.forEach(buffer => {
	    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[POSITION_LOCATION]);
	    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
		});
	}

	function _updateColorBuffer(buffers){
		const colors = new Float32Array(
			Array
				.from({length:_instances})
				.map((d,i) => {
					const cat = _categories[i]?_categories[i]:0; //between 0 and 9
					return [COLOR_RAMP[cat*3], COLOR_RAMP[cat*3+1], COLOR_RAMP[cat*3+2]];
				})
				.reduce((acc,v) => acc.concat(v), [])
		);
		buffers.forEach(buffer => {
	    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[COLOR_LOCATION]);
	    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
		});
	}

	function _updateOffsetBuffer(buffers, byCategory=false, refresh=true){
		const rand = randomNormal(.3,.2);

		let offsets;
		if(byCategory){
			//cards are separated by category
			const proportionAngles = pie().padAngle(0.3).sortValues(null)(_proportions);
			//offsets = new Float32Array( pieLayout(_instances, _w, _h, _categories, _proportions) );
			offsets = new Float32Array( columnsLayout(_instances, _w, _h, _categories, _proportions) );
		}else{
			//cards are all mixed up in this case
			offsets = new Float32Array( pieLayout(_instances, _w, _h) );
		}

		buffers.forEach(buffer => {
	    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[INIT_OFFSET_LOCATION]);
	    gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
	    if(refresh){
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer[OFFSET_LOCATION]);
				gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STREAM_COPY);
	    }
		});
	}

	function _updateRotationsBuffer(buffers){
		const rotations = new Float32Array(
			Array
				.from({length:_instances})
				.map(() => Math.random()*2*Math.PI)
		);
		buffers.forEach(buffer => {
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer[ROTATION_LOCATION]);
				gl.bufferData(gl.ARRAY_BUFFER, rotations, gl.STREAM_COPY);
		})
	}

	function _updateAgeBuffer(buffers){
		const age = new Float32Array(
			Array
				.from({length:_instances})
				.map(() => Math.random())
		);
		buffers.forEach(buffer => {
	    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[AGE_LOCATION]);
	    	gl.bufferData(gl.ARRAY_BUFFER, age, gl.STREAM_COPY);
		})
	}

	function _updatePickingColorBuffer(buffers){
		const pickingColors = new Float32Array(
			Array
				.from({length:_instances})
				.map((d,i) => {
					const c = new Color().setHex(i);
					return [c.r, c.g, c.b];
				})
				.reduce((acc,v) => acc.concat(v), [])
		);
		buffers.forEach(buffer => {
	    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[PICKING_COLOR_LOCATION]);
	    gl.bufferData(gl.ARRAY_BUFFER, pickingColors, gl.STATIC_DRAW);
		});
	}

	function _updateBufferData(buffers){
		
		_updatePositionBuffer(buffers);
		_updateColorBuffer(buffers);
		_updateOffsetBuffer(buffers);
		_updateRotationsBuffer(buffers);
		_updateAgeBuffer(buffers);
		_updatePickingColorBuffer(buffers);

	}

	//utility function for logging internal state
	//TODO: remove this in production
	exports.log = function(){
		_log();
		return this;
	}

	function _log(){
		console.groupCollapsed('GLModule:update');
		console.log(`Width: ${_w}`);
		console.log(`Height: ${_h}`);
		console.log(`Proportions: ${_proportions}`);
		console.log(`Instance count: ${_instances}`);
		console.groupEnd();
	}

	return exports;

}

export default GLModule;