const fs = require("fs");
//const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const BattleModelLoader = require("./battle-model-loader.js");
const BattleAnimationLoader = require("./battle-animation-loader.js");

let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'));

let battleModelLoader = new BattleModelLoader();
let battleAnimationLoader = new BattleAnimationLoader();

let prefix = "rt"; // rtXX = Cloud
let modelFilename = prefix + "aa";         // rtaa = Cloud's model
let animPackFilename = prefix + "da"; // rtda = Cloud's animation pack
let battleModel = battleModelLoader.loadBattleModel(config, modelFilename, true);
{
  //console.log(JSON.stringify(battleModel, null, 2));
  let outputFilename = config.outputBattleBattleDirectory + '/' + modelFilename + '.json';
  fs.writeFileSync(outputFilename, JSON.stringify(battleModel, null, 2));
  console.log("Wrote: " + outputFilename);
}

let pack = battleAnimationLoader.loadBattleAnimationPack(config, animPackFilename, battleModel.numBones, battleModel.numBodyAnimations, battleModel.numWeaponAnimations);
for (let i=0; i<pack.bodyAnimations.length; i++) {
  let bodyAnimation = pack.bodyAnimations[i];
  {
    //console.log(JSON.stringify(bodyAnimation, null, 2));
    let outputFilename = config.outputBattleBattleDirectory + '/' + animPackFilename + '-body-' + i + '.json';
    fs.writeFileSync(outputFilename, JSON.stringify(bodyAnimation, null, 2));
    console.log("Wrote: " + outputFilename);
  }
}


// TODO: Move the following code to a separate unit test for the various bit-manipulating utility functions
// let i = 0b0000101010101010;
// let v = battleAnimationLoader.extendSignInteger(i, 12);
// console.log("i=" + i.toString(2).padStart(32, '0'));
// console.log("v=" + v.toString(2).padStart(32, '0'));

// let numBits = 16;
// let offsetBit = 7;
// let i0 = 0b11111111;
// let i1 = 0b00000000;
// let i2 = 0b11111111;
// let i3 = 0b00000000;
// let v = battleAnimationLoader.getBitBlockVUnsigned([i0, i1, i2, i3], numBits, offsetBit);
// console.log("numBits=" + numBits + ", offsetBit/FBit=" + offsetBit);
// console.log("i0=" + i0.toString(2).padStart(32, '0'));
// console.log("i1=" + i1.toString(2).padStart(32, '0'));
// console.log("i2=" + i2.toString(2).padStart(32, '0'));
// console.log("i3=" + i3.toString(2).padStart(32, '0'));
// console.log(" v=" +  v.toString(2).padStart(32, '0'));

// let i = 0x8000;
// let v = battleAnimationLoader.unsignedShortToSignedShort(i);
// console.log("i=" + i);
// console.log("v=" + v);

/*
let outputFilename = config.outputFieldFLevelDirectory + '/' + filename + '.json';
fs.writeFileSync(outputFilename, JSON.stringify(battleModel, null, 2));
console.log("Wrote: " + outputFilename);
*/
