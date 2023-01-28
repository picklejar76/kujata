const fs = require("fs");

module.exports = {

  loadP: function(config, pBaseFilename, isBattleModel) {

    var calculateFaceNormal = function(model, polygon) {
      let p1 = model.vertices[polygon.vertexIndex1];
      let p2 = model.vertices[polygon.vertexIndex2];
      let p3 = model.vertices[polygon.vertexIndex3];
      let u = {
        x: p2.x - p1.x,
        y: p2.y - p1.y,
        z: p2.z - p1.z
      };
      let v = {
        x: p3.x - p1.x,
        y: p3.y - p1.y,
        z: p3.z - p1.z
      };
      // u.y = -u.y;
      // v.y = -v.y;
      let normal = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x
      };
      let length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
      return {
        x: normal.x / length,
        y: normal.y / length,
        z: normal.z / length
      };
      //return { x: 0, y: -1, z: 0 };
      //return normal;
    };

    var addMissingNormals = function(model) {
      if (model.normals.length == 0) {
        //console.log("normals are missing, will add them...");
        for (let polygon of model.polygons) {
          let normal = calculateFaceNormal(model, polygon);
          let length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
          //console.log("length=" + length + ", normal=" + JSON.stringify(normal));
          model.normals.push(normal);
          let normalIndex = model.normals.length - 1;
          polygon.normalIndex1 = normalIndex;
          polygon.normalIndex2 = normalIndex;
          polygon.normalIndex3 = normalIndex;
        }
      } else {
        //console.log("model already has normals, count=" + model.normals.length);
      }
      model.numNormals = model.normals.length;
    };

    var buffer = {};
    if (isBattleModel) {
      buffer = fs.readFileSync(config.inputBattleBattleDirectory + '/' + pBaseFilename); // e.g. "rtam"
    } else {
      buffer = fs.readFileSync(config.inputFieldCharDirectory + '/' + pBaseFilename + ".P");
    }
    var offset = 0;

    var readInt   = function() { let i = buffer.readInt32LE(offset); offset += 4; return i; }
    var readFloat = function() { let f = buffer.readFloatLE(offset); offset += 4; return f; }
    var readByte  = function() { let b = buffer.readUInt8  (offset); offset += 1; return b; }
    var readShort = function() { let s = buffer.readInt16LE(offset); offset += 2; return s; }
    let fileSizeBytes = buffer.length;

    let model = {
      off00: readInt(),
      off04: readInt(),
      isColoredVertices: readInt(),
      numVertices: readInt(),
      numNormals: readInt(),
      off14: readInt(),
      numTextureCoords: readInt(),
      numNormalIndices: readInt(),
      numEdges: readInt(),
      numPolygons: readInt(),
      off28: readInt(),
      off2c: readInt(),
      numHundrets: readInt(),
      numGroups: readInt(),
      mirex_g: readInt(),
      off3c: readInt(),
      unknown: [],
      vertices: [],
      normals: [],
      textureCoordinates: [],
      vertexColors: [],
      polygonColors: [],
      edges: [],
      polygons: [],
      hundrets: [],
      polygonGroups: []
    };

    for (let i = 0; i < 16; i++) {
      model.unknown[i] = readInt();
    }
    for (let i = 0; i < model.numVertices; i++) {
      model.vertices.push({ x: readFloat(), y: readFloat(), z: readFloat() });
    }
    for (let i = 0; i < model.numNormals; i++) {
      model.normals.push({ x: readFloat(), y: readFloat(), z: readFloat() });
    }
    for (let i = 0; i < model.numTextureCoords; i++) {
      model.textureCoordinates.push({ x: readFloat(), y: readFloat() });
    }
    for (let i = 0; i < model.numVertices; i++) {
      model.vertexColors.push({ b: readByte(), g: readByte(), r: readByte(), a: readByte() });
    }
    for (let i = 0; i < model.numPolygons; i++) {
      model.polygonColors.push({ b: readByte(), g: readByte(), r: readByte(), a: readByte() });
    }
    for (let i = 0; i < model.numEdges; i++) {
      model.edges.push({ vertexIndex1: readShort(), vertexIndex2: readShort() });
    }
    for (let i = 0; i < model.numPolygons; i++) {
      readShort(); // unknown
      model.polygons.push({
        vertexIndex1: readShort(), vertexIndex2: readShort(), vertexIndex3: readShort(),
        normalIndex1: readShort(), normalIndex2: readShort(), normalIndex3: readShort(),
        edgeIndex1: readShort(), edgeIndex2: readShort(), edgeIndex3: readShort()
      });
      readInt(); // unknown
    }
    for (let i = 0; i < model.numHundrets; i++) {
      model.hundrets.push({
        off00: readInt(),
        off04: readInt(),
        renderFlags1: readInt(),
        renderFlags2: readInt(),
        textureId: readInt(),
        textureSetPointer: readInt(),
        off18: readInt(),
        off1c: readInt(),
        off20: readInt(),
        shadeMode: readInt(),
        ambient: readInt(),
        off2c: readInt(),
        materialPointer: readInt(),
        srcBlend: readInt(),
        dstBlend: readInt(),
        off3c: readInt(),
        alphaRef: readInt(),
        blendMode: readInt(),	// (0=avg, 1=additive, 4=none? other modes are broken and unused)
        zsort: readInt(),	// filled in real-time
        off4c: readInt(),
        off50: readInt(),
        off54: readInt(),
        off58: readInt(),
        vertexAlpha: readInt(),
        off60: readInt()
      });
    }
    for (let i = 0; i < model.numGroups; i++) {
      model.polygonGroups.push({
        polygonType: readInt(),
        offsetPolyIndex: readInt(),
        numPolysInGroup: readInt(),
        offsetVertexIndex: readInt(),
        numVerticesInGroup: readInt(),
        offsetEdgeIndex: readInt(),
        unknowns: [readInt(), readInt(), readInt(), readInt(), readInt()],
        offsetTextureCoordinateIndex: readInt(),
        isTextureUsed: readInt(),
        textureIndex: readInt()
      });
    }
    readInt(); // unknown
    model.boundingBox = {
      max: { x: readFloat(), y: readFloat(), z: readFloat() },
      min: { x: readFloat(), y: readFloat(), z: readFloat() }
    }
    // Normal Index Table
    for (let i = 0; i < model.numNormalIndices; i++) {
      // console.log('model.numNormalIndices', model.numNormalIndices, i, offset)
      // TODO(picklejar): dangarfield fixed cvba fix below
      // by surrounding the readInt() with this if condition.
      // Test and verify that this doesn't break other models.
      if (offset + 4 <= buffer.length) { // Issue with cvba, runs out of buffer
        let ithNormalIndex = readInt(); // vertex v uses normal n
      }

    }
    if (offset != fileSizeBytes) {
      console.log("WARNING: Did not reach end of file data!");
    }

    // TODO(picklejar): dangarfield was not using the feature
    // below, find out why he didn't need it.
    addMissingNormals(model);

    return model;
  }

};
