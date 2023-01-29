const HrcLoader = require("../ff7-asset-loader/hrc-loader.js");
const RsdLoader = require("../ff7-asset-loader/rsd-loader.js");
const PLoader = require("../ff7-asset-loader/p-loader.js");
const ALoader = require("../ff7-asset-loader/a-loader.js");
const BattleModelLoader = require("../ff7-asset-loader/battle-model-loader.js");
const BattleAnimationLoader = require("../ff7-asset-loader/battle-animation-loader.js");

const fs = require("fs");
const mkdirp = require('mkdirp');

module.exports = class FF7JsonTranslator {

  constructor(config) {
    this.config = config;
  }

  createAndGetSubdir(subdir) {
    let outputDirectory = this.config.outputJsonDirectory + "/" + subdir + "/";
    if (!fs.existsSync(outputDirectory)) {
      console.log("Creating output directory: " + outputDirectory);
      mkdirp.sync(outputDirectory);
    }
    return outputDirectory;
  }

  writeJsonFile(obj, jsonFilenameFull) {
    fs.writeFileSync(jsonFilenameFull, JSON.stringify(obj, null, 2));
    console.log("Wrote: " + jsonFilenameFull);
  }

  translateHrcs(hrcFileIds) {
    let outputDirectory = this.createAndGetSubdir("skeletons");
    for (let hrcFileId of hrcFileIds) {
      let skeleton = HrcLoader.loadHrc(this.config, hrcFileId);
      this.writeJsonFile(skeleton, outputDirectory + hrcFileId + ".hrc.json");
    }
  }

  translateRsds(rsdFileIds) {
    let outputDirectory = this.createAndGetSubdir("bones");
    for (let rsdFileId of rsdFileIds) {
      let bone = RsdLoader.loadRsd(this.config, rsdFileId);
      this.writeJsonFile(bone, outputDirectory + rsdFileId + ".rsd.json");
    }
  }

  translatePs(pFileIds) {
    let outputDirectory = this.createAndGetSubdir("models");
    for (let pFileId of pFileIds) {
      let model = PLoader.loadP(this.config, pFileId);
      this.writeJsonFile(model, outputDirectory + pFileId + ".p.json");
    }
  }

  translateAnims(animFileIds) {
    let outputDirectory = this.createAndGetSubdir("animations");
    for (let animFileId of animFileIds) {
      let animation = ALoader.loadA(this.config, animFileId);
      this.writeJsonFile(animation, outputDirectory + animFileId + ".a.json");
    }
  }

};
