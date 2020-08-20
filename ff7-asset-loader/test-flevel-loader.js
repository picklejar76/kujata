const fs = require("fs");
const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const FLevelLoader = require("./flevel-loader.js");

let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'));

// Pre-requisite: Must run test-map-list-loader.json first to generate maplist.json
// TODO: Make flevel-loader smarter so that it can do this automatically.

let mapList = JSON.parse(fs.readFileSync(config.outputFieldFLevelDirectory + '/maplist.json', 'utf-8'));
let lzsDecompressor = new LzsDecompressor();
let flevelLoader = new FLevelLoader(lzsDecompressor, mapList);

var replacer = function (k, v) {
  ////if (k == "entitySections") { return undefined; }
  return v;
};

// translate just 1 map
// for (let fieldName of mapList) {
//   if (fieldName && !fieldName.startsWith("wm")) {
//   }
// }
const decodeOneMap = (fieldName) => {
  let flevel = flevelLoader.loadFLevel(config, fieldName);
  let outputFilename = config.outputFieldFLevelDirectory + '/' + fieldName + '.json';
  fs.writeFileSync(outputFilename, JSON.stringify(flevel, replacer, 2));
  console.log("Wrote: " + outputFilename);
}

const decodeAllMaps = (maps) => {
  let errors = []
  for (let i = 0; i < maps.length; i++) {
    const fieldName = maps[i]

    const inputFile = config.inputFieldFLevelDirectory + '/' + fieldName
    const exists = fs.existsSync(inputFile)
    console.log(`Map ${i + 1} of ${maps.length} -> ${fieldName}`, exists)
    if (exists && fieldName !== '') {
      try {
        decodeOneMap(fieldName)
      } catch (error) {
        console.log('error', error)
        errors.push(fieldName)
      }

    }
  }
  return errors
}

const problemMaps = ['blin67_4',
  'nivgate2',
  'nivgate3',
  'nivl_e3',
  'fr_e',
  'junair',
  'gldst',
  'gldinfo',
  'cosmo',
  'cosmo2',
  'rckt3',
  'kuro_11',
  'hyoumap',
  'gaiin_6',
  'gaiin_7',
  'trnad_52',
  'md_e1',
  'lastmap',
  'junone22',
  'rckt32',
  'jtemplc']

// console.log('Decode all Maps -> All', decodeAllMaps(mapList))
// console.log('Decode all Maps -> Errors All', decodeAllMaps(problemMaps))
// console.log('Decode one', decodeOneMap('md1_2'))
// console.log('Decode one', decodeOneMap('nmkin_1'))
console.log('Decode one', decodeOneMap('anfrst_1'))
// console.log('Decode one', decodeOneMap('eleout'))
// console.log('Decode one', decodeOneMap('rckt3'))
// console.log('Decode one', decodeOneMap('nrthmk'))
// console.log('Decode one', decodeOneMap('ancnt3'))


// decodeOneMap('uutai1') // md1stin, md1_1, md1_2, nrthmk, junon, uutai1

// translate all maps and create index
// let opCodeUsages = {};
// let fieldModelMetadata = {};
// let fieldAnimationMetadata = {};
// var getMetadata = function(container, key1) {
//   let meta = container[key1];
//   if (!meta) {
//     meta = {
//       fieldStats: {},
//       animationStats: {
//         stand: {},
//         walk: {},
//         run: {},
//         other: {}
//       }
//     };
//     container[key1] = meta;
//   }
//   return meta;
// };
// var getFieldModelMetadata = function(hrcId) {
//   return getMetadata(fieldModelMetadata, hrcId);
// }
// var getFieldAnimationMetadata = function(animId) {
//   return getMetadata(fieldAnimationMetadata, animId);
// }
// var incrementStat = function(statsContainer, statName) {
//   let count = statsContainer[statName] || 0;
//   statsContainer[statName] = count + 1;
// };

// for (let fieldName of mapList) {
//   if (fieldName && !fieldName.startsWith("wm")) {
//     try {
//       let flevel = flevelLoader.loadFLevel(config, fieldName);
//       let outputFilename = config.outputFieldFLevelDirectory + '/' + fieldName + '.json';
//       fs.writeFileSync(outputFilename, JSON.stringify(flevel, replacer, 2));
//       console.log("Wrote: " + fieldName + '.json');
//       for (let entity of flevel.script.entities) {
//         for (let script of entity.scripts) {
//           for (let i=0; i<script.ops.length; i++) {
//             let op = script.ops[i];
//             if (op && op.raw) {
//               let opHex = op.raw.substring(0, 2);
//               let usage = {
//                 fieldName: fieldName,
//                 entityName: entity.entityName,
//                 scriptIndex: script.index,
//                 opIndex: i
//               };
//               for (let opProperty of Object.keys(op)) {
//                 usage[opProperty] = op[opProperty];
//               }
//               if (!opCodeUsages[opHex]) {
//                 opCodeUsages[opHex] = [];
//               }
//               opCodeUsages[opHex].push(usage);
//             }
//           }
//         }
//       }
//       for (let loader of flevel.model.modelLoaders) {
//         let hrcId = loader.hrcId.substring(0, 4).toLowerCase();
//         let meta1 = getFieldModelMetadata(hrcId);
//         incrementStat(meta1, "numFieldModelLoaders");
//         incrementStat(meta1.fieldStats, fieldName);
//         for (let a=0; a<loader.animations.length; a++) {
//           let animId = loader.animations[a].substring(0, 4).toLowerCase();
//           let meta2 = getFieldAnimationMetadata(animId);
//           if      (a==0) { incrementStat(meta1.animationStats.stand, animId); incrementStat(meta2.animationStats.stand, hrcId); }
//           else if (a==1) { incrementStat(meta1.animationStats.walk,  animId); incrementStat(meta2.animationStats.walk,  hrcId); }
//           else if (a==2) { incrementStat(meta1.animationStats.run,   animId); incrementStat(meta2.animationStats.run,   hrcId); }
//           else           { incrementStat(meta1.animationStats.other, animId); incrementStat(meta2.animationStats.other, hrcId); }
//           incrementStat(meta2, "numFieldModelLoaders");
//           incrementStat(meta2.fieldStats, fieldName);
//         }
//       }
//     } catch(e) {
//       let errorMessage = "" + e;
//       if (errorMessage.includes("no such file or directory")) {
//         console.log("Warning: " + errorMessage);
//       } else {
//         console.error("Error while loading: " + fieldName, e);
//         process.exit();
//       }
//     }
//   }
// }
// for (let opHex of Object.keys(opCodeUsages)) {
//   let usages = opCodeUsages[opHex];
//   let filename = config.metadataDirectory + '/op-code-usages/' + opHex + '.json';
//   ////fs.writeFileSync(filename, JSON.stringify(usages, null, 2));
//   ////console.log("Wrote: " + filename);
// }
// fs.writeFileSync(config.metadataDirectory + '/field-model-metadata.json', JSON.stringify(fieldModelMetadata, null, 2));
// fs.writeFileSync(config.metadataDirectory + '/field-animation-metadata.json', JSON.stringify(fieldAnimationMetadata, null, 2));
