// ff7-gltf common utilities

// usage: require('common.js')();

module.exports = function() {

  // translate degrees to radians
  this.toRadians = function(degrees) {
    return degrees * Math.PI / 180.0;
  };

  // calculate a quaternion from 3 individual axis rotations and an order like "YXZ"
  // note: x, y, z are expected to be in radians
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

  // The methods below are an alternate way to build a rotation matrix, based on Kimera code.
  // However, the existing methods above seem to produce the same results (for YXZ rotation).
  // So, these are not used any more, but we'll keep the code here for reference.
  /*
  this.buildRotationMatrixWithQuaternions = function(alpha, beta, gamma, isRadians, returnQuaternionInsteadOfMatrix) {
    let px = {x:1, y:0, z:0};
    let py = {x:0, y:1, z:0};
    let pz = {x:0, y:0, z:1};
    let quat_x = this.buildQuaternionFromAxis(px, alpha, isRadians); // quaternion
    let quat_y = this.buildQuaternionFromAxis(py, beta, isRadians); // quaternion
    let quat_z = this.buildQuaternionFromAxis(pz, gamma, isRadians); // quaternion
    let quat_xy = this.multiplyQuaternions(quat_y, quat_x, isRadians);  // quaternion
    let quat_xyz = this.multiplyQuaternions(quat_xy, quat_z, isRadians); // quaternion
    if (returnQuaternionInsteadOfMatrix) {
      return quat_xyz;
    } else {
      let mat_res = this.buildMatrixFromQuaternion(quat_xyz); // array of doubles
      return mat_res;
    }
  }

  this.buildQuaternionFromAxis = function(vec, angle, isRadians) {
    let angleRadians = isRadians ? angle : this.toRadians(angle);
    let halfAngle = angleRadians / 2.0;
    let sinAngle = Math.sin(halfAngle);
    let cosAngle = Math.cos(halfAngle);
    let res_quat = {
      x: vec.x * sinAngle,
      y: vec.y * sinAngle,
      z: vec.z * sinAngle,
      w: cosAngle
    };
    return res_quat;
  }

  this.multiplyQuaternions = function(quat_a, quat_b) {
    let quat_res = {
      x: quat_a.w * quat_b.x + quat_a.x * quat_b.w + quat_a.y * quat_b.z - quat_a.z * quat_b.y,
      y: quat_a.w * quat_b.y + quat_a.y * quat_b.w + quat_a.z * quat_b.x - quat_a.x * quat_b.z,
      z: quat_a.w * quat_b.z + quat_a.z * quat_b.w + quat_a.x * quat_b.y - quat_a.y * quat_b.x,
      w: quat_a.w * quat_b.w - quat_a.x * quat_b.x - quat_a.y * quat_b.y - quat_a.z * quat_b.z
    };
    return quat_res;
  }

  this.buildMatrixFromQuaternion = function(quat) {

    let x2 = quat.x * quat.x;
    let y2 = quat.y * quat.y;
    let z2 = quat.z * quat.z;
    let xy = quat.x * quat.y;
    let xz = quat.x * quat.z;
    let yz = quat.y * quat.z;
    let wx = quat.w * quat.x;
    let wy = quat.w * quat.y;
    let wz = quat.w * quat.z;

    //This calculation would be a lot more complicated for non-unit length quaternions
    //Note: The constructor of Matrix4 expects the Matrix in column-major format like expected by
    //OpenGL
    let mat_res = [];
    mat_res[0] = 1.0 - 2.0 * (y2 + z2);
    mat_res[4] = 2.0 * (xy - wz);
    mat_res[8] = 2.0 * (xz + wy);
    mat_res[12] = 0.0;
    mat_res[1] = 2.0 * (xy + wz);
    mat_res[5] = 1.0 - 2.0 * (x2 + z2);
    mat_res[9] = 2.0 * (yz - wx);
    mat_res[13] = 0.0;
    mat_res[2] = 2.0 * (xz - wy);
    mat_res[6] = 2.0 * (yz + wx);
    mat_res[10] = 1.0 - 2.0 * (x2 + y2);
    mat_res[14] = 0.0;
    mat_res[3] = 0.0;
    mat_res[7] = 0.0;
    mat_res[11] = 0.0;
    mat_res[15] = 1.0;

    return mat_res;
  }
  */

};
