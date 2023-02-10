precision highp float;

// Passed from the vertex shader
varying vec3 fragColor;
varying float pointSize;

float linearstep(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
  float alpha = 1.0;

  // Test if the fragment is inside the circle area of this point
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  if (dot(cxy, cxy) > 1.03) {
    discard;
    return;
  }

  gl_FragColor = vec4(fragColor, alpha);
}