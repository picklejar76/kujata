const fs = require("fs");
const stringUtil = require("./string-util.js");
//const LzsDecompressor = require("../lzs/lzs-decompressor.js");
const { FF7BinaryDataReader } = require("./ff7-binary-data-reader.js");

module.exports = class BattleSceneLoader {

  constructor(lzsDecompressor, mapList) {
    //this.lzsDecompressor = lzsDecompressor;
  }

  modelFilename(modelId) {
    if (modelId == -1) {
      return null;
    }
    let letter1 = Math.floor(modelId / 26);
    let letter2 = modelId % 26;
    return String.fromCharCode(letter1 + 97) + String.fromCharCode(letter2 + 97) + "aa";
  }

  // sceneId is something like "163" for filename "scene163"
  loadBattleScene(config, sceneId) {

    var buffer = fs.readFileSync(config.inputBattleSceneBinDirectory + '/scene' + sceneId);
    var r = new FF7BinaryDataReader(buffer);
    let fileSizeBytes = buffer.length;
    r.offset = 0;

    let enemyModelIds = [];
    enemyModelIds.push(r.readShort());
    enemyModelIds.push(r.readShort());
    enemyModelIds.push(r.readShort());
    let scene = {
      formationSetups: [],
      cameraPositions: [],
      enemyFormations: [],
      enemies: [],
      attacks: []
    };
    // scene.modelFilename1 = this.modelFilename(scene.modelId1);
    // scene.modelFilename2 = this.modelFilename(scene.modelId2);
    // scene.modelFilename3 = this.modelFilename(scene.modelId3);
    let padding = r.readShort();
    for (let i=0; i<4; i++) {
      let setup = {
        background: r.readShort().toString(16),
        nextFormationID: r.readShort(),
        escapeCounter: r.readShort(),
        unused: r.readShort(),
        nextArenaFormationIDs: [ r.readShort(), r.readShort(), r.readShort(), r.readShort() ],
        flags: r.readUShort().toString(16),
        layoutType: r.readByte(),
        cameraPositionIndex: r.readUByte()
      };
      scene.formationSetups.push(setup);
    }
    for (let i=0; i<4; i++) {
      for (let j=0; j<3; j++) {
        let cameraPosition = {
          formation: i,
          camera: j,
          location: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
          target: { x: r.readShort(), y: r.readShort(), z: r.readShort() }
        };
        scene.cameraPositions.push(cameraPosition);
      }
      let unused = r.readUByteArray(12);
    }
    for (let i=0; i<4; i++) {
      for (let j=0; j<6; j++) {
        let enemyFormation = {
          formation: i,
          enemy: j,
          enemyId: r.readShort(),
          location: { x: r.readShort(), y: r.readShort(), z: r.readShort() },
          row: r.readShort(),
          coverFlags: r.readUShort().toString(16),
          initFlags: r.readUInt().toString(16)
        };
        scene.enemyFormations.push(enemyFormation);
      }
    }

    // Enemies (3 per scene)
    for (let i=0; i<3; i++) {
      let offsetAfterName = r.offset + 32;
      let enemyName = r.readDialogString(32);
      r.offset = offsetAfterName;
      let enemy = {
        name: enemyName, // TODO: find out if readKernelString is best, enhance to add option for fixed-length/set-offset-when-done
        modelId: enemyModelIds[i],
        modelFilename: this.modelFilename(enemyModelIds[i]),
        level: r.readUByte(),
        speed: r.readUByte(),
        luck: r.readUByte(),
        evade: r.readUByte(),
        str: r.readUByte(),
        def: r.readUByte(),
        mag: r.readUByte(),
        magDef: r.readUByte(),
        attackElements: [],
        attacks: [],
        //actionAnimationIndexes: [],
        //attackIDs: [],
        cameraOverrides: [],
        itemDropRates: [],
        items: [],
        manipAttacks: []
      };
      for (let j=0; j<8; j++) {
        enemy.attackElements.push({});
      }
      for (let j=0; j<8; j++) {
        enemy.attackElements[j].element = r.readUByte();
      }
      for (let j=0; j<8; j++) {
        enemy.attackElements[j].elementRate = r.readUByte();
      }
      for (let j=0; j<16; j++) {
        enemy.attacks.push({attackId: null, animationId: null});
      }
      for (let j=0; j<16; j++) {
        enemy.attacks[j].animationId = r.readUByte();
      }
      for (let j=0; j<16; j++) {
        enemy.attacks[j].attackId = r.readUShort();
      }
      for (let j=0; j<16; j++) {
        enemy.cameraOverrides.push(r.readUShort());
      }
      for (let j=0; j<4; j++) {
        enemy.itemDropRates.push(r.readUByte());
      }
      for (let j=0; j<4; j++) {
        enemy.items.push(r.readUShort());
      }
      for (let j=0; j<3; j++) {
        enemy.manipAttacks.push(r.readUShort());
      }
      enemy.unk1 = r.readUShort();
      enemy.mp = r.readUShort();
      enemy.ap = r.readUShort();
      enemy.morphItem = r.readUShort();
      enemy.backAttackMultiplier = r.readUByte();
      let align = r.readUByte();
      enemy.hp = r.readUInt();
      enemy.exp = r.readUInt();
      enemy.gil = r.readUInt();
      enemy.statusImmunityFlags = r.readUInt().toString(16).padStart(8,'0');
      let pad4 = r.readUByteArray(4);
      scene.enemies.push(enemy);
    }

    // Attacks (32 per scene)
    for (let i=0; i<32; i++) {
      let attack = {
        attackPercent: r.readUByte(),
        impactAnimationId: r.readUByte(),
        targetAnimationId: r.readUByte(),
        unknown: r.readUByte(),
        mpCost: r.readUShort(),
        impactSound: r.readUShort(),
        stCamera: r.readUShort(),
        mtCamera: r.readUShort(),
        attackTargetFlags: r.readUByte().toString(2).padStart(8,'0'),
        attackAnimationId: r.readUByte(),
        damageFormula: r.readUByte().toString(16).padStart(2,'0'),
        attackStrength: r.readUByte(),
        conditionFlags: r.readUByte().toString(2).padStart(8,'0'),
        statusEffectChangeFlags: r.readUByte().toString(2).padStart(8,'0'),
        addlEffects: r.readUByte().toString(16).padStart(2,'0'),
        addlEffectsModifier: r.readUByte(),
        statusFlags: r.readUInt().toString(2).padStart(32,'0'),
        attackElementFlags: r.readUShort().toString(2).padStart(8,'0'),
        specialAttackFlags: r.readUShort().toString(2).padStart(8,'0')
      };
      scene.attacks.push(attack);
    }
    for (let i=0; i<32; i++) {
      scene.attacks[i].attackId = r.readUShort();
    }
    for (let i=0; i<32; i++) {
      let offsetAfterName = r.offset + 32;
      let attackName = r.readDialogString(32);
      r.offset = offsetAfterName;
      scene.attacks[i].name = attackName;
    }

    //r.printNextBufferDataAsHex();

    return scene;
  }; // end loadBattleScene() function

}; // end module.exports = class BattleSceneLoader
