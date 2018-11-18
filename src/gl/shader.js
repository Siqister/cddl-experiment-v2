import {
	OFFSET_LOCATION,
	ROTATION_LOCATION,
	POSITION_LOCATION,
	COLOR_LOCATION,
	AGE_LOCATION,
	INIT_OFFSET_LOCATION,
  PICKING_COLOR_LOCATION
} from './config';

const vs = `#version 300 es
	#define OFFSET_LOCATION ${OFFSET_LOCATION}
	#define ROTATION_LOCATION ${ROTATION_LOCATION}
	#define POSITION_LOCATION ${POSITION_LOCATION}
	#define COLOR_LOCATION ${COLOR_LOCATION}
  #define AGE_LOCATION ${AGE_LOCATION}
  #define INIT_OFFSET_LOCATION ${INIT_OFFSET_LOCATION}
  #define PICKING_COLOR_LOCATION ${PICKING_COLOR_LOCATION}

  #define M_2PI 6.28318530718

  precision highp float;
  precision highp int;

  uniform float u_w;
  uniform float u_h;
  uniform float u_usePickingColor;

  layout(location = OFFSET_LOCATION) in vec2 a_offset;
  layout(location = ROTATION_LOCATION) in float a_rotation;
  layout(location = POSITION_LOCATION) in vec2 a_position;
  layout(location = COLOR_LOCATION) in vec3 a_color;
  layout(location = AGE_LOCATION) in float a_age;
  layout(location = PICKING_COLOR_LOCATION) in vec3 a_picking_color;

  out vec3 v_color;
  out float v_alpha;

  void main(){
    //convert float rotation into a mat2 rotation matrix
    float cos_r = cos(a_rotation);
    float sin_r = sin(a_rotation);
    mat2 rot = mat2(
      cos_r, sin_r,
      -sin_r, cos_r
    );

    vec2 position = rot * a_position + a_offset;
    position = vec2(
      position.x / u_w * 2.0 - 1.0,
      1.0 - position.y / u_h * 2.0
    );

    gl_Position = vec4(position, 0.0, 1.0);

    v_color = a_color;
    if(u_usePickingColor > 0.0){
      v_color = a_picking_color;
    }
    v_alpha = sin(a_age * M_2PI / 2.0);
    if(u_usePickingColor > 0.0){
      v_alpha = 1.0;
    }
  }
`;

const fs = `#version 300 es
  #define ALPHA 1.0
  
  precision highp float;
  precision highp int;

  in vec3 v_color;
  in float v_alpha;

  out vec4 color;

  void main(){
    color = vec4(v_color, v_alpha);
  }
`;

const transformVs = `#version 300 es
  #define OFFSET_LOCATION ${OFFSET_LOCATION}
  #define ROTATION_LOCATION ${ROTATION_LOCATION}
  #define AGE_LOCATION ${AGE_LOCATION}
  #define INIT_OFFSET_LOCATION ${INIT_OFFSET_LOCATION}
  #define M_2PI 6.28318530718

  #define WANDER_CIRCLE_R 0.01
  #define WANDER_CIRCLE_OFFSET 0.04
  #define RANDOM_WALK_DELTA 0.5
  #define CIRCULAR_DELTA 1.0
  #define DECAY 0.005

  precision highp float;
  precision highp int;

  uniform float u_time;
  uniform float u_w;
  uniform float u_h;
  uniform float u_random_walk_speed;
  uniform float u_circular_speed;
  uniform float u_radial_speed;
  uniform float u_decay;

  layout(location = OFFSET_LOCATION) in vec2 a_offset;
  layout(location = ROTATION_LOCATION) in float a_rotation;
  layout(location = AGE_LOCATION) in float a_age;
  layout(location = INIT_OFFSET_LOCATION) in vec2 a_init_offset;
  
  //These three varyings are transformFeedback outputs
  out vec2 v_offset;
  out float v_rotation;
  out float v_age;

  float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  void main(){
    float theta = M_2PI * rand(vec2(u_time, a_rotation + a_offset.x + a_offset.y));

    //create 2D rotation matrix from current a_rotation
    float cos_r = cos(a_rotation);
    float sin_r = sin(a_rotation);
    mat2 rot = mat2(
        cos_r, sin_r,
        -sin_r, cos_r
    );

    //RANDOM WALK
    //compute target vec2 to move towards at each step
    vec2 p = WANDER_CIRCLE_R * vec2(cos(theta), sin(theta)) + vec2(WANDER_CIRCLE_OFFSET, 0.0);
    vec2 target = normalize(rot * p);
    //Move each particle towards target, and record rotation
    v_rotation = atan(target.y, target.x);
    v_offset = a_offset + u_random_walk_speed * target;

    //CIRCULAR MOTION
    vec2 tangent = cross(
      vec3(a_offset.x - u_w/2.0, a_offset.y - u_h/2.0, 0.0), 
      vec3(0.0, 0.0, 1.0)
    ).xy;
    v_offset = v_offset + u_circular_speed * normalize(tangent);

    //RADIAL MOTION
    //Accelerate from center then gradually slow down
    vec2 radial = vec2(a_offset.x - u_w/2.0, a_offset.y - u_h/2.0);
    float radialDistanceToCenter = length(radial);
    radial = normalize(radial);
    v_offset = v_offset + u_radial_speed * radial * (1.0 - radialDistanceToCenter / u_h);

    //Output new v_age
    v_age = a_age + u_decay;
    if(v_age > 1.0){
      v_age = 0.0;
      v_offset = a_init_offset;
    }

    gl_Position = vec4(v_offset, 0.0, 1.0);
  }
`;

const transformFs = `#version 300 es
  void main(){
    //no-op, since we don't render fragments during transform feedback step
  }
`;

export {
	vs,
	fs,
	transformVs,
	transformFs
}