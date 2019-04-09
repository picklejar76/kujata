const fs = require("fs");

module.exports = {

  loadA: function(config, aBaseFilename) {

    var buffer = fs.readFileSync(config.inputFieldCharDirectory + '/' + aBaseFilename + ".A");
    var offset = 0;

    var readInt   = function() { let i = buffer.readInt32LE(offset); offset += 4; return i; }
    var readFloat = function() { let f = buffer.readFloatLE(offset); offset += 4; return f; }
    var readByte  = function() { let b = buffer.readUInt8  (offset); offset += 1; return b; }
    var readShort = function() { let s = buffer.readInt16LE(offset); offset += 2; return s; }
    let fileSizeBytes = buffer.length;

    let animation = {
      version: readInt(),
      numFrames: readInt(),
      numBones: readInt(),
      rotationOrder1: readByte(),
      rotationOrder2: readByte(),
      rotationOrder3: readByte(),
      unused: [readByte(), readInt(), readInt(), readInt(), readInt(), readInt()],
      animationFrames: []
    };
    for (let i=0; i<animation.numFrames; i++) {
      let animationFrame = {
        rootRotation: { x: readFloat(), y: readFloat(), z: readFloat() },
        rootTranslation: { x: readFloat(), y: readFloat(), z: readFloat() },
        boneRotations: []
      };
      for (let j=0; j<animation.numBones; j++) {
        animationFrame.boneRotations.push({ x: readFloat(), y: readFloat(), z: readFloat() });
      }
      animation.animationFrames.push(animationFrame);
    }

    animation.unused = undefined; // remove unwanted data

    return animation;
  }

};
