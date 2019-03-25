const fs = require("fs");

module.exports = {

  FIRST_LINE: ":HEADER_BLOCK 2",
  SKELETON_LINE_PREFIX: ":SKELETON ",
  BONES_LINE_PREFIX: ":BONES ",

  parseRsdNames: function(rsdDescription) {
  	// rsdDescription is something like one of these:
  	//   "0"
  	//   "1 ZYXW"
  	//   "12 BZIA BZIC BZIE BZJA BZJC BZJE CAAA CAAC CAAE CABA CABC CABE"
    let tokens = rsdDescription.split(" ");
  	if (!tokens || tokens.length == 0 || tokens[0] == "0") {
  		return [];
  	}
    let expectedCount = tokens[0];
    let rsdBaseFilenames = tokens.slice(1);
    if (expectedCount != rsdBaseFilenames.length) { throw new Error("rsdDescription not valid, count did not match: " + rsdDescription); }
  	return rsdBaseFilenames;
  },

  loadHrc: function(config, hrcBaseFilename) {

    let fileContents = fs.readFileSync(config.inputFieldDirectory + '/' + hrcBaseFilename + ".HRC", "utf-8");
    let lines = fileContents.split(/\r?\n/g).filter(line => !line.startsWith("#"));
    if (!lines[0].startsWith(this.FIRST_LINE))           { throw new Error("Expected first line to be: " + this.FIRST_LINE); }
    if (!lines[1].startsWith(this.SKELETON_LINE_PREFIX)) { throw new Error("Expected second line to start with: " + this.SKELETON_LINE_PREFIX); }
    if (!lines[2].startsWith(this.BONES_LINE_PREFIX))    { throw new Error("Expected third line to start with: " + this.BONES_LINE_PREFIX); }
    let skeletonName = lines[1].substring(this.SKELETON_LINE_PREFIX.length);
    let numBones = parseInt(lines[2].substring(this.BONES_LINE_PREFIX.length));
    if (numBones == 0) {
      numBones = 1; // 0 really means 1 bone with name "null" and no children
    }
    let skeleton = {
      name: skeletonName,
      bones: []
    };
    for (let i=0; i<numBones; i++) {
      let name   =  lines[i*5 + 4];
      let parent =  lines[i*5 + 5];
      let length =  lines[i*5 + 6];
      let rsdDesc = lines[i*5 + 7];
      let bone = {
        boneIndex: i,
        name: name,
        parent: parent,
        length: parseFloat(length),
        rsdBaseFilenames: this.parseRsdNames(rsdDesc)
      };
      skeleton.bones.push(bone);
    }
    return skeleton;
  }

};
