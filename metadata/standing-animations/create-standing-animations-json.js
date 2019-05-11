const fs = require("fs");
let config = JSON.parse(fs.readFileSync('../../config.json', 'utf-8'));

let metadata = JSON.parse(fs.readFileSync(config.metadataDirectory + '/field-model-metadata.json', 'utf-8'));
let standingAnimations = {};

for (let hrcId of Object.keys(metadata)) {
  var stats = metadata[hrcId].animationStats.stand;
  let animIds = Object.keys(stats);
  //console.log(hrcId + ": " + JSON.stringify(animIds, null, 0));
  animIds.sort((a1,a2) => stats[a2]-stats[a1]); // sort by higher frequency first
  //console.log(hrcId + ": " + JSON.stringify(animIds, null, 0));
  let mostCommonStandingAnimation = animIds[0];
  standingAnimations[hrcId] = mostCommonStandingAnimation;
}

fs.writeFileSync(config.metadataDirectory + '/field-model-standing-animations.json', JSON.stringify(standingAnimations, null, 2));
