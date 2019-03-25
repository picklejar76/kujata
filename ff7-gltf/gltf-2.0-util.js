// glTF 2.0 utilities

// usage: require('gltf-2.0-util.js')();

// glTF 2.0 spec: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0

module.exports = function() {

  // glTF 2.0 element types
  this.NUM_COMPONENTS_FOR_ELEMENT_TYPE = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16
  };

  // glTF 2.0 component types
  this.COMPONENT_TYPE = {
    "BYTE": 5120,
    "UNSIGNED_BYTE": 5121,
    "SHORT": 5122,
    "UNSIGNED_SHORT": 5123,
    "UNSIGNED_INT": 5125,
    "FLOAT": 5126
  };

  this.COMPONENT_TYPES = [
    { "id": 5120, "name": "BYTE",           bytes: 1 },
    { "id": 5121, "name": "UNSIGNED_BYTE",  bytes: 1 },
    { "id": 5122, "name": "SHORT",          bytes: 2 },
    { "id": 5123, "name": "UNSIGNED_SHORT", bytes: 2 },
    { "id": 5125, "name": "UNSIGNED_INT",   bytes: 4 },
    { "id": 5126, "name": "FLOAT",          bytes: 4 }
  ];

  this.componentTypeSize = function(componentTypeId) {
    // TODO: make this more efficient by building lookup map instead
    for (let cType of this.COMPONENT_TYPES) {
      if (cType.id == componentTypeId) {
        return cType.bytes;
      }
    }
    throw new Error('Invalid componentTypeId:', componentTypeId);
  };

  this.POINTS_PER_VERTEX = 3;

  this.FLOAT_SIZE = 4;

  // glTF primitive.mode values
  this.PRIMITIVE_MODE = {
    "POINTS": 0,
    "LINES": 1,
    "LINE_LOOP": 2,
    "LINE_STRIP": 3,
    "TRIANGLES": 4,
    "TRIANGLE_STRIP": 5,
    "TRIANGLE_FAN": 6
  };

  // glTF bufferView.target values
  this.ARRAY_BUFFER = 34962;
  this.ELEMENT_ARRAY_BUFFER = 34963;

};
