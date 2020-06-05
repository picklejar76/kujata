const fs = require("fs");
const stringUtil = require("./string-util.js");
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js");
var PLoader = require("../ff7-asset-loader/p-loader.js");

module.exports = class BattleModelLoader {

  constructor() {
  }

  loadBattleLocationPiece(config, pieceFilename, boneIndex) {
    console.log("TODO: Read Battle Location Piece for: " + pieceFilename + " boneIndex=" + boneIndex);
    return {};
  }

  loadBattleBone(config, r, offset, boneIndex, pieceFilename, loadGeometry) {
    r.offset = offset;
    let boneParent = r.readInt();
    let boneLength = r.readFloat();
    let hasModel = r.readUInt();
    let bone = {
      boneIndex: boneIndex,
      name: "" + boneIndex,
      parent: (boneParent == -1 ? "root" : "" + boneParent),
      length: -boneLength, // lengths are negative for battle models, positive for field models
      isBattle: true,
      rsdBaseFilenames: [],           // applies to field models only
      polygonFilename: pieceFilename, // applies to battle models only
      hasModel: (hasModel == 0 ? false : true)
      // resizeX: 1,
      // resizeY: 1,
      // resizeZ: 1
    };
    if (bone.parent == -1) {
      bone.parent = "root";
    } else {
      bone.parent = "" + bone.parent;
    }
    if (bone.hasModel != 0) {
      bone.modelFilename = pieceFilename;
      //bone.numModels = 1;
    }
    return bone;
  }
  
  loadWeaponBone(config, r, offset, boneIndex, pieceFilename, loadGeometry) {
    //r.offset = offset;
    //let boneParent = r.readInt();
	//let boneParent = "root";
	let boneParent = -1;
	
    //let boneLength = r.readFloat();
	let boneLength = 1;
    //let hasModel = r.readUInt();
	let hasModel = 1;
    let bone = {
      boneIndex: boneIndex,
	  //boneIndex: 1,
      name: "WEAPON",
      parent: (boneParent == -1 ? "root" : "" + boneParent),
      length: -boneLength, // lengths are negative for battle models, positive for field models
      isBattle: true,
      rsdBaseFilenames: [],           // applies to field models only
      polygonFilename: pieceFilename, // applies to battle models only
      hasModel: (hasModel == 0 ? false : true)
      // resizeX: 1,
      // resizeY: 1,
      // resizeZ: 1
    };
    if (bone.parent == -1) {
      bone.parent = "root";
    } else {
      bone.parent = "" + bone.parent;
    }
    if (bone.hasModel != 0) {
      bone.modelFilename = pieceFilename;
      //bone.numModels = 1;
    }
    return bone;
  }

  // similar to Kimera's "ReadAASkeleton" subroutine in FF7AASkeleton.bas
  loadBattleModel(config, filename, loadGeometry) {

    var buffer = fs.readFileSync(config.inputBattleBattleDirectory + '/' + filename);

    var r = new FF7BinaryDataReader(buffer);

    let fileSizeBytes = buffer.length;
    r.offset = 0;

    let battleModel = {};
    var sectionOffset = 0;
    var sectionOffsetBase = 0;

    battleModel.unk = [r.readUInt(), r.readUInt(), r.readUInt()];
    battleModel.numBones = r.readUInt();
    battleModel.unk2 = [r.readUInt(), r.readUInt()];
    battleModel.numTextures = r.readUInt();
    battleModel.numBodyAnimations = r.readUInt();
    battleModel.unk3 = [r.readUInt(), r.readUInt()];
    battleModel.numWeaponAnimations = r.readUInt();
    battleModel.unk4 = [r.readUInt(), r.readUInt()];
    battleModel.bones = [];
	battleModel.weaponModels = [];
    battleModel.name = filename;
    let baseName = filename.substring(0, 2);
    let pSufix1 = 97; // 'a'
    let pSufix2 = null;
    let b = false;

    if (battleModel.numBones == 0) { // It's a battle location model
      battleModel.isBattleLocation = true;
      for (let pSufix2 = 109; pSufix2 <= 122; pSufix2++) { // 109='m', 122='z'
        let pieceFilename = config.inputBattleBattleDirectory + '/' + baseName + String.fromCharCode(pSufix1) + String.fromCharCode(pSufix2);
        let pieceFilenameAbsolute = config.inputBattleBattleDirectory + '/' + pieceFilename;
        if (fs.existsSync(pieceFilenameAbsolute)) {
          //ReDim Preserve .Bones(.NumBones)
          if (loadGeometry) {
            let boneIndex = battleModel.numBones;
            let bone = this.loadBattleLocationPiece(config, pieceFilenameAbsolute, boneIndex);
            battleModel.bones.push(bone);
          }
          battleModel.numBones++;
        }
      }
    } else { // It's a character battle model
      battleModel.isBattleLocation = false;
      pSufix2 = 109;
	  //console.log("TOTAL BONES = " + battleModel.numBones);
	  
      for (let bi=0; bi<battleModel.numBones; bi++) {
        let pieceFilename = baseName + String.fromCharCode(pSufix1) + String.fromCharCode(pSufix2);
        let pieceFilenameAbsolute = config.inputBattleBattleDirectory + '/' + pieceFilename;
        let bone = this.loadBattleBone(config, r, 52 + bi * 12, bi, pieceFilename, loadGeometry);
        battleModel.bones.push(bone);
        if (pSufix2 >= 122) {
          pSufix1 = pSufix1 + 1;
          pSufix2 = 97;
        } else {
          pSufix2++;
        }
		//console.log("Bone= " + bi);
		
        //console.log("DEBUG: bone " + bi + " = " + JSON.stringify(bone, null, 0));
      }	  

      battleModel.weaponModelFilenames = [];
      // weapon model filename suffixes are "ck, cl, cm, ..., cz"
      pSufix1 = 99; // 99='c'
      battleModel.numWeapons = 0;
      for (let pSufix2 = 107; pSufix2 <= 122; pSufix2++) { // 107='k' 122='z'
        let weaponFilename = baseName + String.fromCharCode(pSufix1) + String.fromCharCode(pSufix2);
        let weaponFilenameAbsolute = config.inputBattleBattleDirectory + '/' + weaponFilename;
        if (fs.existsSync(weaponFilenameAbsolute)) {
          if (loadGeometry) {			
            battleModel.weaponModelFilenames.push(weaponFilename);			
          }
          battleModel.numWeapons++;
        }		
      }	  
	  let weaponFilename = battleModel.weaponModelFilenames[0];
	  let weaponFilenameAbsolute = config.inputBattleBattleDirectory + '/' + weaponFilename;
      if (fs.existsSync(weaponFilenameAbsolute)) {
		let bi = battleModel.numBones;
		let weaponBone = this.loadWeaponBone(config, r, 52 + bi * 12, bi, weaponFilename, loadGeometry);
		battleModel.bones.push(weaponBone);
		battleModel.hasWeapon = true;		
	  }
	  else
	  {
		  battleModel.hasWeapon = false;
	  }
    }

    // Texture file suffixes are ac, ad, ..., aj
    battleModel.textureFilenames = [];
    pSufix1 = 97;

    if (loadGeometry) {
      // ReDim .TexIDS(.NumTextures)
      // ReDim .textures(.NumTextures)
      let ti = 0;
      let pSuffix2End = 99 + battleModel.numTextures - 1;
      //for (let pSufix2 = 99; pSufix2 <= pSuffix2End; pSufix2++) {
      for (let ti=0; ti<battleModel.numTextures; ti++) {
        let pSufix2 = 99 + ti;
        let texFileName = baseName + String.fromCharCode(pSufix1) + String.fromCharCode(pSufix2);
        let texFileNameAbsolute = config.inputBattleBattleDirectory + '/' + texFileName;
        battleModel.textureFilenames.push(texFileName);
		console.log("TEXTURES ARE "+texFileName);
      }
    }

    return battleModel;

  }; // end loadBattleModel() function

}; // end module.exports = class BattleModelLoader {
