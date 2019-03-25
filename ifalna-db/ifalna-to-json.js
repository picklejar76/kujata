const fs = require('fs');

ifalnaDatabase = {};

fs.readFileSync('ifalna.fil', 'utf-8').split(/\r?\n/).forEach(function(line) {
  let matches = line.match(/(\w\w\w\w)(\w+?)=(.*)$/);
  if (matches == null) {
    // ignore; this might happen with the very last line of the file
  } else {
    hrcFileId = matches[1];
    attrName = matches[2];
    attrValues = matches[3].split(",");
    cleanValues = [];
    for (let attrValue of attrValues) {
      if (attrValue.length > 0) {
        let cleanValue = attrValue;
        if (cleanValue.endsWith(".char")) {
          cleanValue = cleanValue.substring(0, cleanValue.length-5);
        }
        cleanValues.push(cleanValue);
      }
    }
    if (!ifalnaDatabase[hrcFileId]) {
      ifalnaDatabase[hrcFileId] = {};
    }
    ifalnaDatabase[hrcFileId][attrName] = cleanValues;
  }
});
console.log(JSON.stringify(ifalnaDatabase, null, 2));
