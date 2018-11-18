import './style.css';

import * as dat from 'dat.gui';

import GLModule from './gl';


//Feel free to tweak these to see changes
const INSTANCES = 4000;
const PROPORTIONS_1 = [1,1,1,1,1,1,1,1,1,1];
const PROPORTIONS_2 = [30,1,5,40,1,60,1,5,9,30];

//DOM stuff
//Can be combined with the onMount hook of the wrapper component
const container = document.querySelector('.gl-container');
const canvas = container.appendChild(document.createElement('canvas'));
canvas.width = container.clientWidth;
canvas.height = container.clientHeight;
const gl = canvas.getContext('webgl2');

//Instantiate GLModule instance, and set its properties
const glModule = GLModule(gl, canvas)
	.setSize([canvas.width, canvas.height])
	.setInstances(INSTANCES)
	//.log()
	.onClick((id, category) => {
		console.log(`Card index (from 0 to 3999): ${id}`);
		console.log(`Card category (from 0 to 9): ${category}`);
	}, canvas);
//Must call instance to start rendering
//This will start a render loop
glModule();

//GUI stuff; can delete the stuff later as you implement the interface logic
const gui = new dat.GUI();
const f1 = gui.addFolder('Adjust motion simulation');
const params = {
	decay:0.009,
	randomWalkSpeed:0.5,
	angularSpeed:1.0,
	radialSpeed: 1.0,
	updateProportion:false,
	separateByCategory:false
}
f1.add(params, 'decay', 0, 0.05).onChange(val => {glModule.setDecay(val)});
f1.add(params, 'randomWalkSpeed', 0, 2.0).onChange(val => {glModule.setMotionRandom(val)});
f1.add(params, 'angularSpeed', 0, 4.0).onChange(val => {glModule.setMotionAngular(val)});
f1.add(params, 'radialSpeed', 0, 4.0).onChange(val => {glModule.setMotionRadial(val)});
gui.add(params, 'updateProportion').onChange(val => {
	if(val){
		glModule.setProportions(PROPORTIONS_2);
	}else{
		glModule.setProportions(PROPORTIONS_1);
	}
});
gui.add(params, 'separateByCategory').onChange(val => {
	if(val){
		glModule.separateByCat(val);
	}else{
		glModule.separateByCat(val);
	}
});

