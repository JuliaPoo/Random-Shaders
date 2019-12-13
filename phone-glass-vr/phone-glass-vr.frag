/*
 * DISCLAIMER:
 * This code is not made to be reusable or readable
 * It is made ad-hoc by somebody excited to render glass
/*

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 resolution;
uniform mat3 rotationMatrix;
uniform vec2 cameraAddent;
uniform mat2 cameraOrientation;
uniform samplerExternalOES cameraBack;
uniform float time;

const float END = 45.;
const float ep = 0.0001;

mat2 rot(float a){
	return mat2(cos(a), -sin(a), sin(a), cos(a));
}

float smin(float a, float b, float k){
	float f = clamp(0.5 + 0.5 * ((a - b) / k), 0., 1.);
    return (1. - f) * a + f  * b - f * (1. - f) * k;
}

float cube(vec3 p, float b, float r){
    vec3 d = abs(p) - b;
    return length(max(d,0.0)) - r + min(max(d.x,max(d.y,d.z)),0.0);
}

float sphere(vec3 p, float r){
 	return length(p) - r;
}

float sdOctahedron( vec3 p, float s) {
	  p = abs(p);
    return (p.x+p.y+p.z-s)*0.57735027;
}

float obj(vec3 p){
	

	p = p.zyx;
    p = rotationMatrix*p;
    p.zyx = p;

    //p.xz *= rot(1.3);
    //p.yx *= rot(.7);

    /*
    vec3 pos = p;

    float k = 4.;

    pos.xy *= rot(k * .06);
    float cube1 = cube(pos, 1., 0.);
    pos = p;
    pos.zy *= rot(k * .08);
    float cube2 = cube(pos, 1., 0.);
    pos = p;
    pos.zx *= rot(k * .14);
    float cube3 = cube(pos, 1., 0.);

	return max(max(cube1, cube2), cube3);
	*/


    //return sphere(p, 1.);
    //return cube(p, 1., .0);
    return smin(sdOctahedron(p, 2.),
    	sphere(p + 2.*vec3(sin(time),0,cos(1.3*time)), .5), 1.);
}

float screen(vec3 p, float off_x, float sig){
	return sig*(p.x - off_x);
}

float frontscreen(vec3 p){ return screen(p, -20., 1.); }
float backscreen(vec3 p){ return screen(p, 20., -1.); }

float SDscene(vec3 p){


	float obj = obj(p);
    float frontscreen = frontscreen(p);
    float backscreen = backscreen(p);

    float d = min(obj, frontscreen);
    d = min(d, backscreen);

    return d;
}

vec3 SDnormal(vec3 p){

    //Calculates the normal vector of SDscene

    return normalize(vec3(
    SDscene(vec3(p.x+ep,p.y,p.z))-SDscene(vec3(p.x-ep,p.y,p.z)),
    SDscene(vec3(p.x,p.y+ep,p.z))-SDscene(vec3(p.x,p.y-ep,p.z)),
    SDscene(vec3(p.x,p.y,p.z+ep))-SDscene(vec3(p.x,p.y,p.z-ep))
    ));
}

float depth(vec3 ro, vec3 rd, float sig){

    //Returns depth from ro given raydirection

    int max=300;
    vec3 p;

    float dist=0., d;
    for (int i=0; i<max; i++){
        p = ro + dist*rd;
    	d = SDscene(p)*sig;
    if (abs(d)<ep){
        return dist+d;
    }
    dist += d;
    if (dist > END){
        return END;
    }
  }
}

void ray_obj(inout vec3 ro, inout vec3 rd, inout float Dglass, inout float d, inout vec3 col, inout vec3 scale){

    int Nmax = 10, count = 0, count2 = 0;
    vec3 p, rd_;
    while (count < Nmax){

        //Go into glass
        rd = normalize(refract(rd, SDnormal(ro), 0.6));
        ro -= SDnormal(ro) * ep*3.;
        d = depth(ro, rd, -1.);
        ro += rd * d;
    	Dglass += d;

        //internal refraction
    	rd_ = refract(rd, -SDnormal(ro), 1.5);
       	while (length(rd_) < 0.0001 && count2 < Nmax){

            rd = normalize(reflect(rd, -SDnormal(ro)));
            ro -= SDnormal(ro) * ep*3.;
            d = depth(ro, rd, -1.);
            ro += d*rd;

            Dglass += d;
            rd_ = refract(rd, -SDnormal(ro), 1.5);
            count2 += 1;
        }

        if (length(rd_) > 0.0001){rd = normalize(rd_);}
        ro += SDnormal(ro) * ep*3.;
        d = depth(ro, rd, 1.);
        ro += rd * d;

        if (abs(obj(ro)) > ep){break;}

        //if (mirror(ro) > ep){ break;}

		count += 1;
    }

    vec3 tint = vec3(exp(Dglass*-.05),exp(Dglass*-0.01),exp(Dglass*-0.05));
    scale *= tint;
    Dglass = 0.;
}

vec3 render(vec2 uv, float R){
    vec3 col;

    //Camera
    float ScreenSize = 4.;

    float zoom = 2.5;
    float k = 0.4;
  	vec3 ro = vec3(4.,0.,0.);
  	vec3 lookat = vec3(0,0.,0);


  	vec3 fw = normalize(lookat - ro);
  	vec3 r = normalize(cross(vec3(0,1.,0), fw));
  	vec3 up = normalize(cross(fw,r));
  	vec3 scrC = ro + (zoom)*fw;
  	vec3 scrP = scrC + (uv.x*r + uv.y*up) * ScreenSize;
  	vec3 rd = normalize(scrP - ro);

    float Dglass;
    float d = depth(ro, rd, 1.);
    ro += d*rd;

    vec3 scale = vec3(1.);
    int Nmax = 5, count;
    while (count < Nmax){
        //hits background
        //if (d > END - ep){
        if (abs(frontscreen(ro)) < ep || abs(backscreen(ro)) < ep || d > END - ep){
            //col += texture(iChannel1, (ro.zy/10. * vec2(R,1) - vec2(.5, .5)) ).xyz * scale;

            vec2 st = cameraAddent + (ro.zy/70. * vec2(R,1) + vec2(.5, .5)) * cameraOrientation;
            st = mod(st, 1.);
            col += texture2D(cameraBack, st).rgb * scale;

            break;
        }

        //hit obj
        else if (abs(obj(ro)) < ep){
            ray_obj(ro, rd, Dglass, d, col, scale);
        }

        else{d = END;}

        count += 1;
    }
    return col;
}



void main(void){

    //Shader setup
    vec2 R = resolution.xy;
    vec2 uv = (gl_FragCoord.xy - 0.5*R)/R.x;
    vec3 col = render(uv, R.y/R.x);

    //post processing
    col *= sqrt(length(uv) - 1.);  
    col += vec3(1., .3, .7)*.2;
    
    	
    gl_FragColor = vec4(col,1.);

}