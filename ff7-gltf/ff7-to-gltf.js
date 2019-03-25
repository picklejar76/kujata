// usage: require("./ff7-to-gltf.js")();

require("./gltf-2.0-util.js")();
require("./ff7-gltf-common.js")();
var HrcLoader = require("../ff7-asset-loader/hrc-loader.js");
var RsdLoader = require("../ff7-asset-loader/rsd-loader.js");
var PLoader = require("../ff7-asset-loader/p-loader.js");
var ALoader = require("../ff7-asset-loader/a-loader.js");

const fs = require("fs");
const mkdirp = require('mkdirp');

var IFALNA_DB = JSON.parse(fs.readFileSync('../ifalna-db/ifalna.json', 'utf-8'));

module.exports = function() {

  // default animations used to create initial bone rotations
  const DEFAULT_BASE_ANIM_ID_MAP = {
    "0": "atee",
    "1": "atee",
    "2": "avjd",
    "3": "fgjc",
    "4": "hoaa",
    "5": "cace",
    "6": "ehif",
    "9": "geaf",
    "11": "bdfe",
    "12": "atdc",
    "13": "bria",
    "14": "fgad",
    "15": "gcad",
    "17": "fcac",
    "18": "gsia",
    "19": "dkic",
    "20": "gmde",
    "21": "aafe",
    "23": "anhd",
    "24": "abcd",
    "25": "feaf",
    //"26": "",
    "27": "hxib",
    "28": "hccb",
    "29": "aeae"
  };

  // Translate a FF7 FIELD.LGP's *.HRC file to glTF 2.0 format
  // config = configuration object, see config.json for example
  // hrcFileId = which skeleton to translate, e.g. "AAAA" for AAAA.HRC (Cloud)
  // baseAnimFileId = which animation to use for base structure, e.g. "AAFE" for AAFE.A (Cloud standing)
  // animFileId = which animation to include in the output gltf
  // includeTextures = whether to include textures in the translation (set to false to disable)

  this.translate_ff7_field_hrc_to_gltf = function(config, hrcFileId, baseAnimFileId, animFileId, includeTextures) {

    if (!fs.existsSync(config.outputGltfDirectory)) {
      console.log("Creating output directory: " + config.outputGltfDirectory);
      mkdirp.sync(config.outputGltfDirectory);
    }

    var ROOT_X_ROTATION_DEGREES = 180.0;
    var FRAMES_PER_SECOND = 30.0;

    // let skeleton = require(config.inputJsonDirectory + "skeletons/" + hrcId + ".hrc.json");
    let skeleton = HrcLoader.loadHrc(config, hrcFileId);
    console.log("Translating: " + skeleton.name);
    let numBones = skeleton.bones.length;

    let hrcId = hrcFileId.toLowerCase();
    let animId = animFileId ? animFileId.toLowerCase() : null;

    var animationData = null;
    if (animFileId) {
      animationData = ALoader.loadA(config, animFileId);
    }

    var baseAnimationData = null;
    if (baseAnimFileId) {
      // let baseAnimId = baseAnimFileId.toLowerCase();
      // baseAnimationData = require(config.inputJsonDirectory + "animations/" + baseAnimId + ".a.json");
      baseAnimationData = ALoader.loadA(config, baseAnimFileId);
    } else {
      let baseAnimFileId = null;
      ifalnaEntry = IFALNA_DB[hrcFileId.toUpperCase()];
      if (ifalnaEntry && ifalnaEntry["Anims"] && ifalnaEntry["Anims"].length > 0) {
        baseAnimFileId = ifalnaEntry["Anims"][0];
        //console.log("Ifalna entry found, using Anims[0]=" + baseAnimFileId + " for base.");
      } else {
        baseAnimFileId = DEFAULT_BASE_ANIM_ID_MAP["" + skeleton.bones.length];
        console.log("Ifalna entry NOT found, using default=" + baseAnimFileId + " for base.");
      }
      if (baseAnimFileId) {
        // baseAnimationData = require(config.inputJsonDirectory + "animations/" + baseAnimId + ".a.json");
        baseAnimationData = ALoader.loadA(config, baseAnimFileId);
      } else {
        console.log("Warning: Not using base animation; model may look funny without bone rotations.");
        let defaultBoneRotations = [];
        for (let i=0; i<numBones; i++) {
          defaultBoneRotations.push({ x: 0, y: 0, z: 0 });
        }
        baseAnimationData = {
          numFrames: 1,
          numBones: numBones,
          rotationOrder1: 1,
          rotationOrder2: 0,
          rotationOrder3: 2,
          animationFrames: [{
            rootTranslation: { x: 0, y: 0, z: 0 },
            rootRotation: { x: 0, y: 0, z: 0 },
            boneRotations: defaultBoneRotations
          }]
        };
      }
    }

    var rotationOrder = "YXZ"; // TODO: use animation data rotationOrder instead

    if (baseAnimFileId) {
      if (baseAnimationData.numBones != skeleton.bones.length) {
        throw new Error("number of bones do not match between hrcId=" + hrcId + " and baseAnimId=" + baseAnimId);
      }
    }
    if (animFileId) {
      if (animationData.numBones != skeleton.bones.length) {
        throw new Error("number of bones do not match between hrcId=" + hrcId + " and animId=" + animId);
      }
    }

    firstFrame = baseAnimationData.animationFrames[0];

    let gltfFilename = hrcId + ".hrc.gltf";
    let binFilename = hrcId + ".hrc.bin";

    let gltf = {};
    gltf.asset = {
      "version": "2.0",
      "generator": "ff7-gltf",
    };
    gltf.accessors = [];
    gltf.buffers = [];
    gltf.bufferViews = [];
    gltf.images = [];
    gltf.materials = [];
    gltf.meshes = [];
    gltf.nodes = [];
    gltf.samplers = [];
    gltf.scene = 0;
    gltf.scenes = [];
    gltf.textures = [];

    gltf.samplers.push({
      "magFilter": FILTER.LINEAR,
      "minFilter": FILTER.NEAREST_MIPMAP_LINEAR,
      "wrapS": WRAPPING_MODE.REPEAT,
      "wrapT": WRAPPING_MODE.REPEAT
    });

    gltf.scenes.push({ "nodes": [0] });
    let quat = rotationToQuaternion(0, 0, 0, rotationOrder);
    gltf.nodes.push({
        "name": "RootContainer",
        "children": [ 1 ],
        "translation": [ 0, 0, 0 ],
        "rotation": [ quat.x, quat.y, quat.z, quat.z ],
        "scale": [ 1, 1, 1 ],
        // no mesh
    });

    quat = rotationToQuaternion(
      toRadians(firstFrame.rootRotation.x + ROOT_X_ROTATION_DEGREES),
      toRadians(firstFrame.rootRotation.y),
      toRadians(firstFrame.rootRotation.z),
      rotationOrder
    );

    gltf.nodes.push({
        "name": hrcId + "BoneRoot",
        "children": [], // will populate below
        "translation": [ firstFrame.rootTranslation.x, firstFrame.rootTranslation.y, firstFrame.rootTranslation.z ],
        "rotation": [ quat.x, quat.y, quat.z, quat.w ],
        "scale": [ 1, 1, 1 ],
        // no mesh
    });

    // vertexColoredMaterial is used by polygonGroups that use vertex colors and not textures
    gltf.materials.push({
        "pbrMetallicRoughness": {
            "baseColorFactor": [1, 1, 1, 1],
            "metallicFactor": 0,
            "roughnessFactor": 0.5
        },
        "name": "vertexColoredMaterial"
    });

    // create map of bone name to bone metadata
    let boneMap = {};
    for (let bone of skeleton.bones) {
      boneMap[bone.name] = bone;
    }

    var allBuffers = []; // array of all individual Buffers, which will be combined at the end
    var numBuffersCreated = 0;

    var numMeshesCreated = 0;
    var gltfTextureIndexOffset = 0; // starting point for textures within a bone

    for (let bone of skeleton.bones) {
      let parentBone = boneMap[bone.parent];
      let meshIndex = undefined; // do not populate node.mesh if this bone does not have one
      if (bone.rsdBaseFilenames.length > 0) {
        // this bone has a mesh
        // TODO: support HRC files that have multiple meshes (rare, but bzhf.hrc is an example)
        // For now, we just use the first mesh only.
        let rsdFileId = bone.rsdBaseFilenames[0]; // aaaf.rsd = cloud's head, aaha.rsd = tifa's head
        let rsdId = rsdFileId.toLowerCase();
        // let boneMetadata = require(config.inputJsonDirectory + "bones/" + rsdId + ".rsd.json");
        let boneMetadata = RsdLoader.loadRsd(config, rsdFileId);

        let pFileId = boneMetadata.polygonFilename; // aaba.p = cloud's head model
        let pId = pFileId.toLowerCase();
        // let model = require(config.inputJsonDirectory + "models/" + pId + ".p.json");
        let model = PLoader.loadP(config, pFileId);

        let mesh = {
            "primitives": [],      // will add 1 primitive per polygonGroup
            "name": pId + "Mesh"
        };
        gltf.meshes.push(mesh);
        numMeshesCreated++;
        meshIndex = numMeshesCreated-1;

        if (includeTextures) {
          let textureIds = boneMetadata.textureBaseFilenames;
          if (textureIds && textureIds.length > 0) {
            for (let i=0; i<textureIds.length; i++) {
              let textureId = textureIds[i].toLowerCase();
              gltf.images.push({"uri": config.texturesDirectory + '/' + textureId + ".png"});
              gltf.textures.push({
                "source": (gltfTextureIndexOffset + i), // index to gltf.images[]
                "sampler": 0,                           // index to gltf.samplers[]
                "name": textureId + "Texture"
              });
              // TODO: Figure out why materials look reddish
              gltf.materials.push({
                  "pbrMetallicRoughness": {
                      "baseColorFactor": [1, 1, 1, 1],
                      "baseColorTexture": {
                        "index": (gltfTextureIndexOffset + i) // index to gltf.textures[]
                      },
                      "metallicFactor": 0.0,
                      "roughnessFactor": 0.5
                  },
                  "doubleSided": true,
                  "alphaMode": "BLEND",
                  "name": textureId + "Material"
              });
            }
          }
        }

        let numGroups = model.polygonGroups.length;

        for (let g=0; g<numGroups; g++) {

          let polygonGroup = model.polygonGroups[g];
          let numPolysInGroup = polygonGroup.numPolysInGroup;
          let numVerticesInGroup = polygonGroup.numVerticesInGroup;
          let offsetPolyIndex = polygonGroup.offsetPolyIndex;
          let offsetVertexIndex = polygonGroup.offsetVertexIndex;
          let offsetTextureCoordinateIndex = polygonGroup.offsetTextureCoordinateIndex;

          // flatten the normal data so that each vertex index maps to 1 vertex normal as well
          let flattenedNormals = [];
          flattenedNormals.length = numVerticesInGroup;
          for (let i=0; i<numPolysInGroup; i++) {
            let polygon = model.polygons[offsetPolyIndex + i];
            normal3 = model.normals[polygon.normalIndex3];
            normal2 = model.normals[polygon.normalIndex2];
            normal1 = model.normals[polygon.normalIndex1];
            flattenedNormals[polygon.vertexIndex3] = normal3;
            flattenedNormals[polygon.vertexIndex2] = normal2;
            flattenedNormals[polygon.vertexIndex1] = normal1;
          }

          // 1. create "polygon vertex index" js Buffer + gltf bufferView + gltf accessor
          polygonVertexIndexBuffer = Buffer.alloc(numPolysInGroup * 3 * 2); // 3 vertexIndex per triangle, 2 bytes for vertexIndex(short)
          for (let i=0; i<numPolysInGroup; i++) {
            let polygon = model.polygons[offsetPolyIndex + i];
            polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex3, i*6);
            polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex2, i*6 + 2);
            polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex1, i*6 + 4);
          }
          allBuffers.push(polygonVertexIndexBuffer);
          numBuffersCreated++;
          let polygonVertexIndexAccessorIndex = numBuffersCreated-1;
          gltf.accessors.push({
              "bufferView": polygonVertexIndexAccessorIndex,
              "byteOffset": 0,
              "type": "SCALAR",
              "componentType": COMPONENT_TYPE.UNSIGNED_SHORT,
              "count": numPolysInGroup * 3,
          });
          gltf.bufferViews.push({
              "buffer": 0,
              "byteLength": polygonVertexIndexBuffer.length,
              "byteStride": 2, // 2 bytes per polygonVertexIndex
              "target": ELEMENT_ARRAY_BUFFER
            });

          // 2. create "vertex" js Buffer + gltf bufferView + gltf accessor
          vertexBuffer = Buffer.alloc(numVerticesInGroup * 3 * 4); // 3 floats per vertex, 4 bytes per float
          for (let i=0; i<numVerticesInGroup; i++) {
            let vertex = model.vertices[offsetVertexIndex + i];
            vertexBuffer.writeFloatLE(vertex.x, i*12);
            vertexBuffer.writeFloatLE(vertex.y, i*12 + 4);
            vertexBuffer.writeFloatLE(vertex.z, i*12 + 8);
          }
          allBuffers.push(vertexBuffer);
          numBuffersCreated++;
          let vertexAccessorIndex = numBuffersCreated-1;
          gltf.accessors.push({
              "bufferView": vertexAccessorIndex,
              "byteOffset": 0,
              "type": "VEC3",
              "componentType": COMPONENT_TYPE.FLOAT,
              "count": numVerticesInGroup,
          });
          gltf.bufferViews.push(
            {
              "buffer": 0,
              "byteLength": vertexBuffer.length,
              "byteStride": 12, // 12 bytes per vertex
              "target": ARRAY_BUFFER
            });

          // 3. create "normal" js Buffer + gltf bufferView + gltf accessor
          let numNormals = flattenedNormals.length;
          normalBuffer = Buffer.alloc(numNormals * 3 * 4); // 3 floats per normal, 4 bytes per float
          for (let i=0; i<numNormals; i++) {
            let normal = flattenedNormals[i];
            normalBuffer.writeFloatLE(normal.x, i*12);
            normalBuffer.writeFloatLE(normal.y, i*12 + 4);
            normalBuffer.writeFloatLE(normal.z, i*12 + 8);
          }
          allBuffers.push(normalBuffer);
          numBuffersCreated++;
          let normalAccessorIndex = numBuffersCreated-1;
          gltf.accessors.push({
              "bufferView": normalAccessorIndex,
              "byteOffset": 0,
              "type": "VEC3",
              "componentType": COMPONENT_TYPE.FLOAT,
              "count": numNormals,
          });
          gltf.bufferViews.push({
              "buffer": 0,
              "byteLength": normalBuffer.length,
              "byteStride": 12, // 12 bytes per normal
              "target": ARRAY_BUFFER
            });

          // 4. create "vertex color" js Buffer + gltf bufferView + gltf accessor
          let numVertexColors = numVerticesInGroup;
          vertexColorBuffer = Buffer.alloc(numVertexColors * 4 * 4); // 4 floats per vertex, 4 bytes per float
          for (let i=0; i<numVertexColors; i++) {
            let vertexColor = model.vertexColors[i];
            vertexColorBuffer.writeFloatLE(vertexColor.r/255.0, i*16);
            vertexColorBuffer.writeFloatLE(vertexColor.g/255.0, i*16 + 4);
            vertexColorBuffer.writeFloatLE(vertexColor.b/255.0, i*16 + 8);
            vertexColorBuffer.writeFloatLE(vertexColor.a/255.0, i*16 + 12);
          }
          allBuffers.push(vertexColorBuffer);
          numBuffersCreated++;
          let vertexColorAccessorIndex = numBuffersCreated-1;
          gltf.accessors.push({
              "bufferView": vertexColorAccessorIndex,
              "byteOffset": 0,
              "type": "VEC4",
              "componentType": COMPONENT_TYPE.FLOAT,
              "count": numVertexColors,
          });
          gltf.bufferViews.push({
            "buffer": 0,
            "byteLength": vertexColorBuffer.length,
            "byteStride": 16, // 16 bytes per vertexColor
            "target": ARRAY_BUFFER
          });

          // 5. create "texture coord" js Buffer + gltf bufferView + gltf accessor
          var materialIndex = 0; // will change to texture-based material index below if needed
          var textureCoordAccessorIndex = 0; // will be populated in the loop below
          if (includeTextures) {
            if (polygonGroup.isTextureUsed) {
              let numTextureCoords = numVerticesInGroup;
              textureCoordBuffer = Buffer.alloc(numTextureCoords * 2 * 4); // 2 floats per texture coord, 4 bytes per float
              for (let i=0; i<numTextureCoords; i++) {
                let textureCoord = model.textureCoordinates[offsetTextureCoordinateIndex + i];
                let u = textureCoord.x;
                let v = textureCoord.y;
                if (u >= 0.999) {
                  u = u - Math.floor(u);
                }
                if (v >= 0.999) {
                  v = v - Math.floor(v);
                }
                textureCoordBuffer.writeFloatLE(u, i*8);
                textureCoordBuffer.writeFloatLE(v, i*8 + 4);
              }
              allBuffers.push(textureCoordBuffer);
              numBuffersCreated++;
              textureCoordAccessorIndex = numBuffersCreated-1;
              gltf.accessors.push({
                  "bufferView": textureCoordAccessorIndex,
                  "byteOffset": 0,
                  "type": "VEC2",
                  "componentType": COMPONENT_TYPE.FLOAT,
                  "count": numTextureCoords
              });
              gltf.bufferViews.push({
                "buffer": 0,
                "byteLength": textureCoordBuffer.length,
                "byteStride": 8, // 8 bytes per textureCoord
                "target": ARRAY_BUFFER
              });
              let textureIndex = gltfTextureIndexOffset + polygonGroup.textureIndex;
              // material[0] = non-textured, material[1] = textured[0], material[2] = textured[1], ...
              materialIndex = textureIndex + 1;
            }
          }

          // finally, add the mesh primitive for this polygonGroup
          let primitive = {
              "attributes": {
                "POSITION": vertexAccessorIndex,
                "NORMAL": normalAccessorIndex,
                "COLOR_0": vertexColorAccessorIndex,
                // "TEXCOORD_0" will be set later below if appropriate
              },
              "indices": polygonVertexIndexAccessorIndex,
              "mode": 4, // triangles
              "material": materialIndex
          };
          if (includeTextures) {
            primitive.attributes["TEXCOORD_0"] = polygonGroup.isTextureUsed ? textureCoordAccessorIndex : undefined;
          }
          mesh.primitives.push(primitive);

        } // end looping through polygonGroups for this bone

      } // end if bone.rsdBaseFilename (if bone has a mesh)

      let boneTranslation = [ 0, 0, 0 ];
      if (bone.parent != "root") {
        boneTranslation = [ 0, 0, -parentBone.length ]; // translate in negZ direction (away from parent)
      }
      let boneRotation = firstFrame.boneRotations[bone.boneIndex];
      // models with "zero" bones won't have any bone rotations, but they are effectively a single bone with no rotation
      if (!boneRotation) {
        boneRotation = {x:0, y:0, z:0};
      }
      let quat = rotationToQuaternion(
        toRadians(boneRotation.x),
        toRadians(boneRotation.y),
        toRadians(boneRotation.z),
        rotationOrder
      );
      // 1 node per bone
      gltf.nodes.push({
          "name": hrcId + "Bone" + bone.boneIndex + "_" + bone.name,
          "children": [], // populate later, after all nodes have been created
          "translation": boneTranslation,
          "rotation": [quat.x, quat.y, quat.z, quat.w],
          "scale": [ 1, 1, 1 ],
          "mesh": meshIndex
      });

    } // end looping through skeleton.bones

    // build the "skeleton tree" by setting each node's children array, as required by glTF spec
    for (let bone of skeleton.bones) {
      let nodeIndex = bone.boneIndex + 2; // node0=RootContainer, node1=BoneRoot, node2=Bone0, node3=Bone1, etc.
      if (bone.parent == "root") {
        let parentNode = gltf.nodes[1];
        parentNode.children.push(nodeIndex);
      } else {
        let parentBone = boneMap[bone.parent];
        let parentNode = gltf.nodes[parentBone.boneIndex + 2];
        parentNode.children.push(nodeIndex);
      }
    }

    // animations

    if (animFileId) {

      gltf.animations = [];
      gltf.animations.push({
        "name": animId + "_animation",
        "channels": [],
        "samplers": []
      });
      let animationIndex = gltf.animations.length - 1;

      let numFrames = animationData.numFrames;

      // create buffer to store start-time/end-time pair(s)
      let numTimeMarkers = 2 * numFrames; // start time and end time per frame
      let startAndEndTimeBuffer = Buffer.alloc(numFrames * 2 * 4); // 2 time markers per frame, 4 bytes per float time
      for (let f=0; f<numFrames; f++) {
        let startTime = f / FRAMES_PER_SECOND;
        let endTime = (f+1) / FRAMES_PER_SECOND;
        startAndEndTimeBuffer.writeFloatLE(startTime, f*8);
        startAndEndTimeBuffer.writeFloatLE(endTime, f*8 + 4);
      }
      allBuffers.push(startAndEndTimeBuffer);
      numBuffersCreated++;
      let startAndEndTimeAccessorIndex = numBuffersCreated-1; // will assign to sampler.input
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

      for (let boneIndex=0; boneIndex<animationData.numBones; boneIndex++) {
        // create buffer for animation frame data for this bone
        let boneFrameDataBuffer = Buffer.alloc(numFrames * 2 * 4 * 4); // 2 rotations per frame (start and end), 4 floats per rotation, 4 bytes per float
        for (let f=0; f<numFrames; f++) {
          let frameData = animationData.animationFrames[f];
          let boneRotation = frameData.boneRotations[boneIndex];
          let quat = rotationToQuaternion(
            toRadians(boneRotation.x),
            toRadians(boneRotation.y),
            toRadians(boneRotation.z),
            rotationOrder
          );
          // write rotation value for "start of frame"
          boneFrameDataBuffer.writeFloatLE(quat.x, f*32 + 0);
          boneFrameDataBuffer.writeFloatLE(quat.y, f*32 + 4);
          boneFrameDataBuffer.writeFloatLE(quat.z, f*32 + 8);
          boneFrameDataBuffer.writeFloatLE(quat.w, f*32 + 12);
          // write rotation value for "end of frame" (TODO: use "f+1" rotation for smoother animations)
          boneFrameDataBuffer.writeFloatLE(quat.x, f*32 + 16);
          boneFrameDataBuffer.writeFloatLE(quat.y, f*32 + 20);
          boneFrameDataBuffer.writeFloatLE(quat.z, f*32 + 24);
          boneFrameDataBuffer.writeFloatLE(quat.w, f*32 + 28);
        }
        allBuffers.push(boneFrameDataBuffer);
        numBuffersCreated++;
        let boneFrameDataAccessorIndex = numBuffersCreated-1; // will assign to sampler.output
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
        let samplerIndex = gltf.animations[0].samplers.length - 1;
        gltf.animations[animationIndex].channels.push({
          "sampler": samplerIndex,
          "target": {
            "node": nodeIndex,
            "path": "rotation"
          }
        });
      }

    }

    // note: some skeletons have zero bones
    if (gltf.bufferViews.length > 0) {

      // We wait until now to set the byteOffset for all buffer views, because that's
      // the easiest way to do it, given the dynamic nature of which buffers we use.
      let numBufferViews = gltf.bufferViews.length;
      gltf.bufferViews[0].byteOffset = 0;
      for (let i=1; i<numBufferViews; i++) {
        gltf.bufferViews[i].byteOffset = gltf.bufferViews[i-1].byteOffset + gltf.bufferViews[i-1].byteLength;
      }

      // TODO: set min and max for all accessors to help engines optimize

      // we can finally add the buffer (containing all buffer views) to gltf because we know the total size
      let lastBufferView = gltf.bufferViews[numBufferViews-1];
      let totalLength = lastBufferView.byteOffset + lastBufferView.byteLength;
      let combinedBuffer = Buffer.concat(allBuffers, totalLength);
      gltf.buffers.push({
        "byteLength": totalLength,
        "uri": binFilename
      });

      // create *.bin file
      let binFilenameFull = config.outputGltfDirectory + "/" + binFilename;
      fs.writeFileSync(binFilenameFull, combinedBuffer);
      console.log("Wrote: " + binFilenameFull);
    }

    // create *.gltf file
    let gltfFilenameFull = config.outputGltfDirectory + "/" + gltfFilename;
    fs.writeFileSync(gltfFilenameFull, JSON.stringify(gltf, null, 2));
    console.log("Wrote: " + gltfFilenameFull);

  }; // end function translate_ff7_field_hrc_to_gltf

};
