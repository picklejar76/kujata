// usage: require("./ff7-to-gltf.js")();

require("./gltf-2.0-util.js")();
require("./ff7-gltf-common.js")();
var HrcLoader = require("../ff7-asset-loader/hrc-loader.js");
var RsdLoader = require("../ff7-asset-loader/rsd-loader.js");
var PLoader = require("../ff7-asset-loader/p-loader.js");
var ALoader = require("../ff7-asset-loader/a-loader.js");
const BattleModelLoader = require("../ff7-asset-loader/battle-model-loader.js");
const BattleAnimationLoader = require("../ff7-asset-loader/battle-animation-loader.js");

const fs = require("fs");
const mkdirp = require('mkdirp');

module.exports = class FF7GltfTranslator {

  constructor() {
  }

  // Translate a FF7 FIELD.LGP's *.HRC file to glTF 2.0 format
  // config = configuration object, see config.json for example
  // hrcFileId = which skeleton to translate, e.g. "AAAA" for AAAA.HRC (Cloud)
  // baseAnimFileId = which animation to use for base structure, e.g. "AAFE" for AAFE.A (Cloud standing)
  //   null            = use field-model-standing-animations.json to decide
  // animFileIds = which animation(s) to include in the output gltf
  //   null            = don't include any animations
  //   []              = include all animations from ifalna.json
  //   ["AAFE, "AAGA"] = include only specific animations
  // includeTextures = whether to include textures in the translation (set to false to disable)

  translate_ff7_field_hrc_to_gltf(config, hrcFileId, baseAnimFileId, animFileIds, includeTextures, isBattleModel) {

    var ifalnaDatabase = JSON.parse(fs.readFileSync(config.ifalnaJsonFile, 'utf-8'));
    var standingAnimations = JSON.parse(fs.readFileSync(config.metadataDirectory + '/field-model-standing-animations.json', 'utf-8'));
    var outputDirectory = isBattleModel ? config.outputBattleBattleDirectory : config.outputFieldCharDirectory;

    if (!fs.existsSync(outputDirectory)) {
      console.log("Creating output directory: " + outputDirectory);
      mkdirp.sync(outputDirectory);
    }

    var modelType = isBattleModel ? "battle" : "field";
    var FRAMES_PER_SECOND = config.framesPerSecond[modelType];
    var REVERSE_VERTEX_ORDER = config.reverseVertexOrder[modelType];
    var BONE_POSITION_SCALE_X = config.bonePositionScaleX[modelType];
    var BONE_POSITION_SCALE_Y = config.bonePositionScaleY[modelType];
    var BONE_POSITION_SCALE_Z = config.bonePositionScaleZ[modelType];
    var BONE_ROTATION_SCALE_X = config.boneRotationScaleX[modelType];
    var BONE_ROTATION_SCALE_Y = config.boneRotationScaleY[modelType];
    var BONE_ROTATION_SCALE_Z = config.boneRotationScaleZ[modelType];
    var BONE_ROTATION_DEGREES_X = config.boneRotationDegreesX[modelType];
    var BONE_ROTATION_DEGREES_Y = config.boneRotationDegreesY[modelType];
    var BONE_ROTATION_DEGREES_Z = config.boneRotationDegreesZ[modelType];
    var ROOT_ROTATION_DEGREES_X = config.rootRotationDegreesX[modelType];
    var ROOT_ROTATION_DEGREES_Y = config.rootRotationDegreesY[modelType];
    var ROOT_ROTATION_DEGREES_Z = config.rootRotationDegreesZ[modelType];
    var CONTAINER_ROTATION_DEGREES_X = config.containerRotationDegreesX[modelType];
    var CONTAINER_ROTATION_DEGREES_Y = config.containerRotationDegreesY[modelType];
    var CONTAINER_ROTATION_DEGREES_Z = config.containerRotationDegreesZ[modelType];

    let hrcId = hrcFileId.toLowerCase();
    let skeleton = {};

    if (isBattleModel) {
      let battleModelLoader = new BattleModelLoader();
      skeleton = battleModelLoader.loadBattleModel(config, hrcId, true);
    } else {
      skeleton = HrcLoader.loadHrc(config, hrcFileId);
    }

    console.log("Translating: " + skeleton.name);
    let numBones = skeleton.bones.length;

    // create list of animation files to translate (field only)
    if (isBattleModel) {

    } else {
      if (animFileIds == null) {
        console.log("Will not translate any field animations.");
        animFileIds = [];
      } else {
        if (animFileIds.length == 0) {
          console.log("Will translate all field animations from Ifalna database.");
          let ifalnaEntry = ifalnaDatabase[hrcFileId.toUpperCase()];
          if (ifalnaEntry) {
            if (ifalnaEntry["Anims"])  { animFileIds = animFileIds.concat(ifalnaEntry["Anims"]);  }
            if (ifalnaEntry["Anims2"]) { animFileIds = animFileIds.concat(ifalnaEntry["Anims2"]); }
            if (ifalnaEntry["Anims3"]) { animFileIds = animFileIds.concat(ifalnaEntry["Anims3"]); }
          }
        }
      }
    }

    var animationDataList = [];
    var battleAnimationPack = null;
    if (isBattleModel) {
      let battleAnimationFilename = hrcId.substring(0, 2) + "da";
      console.log("Will translate and include animations from pack: " + battleAnimationFilename);
      let battleAnimationLoader = new BattleAnimationLoader();
      let battleModel = skeleton;
      battleAnimationPack = battleAnimationLoader.loadBattleAnimationPack(config, battleAnimationFilename, battleModel.numBones, battleModel.numBodyAnimations, battleModel.numWeaponAnimations);
      animationDataList = battleAnimationPack.bodyAnimations;
      baseAnimationData = battleAnimationPack.bodyAnimations[0];
    } else {
      console.log("Will translate the following field animFileIds: ", JSON.stringify(animFileIds, null, 0));
      for (let animFileId of animFileIds) {
        let animationData = ALoader.loadA(config, animFileId);
        animationDataList.push(animationData);
      }
    }

    var baseAnimationData = null;
    if (isBattleModel) {
      baseAnimationData = battleAnimationPack.bodyAnimations[0];
    } else {
      if (baseAnimFileId) {
        baseAnimationData = ALoader.loadA(config, baseAnimFileId);
      } else {
        let baseAnimFileId = standingAnimations[hrcFileId.toLowerCase()];
        if (baseAnimFileId && !isBattleModel) {
          baseAnimationData = ALoader.loadA(config, baseAnimFileId);
        } else {
          console.log("Warning: Not using base animation; model may look funny without bone rotations.");
          let defaultBoneRotations = [];
          for (let i=0; i<numBones; i++) {
            defaultBoneRotations.push({ x: 30 * Math.PI/180, y: 30 * Math.PI/180, z: 30 * Math.PI/180 });
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
    }

    var rotationOrder = null; // TODO: use animation data rotationOrder instead
    if (isBattleModel) {
      // TODO: determine if original data specifies rotation order
      // if so, determine whether the ff7 game actually uses the rotation order specified in the battle model/anim file
      // if so, use it here
      rotationOrder = "YXZ";
    } else {
      // TODO: determine whether the ff7 game actually uses the rotation order specified in the field model/anim file
      // if so, use it here
      rotationOrder = "YXZ"; // TODO: use animation data rotationOrder instead
    }

    if (baseAnimFileId) {
      if (baseAnimationData.numBones != skeleton.bones.length) {
        throw new Error("number of bones do not match between hrcId=" + hrcId + " and baseAnimId=" + baseAnimId);
      }
    }
    //for (let animationData of animationDataList) {
    for (let i=0; i<animationDataList.length; i++) {
      let animationData = animationDataList[i];
      if (!animationData.numBones) {
        //console.log("WARN: animation #" + i + " is blank.");
      } else if (animationData.numBones != skeleton.bones.length) {
        throw new Error("number of bones do not match between hrcId=" + hrcId + " and animationData=" + animationData);
      }
    }

    let firstFrame = baseAnimationData.animationFrames[0];

    let gltfFilename = hrcId + ".hrc.gltf";
    let binFilename = hrcId + ".hrc.bin";

    let gltf = {};
    gltf.asset = {
      "version": "2.0",
      "generator": "kujata",
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
    let quat = rotationToQuaternion(
      (0 + CONTAINER_ROTATION_DEGREES_X + BONE_ROTATION_DEGREES_X) * BONE_ROTATION_SCALE_X,
      (0 + CONTAINER_ROTATION_DEGREES_Y + BONE_ROTATION_DEGREES_Y) * BONE_ROTATION_SCALE_Y,
      (0 + CONTAINER_ROTATION_DEGREES_Z + BONE_ROTATION_DEGREES_Z) * BONE_ROTATION_SCALE_Z,
      rotationOrder
    );
    gltf.nodes.push({
        "name": "RootContainer",
        "children": [ 1 ],
        "translation": [ 0, 0, 0 ],
        "rotation": [ quat.x, quat.y, quat.z, quat.z ],
        "scale": [ 1, 1, 1 ],
        // no mesh
    });

    quat = rotationToQuaternion(
      toRadians((firstFrame.rootRotation.x + ROOT_ROTATION_DEGREES_X + BONE_ROTATION_DEGREES_X) * BONE_ROTATION_SCALE_X),
      toRadians((firstFrame.rootRotation.y + ROOT_ROTATION_DEGREES_Y + BONE_ROTATION_DEGREES_Y) * BONE_ROTATION_SCALE_Y),
      toRadians((firstFrame.rootRotation.z + ROOT_ROTATION_DEGREES_Z + BONE_ROTATION_DEGREES_Z) * BONE_ROTATION_SCALE_Z),
      rotationOrder
    );

    gltf.nodes.push({
        "name": hrcId + "BoneRoot",
        "children": [], // will populate below
        "translation": [
          firstFrame.rootTranslation.x * BONE_POSITION_SCALE_X,
          firstFrame.rootTranslation.y * BONE_POSITION_SCALE_Y,
          firstFrame.rootTranslation.z * BONE_POSITION_SCALE_Z
        ],
        "rotation": [ quat.x, quat.y, quat.z, quat.w ],
        "scale": [ 1, 1, 1 ],
        // no mesh
    });

    // vertexColoredMaterial is used by polygonGroups that use vertex colors and not textures
    gltf.materials.push({
        "pbrMetallicRoughness": {
            "baseColorFactor": [1, 1, 1, 1],
            "metallicFactor": 0,
            "roughnessFactor": 1.0 // 0.5
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
      if (bone.rsdBaseFilenames.length > 0 || (isBattleModel && bone.hasModel != 0)) {
        // this bone has a mesh
        let boneMetadata = {};

        if (isBattleModel) {
          boneMetadata = {
            polygonFilename: bone.polygonFilename,
            textureBaseFilenames: [] // TODO: add support for battle textures
          }
        } else {
          // TODO: support HRC files that have multiple meshes (rare, but bzhf.hrc is an example)
          // For now, we just use the first mesh only.
          let rsdFileId = bone.rsdBaseFilenames[0]; // aaaf.rsd = cloud's head, aaha.rsd = tifa's head
          let rsdId = rsdFileId.toLowerCase();
          boneMetadata = RsdLoader.loadRsd(config, rsdFileId);
        }

        let pFileId = boneMetadata.polygonFilename; // aaba.p = cloud's head model
        let pId = pFileId.toLowerCase();
        // let model = require(config.inputJsonDirectory + "models/" + pId + ".p.json");
        let model = PLoader.loadP(config, pFileId, isBattleModel);

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
              gltf.images.push({"uri": config.texturesDirectory + '/' + textureId + ".tex.png"});
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
          if (model.numNormals > 0) { // Note: it appears that field models have vertex normals, but battle models don't
            flattenedNormals.length = numVerticesInGroup;
            for (let i=0; i<numPolysInGroup; i++) {
              let polygon = model.polygons[offsetPolyIndex + i];
              let normal3 = model.normals[polygon.normalIndex3];
              let normal2 = model.normals[polygon.normalIndex2];
              let normal1 = model.normals[polygon.normalIndex1];
              flattenedNormals[polygon.vertexIndex3] = normal3;
              flattenedNormals[polygon.vertexIndex2] = normal2;
              flattenedNormals[polygon.vertexIndex1] = normal1;
            }
          }

          // 1. create "polygon vertex index" js Buffer + gltf bufferView + gltf accessor
          let polygonVertexIndexBuffer = Buffer.alloc(numPolysInGroup * 3 * 2); // 3 vertexIndex per triangle, 2 bytes for vertexIndex(short)
          for (let i=0; i<numPolysInGroup; i++) {
            let polygon = model.polygons[offsetPolyIndex + i];
            if (REVERSE_VERTEX_ORDER) {
              polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex3, i*6);
              polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex2, i*6 + 2);
              polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex1, i*6 + 4);
            } else {
              polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex1, i*6);
              polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex2, i*6 + 2);
              polygonVertexIndexBuffer.writeUInt16LE(polygon.vertexIndex3, i*6 + 4);
            }
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
          let vertexBuffer = Buffer.alloc(numVerticesInGroup * 3 * 4); // 3 floats per vertex, 4 bytes per float
          for (let i=0; i<numVerticesInGroup; i++) {
            let vertex = model.vertices[offsetVertexIndex + i];
            vertexBuffer.writeFloatLE(vertex.x * BONE_POSITION_SCALE_X, i*12);
            vertexBuffer.writeFloatLE(vertex.y * BONE_POSITION_SCALE_Y, i*12 + 4);
            vertexBuffer.writeFloatLE(vertex.z * BONE_POSITION_SCALE_Z, i*12 + 8);
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
          var normalAccessorIndex = -1;
          if (model.numNormals > 0) {
            let numNormals = flattenedNormals.length;
            let normalBuffer = Buffer.alloc(numNormals * 3 * 4); // 3 floats per normal, 4 bytes per float
            for (let i=0; i<numNormals; i++) {
              let normal = flattenedNormals[i];
              normalBuffer.writeFloatLE(normal.x * BONE_POSITION_SCALE_X, i*12);
              normalBuffer.writeFloatLE(normal.y * BONE_POSITION_SCALE_Y, i*12 + 4);
              normalBuffer.writeFloatLE(normal.z * BONE_POSITION_SCALE_Z, i*12 + 8);
            }
            allBuffers.push(normalBuffer);
            numBuffersCreated++;
            normalAccessorIndex = numBuffersCreated-1;
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
          }

          // 4. create "vertex color" js Buffer + gltf bufferView + gltf accessor
          let numVertexColors = numVerticesInGroup;
          let vertexColorBuffer = Buffer.alloc(numVertexColors * 4 * 4); // 4 floats per vertex, 4 bytes per float
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
              let textureCoordBuffer = Buffer.alloc(numTextureCoords * 2 * 4); // 2 floats per texture coord, 4 bytes per float
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
                "NORMAL": (model.numNormals > 0 ? normalAccessorIndex : undefined),
                "COLOR_0": vertexColorAccessorIndex,
                "TEXCOORD_0": (includeTextures && polygonGroup.isTextureUsed ? textureCoordAccessorIndex : undefined)
              },
              "indices": polygonVertexIndexAccessorIndex,
              "mode": 4, // triangles
              "material": materialIndex
          };
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
        toRadians((boneRotation.x + BONE_ROTATION_DEGREES_X) * BONE_ROTATION_SCALE_X),
        toRadians((boneRotation.y + BONE_ROTATION_DEGREES_Y) * BONE_ROTATION_SCALE_Y),
        toRadians((boneRotation.z + BONE_ROTATION_DEGREES_Z) * BONE_ROTATION_SCALE_Z),
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
    gltf.animations = [];
    for (let i=0; i<animationDataList.length; i++) {
      let animationData = animationDataList[i];
      if (!animationData.numBones) {
        //console.log("WARN: Skipping empty animation");
        continue;
      }
      let animationName = "body-" + i;
      gltf.animations.push({
        "name": animationName,
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

      for (let boneIndex=-1; boneIndex<animationData.numBones; boneIndex++) {
        // create buffer for animation frame data for this bone
        let boneFrameDataBuffer = Buffer.alloc(numFrames * 2 * 4 * 4); // 2 rotations per frame (start and end), 4 floats per rotation, 4 bytes per float
        for (let f=0; f<numFrames; f++) {
          let frameData = animationData.animationFrames[f];
          let boneRotation = boneIndex == -1 ? frameData.rootRotation : frameData.boneRotations[boneIndex];
          let quat = rotationToQuaternion(
            toRadians((boneRotation.x + BONE_ROTATION_DEGREES_X + (boneIndex == -1 ? ROOT_ROTATION_DEGREES_X : 0.0)) * BONE_ROTATION_SCALE_X),
            toRadians((boneRotation.y + BONE_ROTATION_DEGREES_Y + (boneIndex == -1 ? ROOT_ROTATION_DEGREES_Y : 0.0)) * BONE_ROTATION_SCALE_Y),
            toRadians((boneRotation.z + BONE_ROTATION_DEGREES_Z + (boneIndex == -1 ? ROOT_ROTATION_DEGREES_Z : 0.0)) * BONE_ROTATION_SCALE_Z),
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
        let samplerIndex = gltf.animations[animationIndex].samplers.length - 1;
        gltf.animations[animationIndex].channels.push({
          "sampler": samplerIndex,
          "target": {
            "node": nodeIndex,
            "path": "rotation"
          }
        });
      }

      // now do the root bone translation
      let rootTranslationFrameDataBuffer = Buffer.alloc(numFrames * 2 * 3 * 4); // 2 rotations per frame (start and end), 3 floats per translation, 4 bytes per float
      for (let f=0; f<numFrames; f++) {
        let frameData = animationData.animationFrames[f];
        let rootTranslation = frameData.rootTranslation;
        // write translation value for "start of frame"
        rootTranslationFrameDataBuffer.writeFloatLE(rootTranslation.x * BONE_POSITION_SCALE_X, f*24 + 0);
        rootTranslationFrameDataBuffer.writeFloatLE(rootTranslation.y * BONE_POSITION_SCALE_Y, f*24 + 4);
        rootTranslationFrameDataBuffer.writeFloatLE(rootTranslation.z * BONE_POSITION_SCALE_Z, f*24 + 8);
        // write translation value for "end of frame" (TODO: use "f+1" translation for smoother animations)
        rootTranslationFrameDataBuffer.writeFloatLE(rootTranslation.x * BONE_POSITION_SCALE_X, f*24 + 12);
        rootTranslationFrameDataBuffer.writeFloatLE(rootTranslation.y * BONE_POSITION_SCALE_Y, f*24 + 16);
        rootTranslationFrameDataBuffer.writeFloatLE(rootTranslation.z * BONE_POSITION_SCALE_Z, f*24 + 20);
      }
      allBuffers.push(rootTranslationFrameDataBuffer);
      numBuffersCreated++;
      let rootTranslationFrameDataAccessorIndex = numBuffersCreated-1; // will assign to sampler.output
      gltf.accessors.push({
          "bufferView": rootTranslationFrameDataAccessorIndex,
          "byteOffset": 0,
          "type": "VEC3",
          "componentType": COMPONENT_TYPE.FLOAT,
          "count": numFrames * 2 // 2 translations per frame
      });
      gltf.bufferViews.push({
        "buffer": 0,
        "byteLength": rootTranslationFrameDataBuffer.length,
        "target": ARRAY_BUFFER
      });
      gltf.animations[animationIndex].samplers.push({
        "input": startAndEndTimeAccessorIndex,
        "interpolation": "LINEAR",
        "output": rootTranslationFrameDataAccessorIndex
      });
      let nodeIndex = 1; // node0=RootContainer, node1=BoneRoot, node2=Bone0, node3=Bone1, etc.
      let samplerIndex = gltf.animations[animationIndex].samplers.length - 1;
      gltf.animations[animationIndex].channels.push({
        "sampler": samplerIndex,
        "target": {
          "node": nodeIndex,
          "path": "translation"
        }
      });

    } // end looping through animationDataList

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
      let binFilenameFull = outputDirectory + "/" + binFilename;
      fs.writeFileSync(binFilenameFull, combinedBuffer);
      console.log("Wrote: " + binFilenameFull);
    }

    // create *.gltf file
    let gltfFilenameFull = outputDirectory + "/" + gltfFilename;
    fs.writeFileSync(gltfFilenameFull, JSON.stringify(gltf, null, 2));
    console.log("Wrote: " + gltfFilenameFull);

  }; // end function translate_ff7_field_hrc_to_gltf

};
