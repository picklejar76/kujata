const fs = require("fs");
const FF7FieldAnimationTranslator = require("./ff7-field-animation-translator.js");

var config = JSON.parse(fs.readFileSync("../config.json"));

var fieldAnimationMetadata = JSON.parse(fs.readFileSync(config.metadataDirectory + "/field-animation-metadata.json"));

var animFileIds = Object.keys(fieldAnimationMetadata);

let translator = new FF7FieldAnimationTranslator();
// animFileIds = animFileIds.filter(a => a === 'bxbb')
// animFileIds = animFileIds.filter(a => a === 'acfe')
// animFileIds = animFileIds.filter(a => a === 'bvjf')

for (let animFileId of animFileIds) {
  console.log('anim', animFileId)
  translator.translateFF7FieldAnimationToGLTF(config, animFileId);
}

/*
// translate every *.hrc.json file in the skeletons directory
let filenames = fs.readdirSync(config.inputFieldCharDirectory);
for (let i=0; i<filenames.length; i++) {
  let filename = filenames[i];
  if (filename.toLowerCase().endsWith(".hrc")) {
    let hrcFileId = filename.slice(0, 4);
    try {
      gltfTranslator.translate_ff7_field_hrc_to_gltf(config, hrcFileId, null, null, includeTextures);
    } catch (err) {
      console.log('Error while trying to translate: ' + filename + ':', err);
      //break; // uncomment this line to stop on failure
    }
  }
}
*/
