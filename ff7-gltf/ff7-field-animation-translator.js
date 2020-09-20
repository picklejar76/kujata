// usage: require("./ff7-field-animations-to-gltf.js")();

require("./gltf-2.0-util.js")();
require("./ff7-gltf-common.js")();
//var HrcLoader = require("../ff7-asset-loader/hrc-loader.js");
//var RsdLoader = require("../ff7-asset-loader/rsd-loader.js");
//var PLoader = require("../ff7-asset-loader/p-loader.js");
var ALoader = require("../ff7-asset-loader/a-loader.js");
const BattleModelLoader = require("../ff7-asset-loader/battle-model-loader.js");
const BattleAnimationLoader = require("../ff7-asset-loader/battle-animation-loader.js");

const fs = require("fs");
const mkdirp = require('mkdirp');

//var IFALNA_DB = JSON.parse(fs.readFileSync('../ifalna-db/ifalna.json', 'utf-8'));

module.exports = class FF7FieldAnimationTranslator {

  constructor() {
  }

  // Translate a FF7 FIELD.LGP's *.A file to glTF 2.0 format
  // config = configuration object, see config.json for example
  // animFileId = which animation to include in the output gltf
  translateFF7FieldAnimationToGLTF(config, animFileId) {

    var outputAnimationsDirectory = config.outputFieldCharDirectory;

    if (!fs.existsSync(outputAnimationsDirectory)) {
      console.log("Creating output directory: " + outputAnimationsDirectory);
      mkdirp.sync(outputAnimationsDirectory);
    }

    var ROOT_X_ROTATION_DEGREES = 180.0;
    var FRAMES_PER_SECOND = 30.0;

    console.log("Will translate the following animFileId: ", animFileId);

    var animationData = ALoader.loadA(config, animFileId);
    // console.log('animationData', animationData)
    var gltfFilename = animFileId.toLowerCase() + ".a.gltf";
    var binFilename = animFileId.toLowerCase() + ".a.bin";
    var rotationOrder = "YXZ"; // TODO: use animation data rotationOrder instead
    let gltf = {};
    gltf.asset = {
      "version": "2.0",
      "generator": "kujata",
    };
    gltf.accessors = [];
    gltf.buffers = [];
    gltf.bufferViews = [];
    gltf.animations = [];
    var allBuffers = []; // array of all individual Buffers, which will be combined at the end
    var numBuffersCreated = 0;

    gltf.animations.push({
      //"name": animId + "_animation", // TODO: name the animation
      "channels": [],
      "samplers": []
    });
    let animationIndex = gltf.animations.length - 1;

    let numFrames = animationData.numFrames;

    // create buffer to store start-time/end-time pair(s)
    let numTimeMarkers = 2 * numFrames; // start time and end time per frame
    let startAndEndTimeBuffer = Buffer.alloc(numFrames * 2 * 4); // 2 time markers per frame, 4 bytes per float time
    for (let f = 0; f < numFrames; f++) {
      let startTime = f / FRAMES_PER_SECOND;
      let endTime = (f + 1) / FRAMES_PER_SECOND;
      startAndEndTimeBuffer.writeFloatLE(startTime, f * 8);
      startAndEndTimeBuffer.writeFloatLE(endTime, f * 8 + 4);
    }
    allBuffers.push(startAndEndTimeBuffer);
    numBuffersCreated++;
    let startAndEndTimeAccessorIndex = numBuffersCreated - 1; // will assign to sampler.input
    gltf.accessors.push({
      "bufferView": startAndEndTimeAccessorIndex,
      "byteOffset": 0,
      "type": "SCALAR",
      "componentType": COMPONENT_TYPE.FLOAT,
      "count": numFrames * 2 // 2 time markers per frame
    });
    gltf.bufferViews.push({
      "buffer": 0,
      "byteLength": startAndEndTimeBuffer.length,
      //"byteStride": 4, // 4 bytes per float time
      "target": ARRAY_BUFFER
    });

    // each bone will get its own series of animation data
    for (let boneIndex = 0; boneIndex < animationData.numBones; boneIndex++) {
      // create buffer for animation frame data for this bone
      let boneFrameDataBuffer = Buffer.alloc(numFrames * 2 * 4 * 4); // 2 rotations per frame (start and end), 4 floats per rotation, 4 bytes per float
      for (let f = 0; f < numFrames; f++) {
        let frameData = animationData.animationFrames[f];
        let boneRotation = frameData.boneRotations[boneIndex];
        let quat = rotationToQuaternion(
          toRadians(boneRotation.x),
          toRadians(boneRotation.y),
          toRadians(boneRotation.z),
          rotationOrder
        );
        // write rotation value for "start of frame"
        boneFrameDataBuffer.writeFloatLE(quat.x, f * 32 + 0);
        boneFrameDataBuffer.writeFloatLE(quat.y, f * 32 + 4);
        boneFrameDataBuffer.writeFloatLE(quat.z, f * 32 + 8);
        boneFrameDataBuffer.writeFloatLE(quat.w, f * 32 + 12);
        // write rotation value for "end of frame" (TODO: use "f+1" rotation for smoother animations)
        boneFrameDataBuffer.writeFloatLE(quat.x, f * 32 + 16);
        boneFrameDataBuffer.writeFloatLE(quat.y, f * 32 + 20);
        boneFrameDataBuffer.writeFloatLE(quat.z, f * 32 + 24);
        boneFrameDataBuffer.writeFloatLE(quat.w, f * 32 + 28);
      }
      // console.log('boneFrameDataBuffer', boneFrameDataBuffer, boneFrameDataBuffer.length)
      allBuffers.push(boneFrameDataBuffer);
      numBuffersCreated++;
      let boneFrameDataAccessorIndex = numBuffersCreated - 1; // will assign to sampler.output
      gltf.accessors.push({
        "bufferView": boneFrameDataAccessorIndex,
        "byteOffset": 0,
        "type": "VEC4",
        "componentType": COMPONENT_TYPE.FLOAT,
        "count": numFrames * 2 // 2 rotations per frame
      });
      gltf.bufferViews.push({
        "buffer": 0,
        "byteLength": boneFrameDataBuffer.length,
        "target": ARRAY_BUFFER
      });
      gltf.animations[animationIndex].samplers.push({
        "input": startAndEndTimeAccessorIndex,
        "interpolation": "LINEAR",
        "output": boneFrameDataAccessorIndex
      });
      let nodeIndex = boneIndex + 2; // node0=RootContainer, node1=BoneRoot, node2=Bone0, node3=Bone1, etc.
      let samplerIndex = gltf.animations[animationIndex].samplers.length - 1;
      gltf.animations[animationIndex].channels.push({
        "sampler": samplerIndex,
        "target": {
          "node": nodeIndex,
          "path": "rotation"
        }
      });
    }

    let frameRootTranslationBuffer = Buffer.alloc(numFrames * 2 * 3 * 4); // 2 translation per frame (start and end), 3 floats per translation, 4 bytes per float
    let frameRootRotationBuffer = Buffer.alloc(numFrames * 2 * 4 * 4);
    let zList = []
    for (let f = 0; f < numFrames; f++) {
      // Root translation
      let rootTranslation = animationData.animationFrames[f].rootTranslation
      // console.log('rootTranslation', rootTranslation)

      zList.push(rootTranslation)
      frameRootTranslationBuffer.writeFloatLE(rootTranslation.x, f * 24 + 0);
      frameRootTranslationBuffer.writeFloatLE(rootTranslation.y - 13.535284042358398, f * 24 + 4);
      frameRootTranslationBuffer.writeFloatLE(-rootTranslation.z - 0.07706927508115768, f * 24 + 8);

      frameRootTranslationBuffer.writeFloatLE(rootTranslation.x, f * 24 + 12);
      frameRootTranslationBuffer.writeFloatLE(rootTranslation.y - 13.535284042358398, f * 24 + 16);
      frameRootTranslationBuffer.writeFloatLE(-rootTranslation.z - 0.07706927508115768, f * 24 + 20);

      allBuffers.push(frameRootTranslationBuffer)
      numBuffersCreated++

      let rootTranslationFrameDataAccessorIndex = numBuffersCreated - 1; // will assign to sampler.output
      gltf.accessors.push({
        "bufferView": rootTranslationFrameDataAccessorIndex,
        "byteOffset": 0,
        "type": "VEC3",
        "componentType": COMPONENT_TYPE.FLOAT,
        "count": numFrames * 2 // 2 rotations per frame
      });
      gltf.bufferViews.push({
        "buffer": 0,
        "byteLength": frameRootTranslationBuffer.length,
        "target": ARRAY_BUFFER
      });
      gltf.animations[animationIndex].samplers.push({
        "input": startAndEndTimeAccessorIndex,
        "interpolation": "LINEAR",
        "output": rootTranslationFrameDataAccessorIndex
      });
      let nodeIndex = 0; // node0=RootContainer, node1=BoneRoot, node2=Bone0, node3=Bone1, etc.
      let samplerIndex = gltf.animations[animationIndex].samplers.length - 1;
      gltf.animations[animationIndex].channels.push({
        "sampler": samplerIndex,
        "target": {
          "node": nodeIndex,
          "path": "translation"
        }
      });

      // Root rotation
      let rootRotation = animationData.animationFrames[f].rootRotation
      // console.log('rootRotation', rootRotation)
      let quat = rotationToQuaternion(
        toRadians(rootRotation.x),
        toRadians(-rootRotation.y),
        toRadians(-rootRotation.z),
        rotationOrder
      );
      // write rotation value for "start of frame"
      frameRootRotationBuffer.writeFloatLE(quat.x, f * 32 + 0)
      frameRootRotationBuffer.writeFloatLE(quat.y, f * 32 + 4)
      frameRootRotationBuffer.writeFloatLE(quat.z, f * 32 + 8)
      frameRootRotationBuffer.writeFloatLE(quat.w, f * 32 + 12)
      // write rotation value for "end of frame" (TODO: use "f+1" rotation for smoother animations)
      frameRootRotationBuffer.writeFloatLE(quat.x, f * 32 + 16)
      frameRootRotationBuffer.writeFloatLE(quat.y, f * 32 + 20)
      frameRootRotationBuffer.writeFloatLE(quat.z, f * 32 + 24)
      frameRootRotationBuffer.writeFloatLE(quat.w, f * 32 + 28)
      allBuffers.push(frameRootRotationBuffer)
      numBuffersCreated++

      let rootRotationFrameDataAccessorIndex = numBuffersCreated - 1; // will assign to sampler.output
      gltf.accessors.push({
        "bufferView": rootRotationFrameDataAccessorIndex,
        "byteOffset": 0,
        "type": "VEC4",
        "componentType": COMPONENT_TYPE.FLOAT,
        "count": numFrames * 2 // 2 rotations per frame
      });
      gltf.bufferViews.push({
        "buffer": 0,
        "byteLength": frameRootRotationBuffer.length,
        "target": ARRAY_BUFFER
      });
      gltf.animations[animationIndex].samplers.push({
        "input": startAndEndTimeAccessorIndex,
        "interpolation": "LINEAR",
        "output": rootRotationFrameDataAccessorIndex
      });
      // nodeIndex = 0; // node0=RootContainer, node1=BoneRoot, node2=Bone0, node3=Bone1, etc.
      samplerIndex = gltf.animations[animationIndex].samplers.length - 1;
      gltf.animations[animationIndex].channels.push({
        "sampler": samplerIndex,
        "target": {
          "node": nodeIndex,
          "path": "rotation"
        }
      });
    }
    // console.log('zList', zList)
    // note: some skeletons have zero bones
    if (gltf.bufferViews.length > 0) {

      // We wait until now to set the byteOffset for all buffer views, because that's
      // the easiest way to do it, given the dynamic nature of which buffers we use.
      let numBufferViews = gltf.bufferViews.length;
      gltf.bufferViews[0].byteOffset = 0;
      for (let i = 1; i < numBufferViews; i++) {
        gltf.bufferViews[i].byteOffset = gltf.bufferViews[i - 1].byteOffset + gltf.bufferViews[i - 1].byteLength;
      }

      // TODO: set min and max for all accessors to help engines optimize

      // we can finally add the buffer (containing all buffer views) to gltf because we know the total size
      let lastBufferView = gltf.bufferViews[numBufferViews - 1];
      let totalLength = lastBufferView.byteOffset + lastBufferView.byteLength;
      let combinedBuffer = Buffer.concat(allBuffers, totalLength);
      gltf.buffers.push({
        "byteLength": totalLength,
        "uri": binFilename
      });

      // create *.bin file
      let binFilenameFull = outputAnimationsDirectory + "/" + binFilename;
      fs.writeFileSync(binFilenameFull, combinedBuffer);
      console.log("Wrote: " + binFilenameFull);
    }

    // create *.gltf file
    let gltfFilenameFull = outputAnimationsDirectory + "/" + gltfFilename;
    fs.writeFileSync(gltfFilenameFull, JSON.stringify(gltf, null, 2));
    console.log("Wrote: " + gltfFilenameFull);

  }; // end function translateFF7FieldAnimationToGLTF

}; // end class FF7FieldAnimationTranslator (and end of modules.export)
