const fs = require("fs");
const FF7GltfTranslator = require("./ff7-gltf/ff7-to-gltf.js");
const FF7FieldAnimationTranslator = require("./ff7-gltf/ff7-field-animation-translator.js");

var config = JSON.parse(require("fs").readFileSync("config.json"));


// aaaa=cloud, aagb=tifa
function translateFieldModel(config, hrcFileId) {
  let gltfTranslator = new FF7GltfTranslator();
  gltfTranslator.translate_ff7_field_hrc_to_gltf(config, hrcFileId, null, null, true, false);
}

// every *.hrc file in char.lgp
function translateAllFieldModels(config) {
  let filenames = fs.readdirSync(config.inputFieldCharDirectory);
  for (let i=0; i<filenames.length; i++) {
    let filename = filenames[i];
    if (filename.toLowerCase().endsWith(".hrc")) {
      let hrcFileId = filename.slice(0, 4);
      try {
        let gltfTranslator = new FF7GltfTranslator();
        gltfTranslator.translate_ff7_field_hrc_to_gltf(config, hrcFileId, null, null, true, false);
      } catch (err) {
        console.log('Error while trying to translate: ' + filename + ':', err);
        //break; // uncomment this line to stop on failure
      }
    }
  }
}

// rt=Cloud, cy=Elphadunk
function translateBattleModel(config, prefix) {
  let gltfTranslator = new FF7GltfTranslator();
  gltfTranslator.translate_ff7_field_hrc_to_gltf(config, prefix + "aa", null, null, true, true);
}

// every ??aa in battle.lgp
// note: battle models automatically include animations
function translateAllBattleModels(config) {
  let filenames = fs.readdirSync(config.inputBattleBattleDirectory);
  for (let i=0; i<filenames.length; i++) {
    let filename = filenames[i];
    if (filename.toLowerCase().endsWith("aa")) {
      let prefix = filename.slice(0, 2);
      try {
        let gltfTranslator = new FF7GltfTranslator();
        gltfTranslator.translate_ff7_field_hrc_to_gltf(config, prefix + "aa", null, null, true, true);
      } catch (err) {
        console.log('Error while trying to translate: ' + prefix + 'xx:', err);
        //break; // uncomment this line to stop on failure
      }
    }
  }
}

// single field animation
function translateFieldAnimation(config, animFieldId) {
  let translator = new FF7FieldAnimationTranslator();
  translator.translateFF7FieldAnimationToGLTF(config, animFileId);
}

// every animation in field-animation-metadata.json
function translateAllFieldAnimations(config) {
  var fieldAnimationMetadata = JSON.parse(fs.readFileSync(config.metadataDirectory + "/field-animation-metadata.json"));
  var animFileIds = Object.keys(fieldAnimationMetadata);
  let translator = new FF7FieldAnimationTranslator();
  for (let animFileId of animFileIds) {
    translator.translateFF7FieldAnimationToGLTF(config, animFileId);
  }
}

//translateBattleModel(config, "rt");
//translateAllBattleModels(config);

translateFieldModel(config, "aaaa");
//translateAllFieldModels(config)

//translateFieldAnimation(config, "");
//translateAllFieldAnimations(config);
