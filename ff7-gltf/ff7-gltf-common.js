// ff7-gltf common utilities

// usage: require('common.js')();

module.exports = function() {

  // translate degrees to radians
  this.toRadians = function(degrees) {
    return degrees * Math.PI / 180.0;
  };

  // calculate a quaternion from 3 individual axis rotations and an order like "YXZ"
  this.rotationToQuaternion = function(x, y, z, order) {
    order = order || "XYZ";
    var c1 = Math.cos(x / 2);
    var c2 = Math.cos(y / 2);
    var c3 = Math.cos(z / 2);
    var s1 = Math.sin(x / 2);
    var s2 = Math.sin(y / 2);
    var s3 = Math.sin(z / 2);
    var x, y, z, w;
    if ( order === 'XYZ' ) {
        x = s1 * c2 * c3 + c1 * s2 * s3;
        y = c1 * s2 * c3 - s1 * c2 * s3;
        z = c1 * c2 * s3 + s1 * s2 * c3;
        w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if ( order === 'YXZ' ) {
        x = s1 * c2 * c3 + c1 * s2 * s3;
        y = c1 * s2 * c3 - s1 * c2 * s3;
        z = c1 * c2 * s3 - s1 * s2 * c3;
        w = c1 * c2 * c3 + s1 * s2 * s3;
    } else if ( order === 'ZXY' ) {
        x = s1 * c2 * c3 - c1 * s2 * s3;
        y = c1 * s2 * c3 + s1 * c2 * s3;
        z = c1 * c2 * s3 + s1 * s2 * c3;
        w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if ( order === 'ZYX' ) {
        x = s1 * c2 * c3 - c1 * s2 * s3;
        y = c1 * s2 * c3 + s1 * c2 * s3;
        z = c1 * c2 * s3 - s1 * s2 * c3;
        w = c1 * c2 * c3 + s1 * s2 * s3;
    } else if ( order === 'YZX' ) {
        x = s1 * c2 * c3 + c1 * s2 * s3;
        y = c1 * s2 * c3 + s1 * c2 * s3;
        z = c1 * c2 * s3 - s1 * s2 * c3;
        w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if ( order === 'XZY' ) {
        x = s1 * c2 * c3 - c1 * s2 * s3;
        y = c1 * s2 * c3 - s1 * c2 * s3;
        z = c1 * c2 * s3 + s1 * s2 * c3;
        w = c1 * c2 * c3 + s1 * s2 * s3;
    }
    return { w: w, x: x, y: y, z: z };
  };

  // input  = {r:r,g:r,b:b,a:a} where each value is between -128 and 127
  // output = {r:r,g:r,b:b,a:a} where each value is between 0.0 and 1.0
  this.translateUnsignedByteColor = function(color) {
    let r = color.r;
    let g = color.g;
    let b = color.b;
    let a = color.a;
    if (r < 0) { r = r + 256 };
    if (g < 0) { g = g + 256 };
    if (b < 0) { b = b + 256 };
    if (a < 0) { a = a + 256 };
    return { r: r/255.0, g: g/255.0, b: b/255.0, a: 1.0-a/255.0 };
  };

};
