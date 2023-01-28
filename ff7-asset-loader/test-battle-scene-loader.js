const fs = require("fs");
//const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const BattleSceneLoader = require("./battle-scene-loader.js");
let config = JSON.parse(fs.readFileSync('../config.json', 'utf-8'));

//let lzsDecompressor = new LzsDecompressor();
let battleSceneLoader = new BattleSceneLoader();
let battleModelMetadata = {};

for (let sceneId=1; sceneId<=255; sceneId++) {
  let scene = battleSceneLoader.loadBattleScene(config, sceneId);


  // build enemy map (scene-specific), and create entry in global metadata along the way
  let enemyMap = {};
  for (let enemy of scene.enemies) {
    enemyMap[enemy.modelId] = enemy;
    if (battleModelMetadata[enemy.modelFilename] != undefined) {
      console.log("WARN: enemy found in multiple scenes, will use last scene only for now: " + enemy.name);
    }
    battleModelMetadata[enemy.modelFilename] = {
      enemyName: enemy.name,
      enemyModelFilename: enemy.modelFilename,
      attackAnimations: []
    };
  }

  // build attack map (scene-specific)
  let attackMap = {};
  for (let attack of scene.attacks) {
    if (attack.attackId != 65535) {
      attackMap[attack.attackId] = attack;
    }
  }

  for (let enemyId of Object.keys(enemyMap)) {
    let enemy = enemyMap[enemyId];
    //console.log("enemy " + enemyId + " = " + enemy.name + "| modelFilename=" + enemy.modelFilename);
    let metadata = battleModelMetadata[enemy.modelFilename];
    for (let enemyAttack of enemy.attacks) {
      if (enemyAttack.attackId != 65535) {
        let attack = attackMap[enemyAttack.attackId];
        //console.log("  attack " + attack.attackId + " = " + attack.name + "| enemy animationId=" + enemyAttack.animationId + ", attackAnimationId=" + attack.attackAnimationId + ", impactAnimationId=" + attack.impactAnimationId + ", targetAnimationId=" + attack.targetAnimationId);
        metadata.attackAnimations.push({
          attackId: attack.attackId,
          attackName: attack.name,
          enemyAnimationId: enemyAttack.animationId,
          attackAnimationId: attack.attackAnimationId,
          impactAnimationId: attack.impactAnimationId,
          targetAnimationId: attack.targetAnimationId
        });
      }
    }
  }

}

let outputFilename = config.metadataDirectory + "/battle-model-metadata.json";
fs.writeFileSync(outputFilename, JSON.stringify(battleModelMetadata, null, 2));
console.log("Wrote: " + outputFilename);

/*
// write parsed scene data to JSON file
let outputFilename = "./battle-scene.json";
fs.writeFileSync(outputFilename, JSON.stringify(scene, null, 2));
console.log("Wrote: " + outputFilename);
*/
