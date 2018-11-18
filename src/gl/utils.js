import{
	OFFSET_LOCATION,
	ROTATION_LOCATION,
	POSITION_LOCATION,
	COLOR_LOCATION,
	AGE_LOCATION,
	INIT_OFFSET_LOCATION,
	PICKING_COLOR_LOCATION
} from './config';

import {pie, randomNormal, max, scaleLinear} from 'd3';


//GL utilities
//Compile shader from gl context and shader text
const compileShader = (gl, source, type) => {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	const log = gl.getShaderInfoLog(shader);
	if(log){
		console.log(log);
		console.log(source);
	}

	return shader;
}

//Compile program from gl context, vertex shader and frag shader
const createProgram = (gl, vs, fs, ...varyings) => {
	const program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);

	//set up transformFeedbackVaryings, if those are present in the program
	if(varyings.length){
		gl.transformFeedbackVaryings(
			program,
			varyings, //as array of strings
			gl.SEPARATE_ATTRIBS
		);
	}

	gl.linkProgram(program);

	const log = gl.getProgramInfoLog(program);
	if(log){
		console.log(log);
	}

	return program;
}

//Initialize two sets of VAOs and transform feedbacks
const initVAOs = gl => {
	const vaos = [gl.createVertexArray(), gl.createVertexArray()];
	const tfs = [gl.createTransformFeedback(), gl.createTransformFeedback()];
	const buffers = new Array(vaos.length);

	for(let i = 0; i < vaos.length; i++){
		const vao = vaos[i];
		const tf = tfs[i];
		buffers[i] = new Array(7);
		const buffer = buffers[i];

		//Set up VAO i.e. buffer state
		gl.bindVertexArray(vao);

		buffer[OFFSET_LOCATION] = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer[OFFSET_LOCATION]);
		//gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STREAM_COPY);
		gl.vertexAttribPointer(OFFSET_LOCATION, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(OFFSET_LOCATION);
		gl.vertexAttribDivisor(OFFSET_LOCATION, 1); //TODO: remove later

		buffer[ROTATION_LOCATION] = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer[ROTATION_LOCATION]);
		//gl.bufferData(gl.ARRAY_BUFFER, rotations, gl.STREAM_COPY);
		gl.vertexAttribPointer(ROTATION_LOCATION, 1, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(ROTATION_LOCATION);
		gl.vertexAttribDivisor(ROTATION_LOCATION, 1); //TODO: remove later

    buffer[POSITION_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[POSITION_LOCATION]);
    //gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(POSITION_LOCATION);
    
    buffer[COLOR_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[COLOR_LOCATION]);
    //gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.vertexAttribPointer(COLOR_LOCATION, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(COLOR_LOCATION);
    gl.vertexAttribDivisor(COLOR_LOCATION, 1); //attribute is used once per instance

    buffer[AGE_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[AGE_LOCATION]);
    //gl.bufferData(gl.ARRAY_BUFFER, age, gl.STREAM_COPY);
    gl.vertexAttribPointer(AGE_LOCATION, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(AGE_LOCATION);
    gl.vertexAttribDivisor(AGE_LOCATION, 1);

    buffer[INIT_OFFSET_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[INIT_OFFSET_LOCATION]);
    //gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.STATIC_DRAW);
    gl.vertexAttribPointer(INIT_OFFSET_LOCATION, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(INIT_OFFSET_LOCATION);
    gl.vertexAttribDivisor(INIT_OFFSET_LOCATION, 0);

    buffer[PICKING_COLOR_LOCATION] = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer[PICKING_COLOR_LOCATION]);
    gl.vertexAttribPointer(PICKING_COLOR_LOCATION, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(PICKING_COLOR_LOCATION);
    gl.vertexAttribDivisor(PICKING_COLOR_LOCATION, 1);

		gl.bindVertexArray(null);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		//Set up transformFeedback objects
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer[OFFSET_LOCATION]);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, buffer[ROTATION_LOCATION]);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 2, buffer[AGE_LOCATION]);
		gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

	}

	return { vaos, tfs, buffers };

}

export {
	compileShader, 
	createProgram, 
	initVAOs
}

//Generate shuffled categories array from proportions
const generateShuffledCategories = (proportions, maxCount) => {
	const sum = proportions.reduce((total,v) => total+v, 0);

	//array of length = maxCount
	const categories = proportions.map((count,i) => 
			Array.from({length: Math.ceil(count/sum*maxCount)}).map(d => i)
		)
		.reduce((acc,v) => acc.concat(v), []);

	//shuffle this array
	const categoriesShuffled = [];
	for(let i = 0; i < maxCount; i++){
		categoriesShuffled.push(categories[Math.round(Math.random()*categories.length)]);
	}

	return categoriesShuffled;
}

export {
	generateShuffledCategories
}


//functions for laying out the cards on the screen
const rand = randomNormal(.3, .2);

const pieLayout = (instances, w, h, categories, proportions) => {
	if(!categories){
		return Array
			.from({length:instances})
			.map(() => [(rand() + 0.5)*h/2, Math.random()*Math.PI*2])
			.map(([r, theta]) => [r * Math.cos(theta)+w/2, r * Math.sin(theta)+h/2])
			.reduce((acc,v) => acc.concat(v), [])
	}else{
		const proportionAngles = pie().padAngle(0.3).sortValues(null)(proportions);
		return Array
			.from({length:instances})
			.map((d,i) => {
				const cat = categories[i]?categories[i]:0;
				const {startAngle, endAngle} = proportionAngles[cat]; 
				const angle = startAngle + Math.random()*(endAngle - startAngle);
				const r = (rand() + 0.5)*h/2;
				return [r, angle];
			})
			.map(([r, theta]) => [r * Math.cos(theta)+w/2, r * Math.sin(theta)+h/2])
			.reduce((acc,v) => acc.concat(v), [])
	}
}

const columnsLayout = (instances, w, h, categories, proportions, horizontal=true) => {

	//Math for figuring out where to position these cards as columns
	const PADDING_X = 20;
	const PADDING_Y = 10;
	const scaleLength = scaleLinear()
		.domain([0, max(proportions)])
		.range([0, w - PADDING_X*2]);
	const COLUMN_WIDTH = (h - (proportions.length+1)*PADDING_Y)/proportions.length;
	const categoryPositions = proportions.map((v,i) => {
		const y0 = PADDING_Y + i*(PADDING_Y + COLUMN_WIDTH);
		const y1 = y0 + COLUMN_WIDTH;
		const length = scaleLength(v);
		const x0 = w/2-length/2;
		const x1 = w/2+length/2;
		return {x0,x1,y0,y1};
	});

	return Array.from({length:instances})
		.map((d,i) => {
			const cat = categories[i]?categories[i]:0;
			const {x0, x1, y0, y1} = categoryPositions[cat]; 
			return [
				x0 + Math.random()*(x1-x0),
				y0 + Math.random()*(y1-y0)
			]
		})
		.reduce((acc,v) => acc.concat(v), [])

}

export {
	pieLayout,
	columnsLayout
}

