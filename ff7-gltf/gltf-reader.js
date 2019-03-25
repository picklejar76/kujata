// Reads gltf files and prints their content, for troubleshooting purposes.
// This is a work-in-progress and does not support all possible gltf formats.

require('./gltf-2.0-util.js')();
const fs = require('fs');

// let gltfDirectory = '/opt/ff7-model-viewer/ff7-model-viewer/src/assets/models';
let gltfDirectory = './output/gltf'; // TODO: use config object instead
let gltfFilename = gltfDirectory + '/aaaa.hrc.gltf';
// let gltfDirectory = '.';
// let gltfFilename = 'BoxAnimated.gltf';

let gltf = JSON.parse(fs.readFileSync(gltfFilename));

let buffers = gltf.buffers;
let bufferViews = gltf.bufferViews;
let accessors = gltf.accessors;

function printBufferContentsAsHex(buffer) {
  let hexes = [];
  for (let i=0; i<buffer.length; i++) {
    let byte = buffer.readUInt8(i);
    let hex = ('0' + (byte & 0xFF).toString(16)).slice(-2);
    hexes.push(hex);
  }
  let description = hexes.join(' ');
  console.log(description);
}

let byteBuffers = [];
for (let i=0; i<buffers.length; i++) {
  let buffer = buffers[i];
  let byteBuffer = fs.readFileSync(gltfDirectory + '/' + buffer.uri);
  byteBuffers.push(byteBuffer);
  console.log('byteBuffer[' + i + ']=Buffer[' + byteBuffer.length + ']');
  //printBufferContentsAsHex(byteBuffer);
  if (byteBuffer.length != buffer.byteLength) {
    console.warn('WARNING: expected ' + buffer.byteLength + ' bytes but read ' + byteBuffer.length);
  }
}

let byteBufferViews = [];
for (let i=0; i<bufferViews.length; i++) {
  let bufferView = bufferViews[i]
  let byteBuffer = byteBuffers[bufferView.buffer];
  let byteBufferView = byteBuffer.slice(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);
  byteBufferViews.push(byteBufferView);
  console.log('byteBufferView[' + i + ']=Buffer[' + byteBufferView.length + ']');
  //printBufferContentsAsHex(byteBufferView);
}

function readElement(byteBufferView, offset, elementType, componentType) {
  let compTypeSize = componentTypeSize(componentType);
  let numComponentsForType = NUM_COMPONENTS_FOR_ELEMENT_TYPE[elementType];
  let component = {};
  let components = [];
  for (let i=0; i<numComponentsForType; i++) {
    if (componentType == COMPONENT_TYPE.UNSIGNED_SHORT) {
      component = byteBufferView.readUInt16LE(offset + i*compTypeSize);
    } else if (componentType == COMPONENT_TYPE.FLOAT) {
      component = byteBufferView.readFloatLE(offset + i*compTypeSize);
    } else {
      throw new Error('Component type invalid or not yet supported: ' + componentType);
    }
    components.push(component);
  }
  if (elementType == "VEC2") {
    return { 'u': components[0], 'v': components[1] };
  }
  if (elementType == "VEC3") {
    return { 'x': components[0], 'y': components[1], 'z': components[2] };
  }
  if (elementType == "VEC4") {
    return { 'x': components[0], 'y': components[1], 'z': components[2], 'w': components[3] };
  }
  if (elementType == "SCALAR") {
    return components[0];
  }
  throw new Error('Internal error: Need to add support for elementType=' + elementType);
}

for (let a=0; a<accessors.length; a++) {
  let accessor = accessors[a];
  console.log('\naccessor[' + a + ']:');
  console.log('  ' + accessor.count + ' x ' + accessor.type); // e.g. "24 x VEC3"
  let desc = '';
  let bufferView = bufferViews[accessor.bufferView];
  let byteBufferView = byteBufferViews[accessor.bufferView];
  let byteOffset = accessor.byteOffset;
  let compTypeSize = componentTypeSize(accessor.componentType); // e.g. 5123 = UNSIGNED_SHORT = 2 bytes each
  let elementType = accessor.type; // e.g. "SCALAR" or "VEC3"
  let numComponentsForType = NUM_COMPONENTS_FOR_ELEMENT_TYPE[elementType];
  let elementTypeSize = compTypeSize * numComponentsForType;
  let byteStride = bufferView.byteStride;
  if (byteStride) {
    console.log('  byteStride=' + byteStride + ', elementTypeSize=' + elementTypeSize);
  } else {
    byteStride = elementTypeSize;
    console.log('  byteStride not set = using elementTypeSize=' + elementTypeSize);
  }
  let valuesPerLine = numComponentsForType == 1 ? 16 : 1;
  for (let i=0; i<accessor.count; i++) {
    let offset = byteOffset + i*byteStride;
    let element = readElement(byteBufferView, offset, elementType, accessor.componentType);
    if (i % valuesPerLine == 0) {
      desc = desc + '\n  [i=' + i + ']: ';
    }
    desc = desc + JSON.stringify(element) + ' ';
  }
  console.log(desc);
}
