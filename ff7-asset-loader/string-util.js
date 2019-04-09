var toBits8 = function(n) {
  return n.toString(2).padStart(8, "0");
}

var toHex2 = function(n) {
  return n.toString(16).padStart(2, "0");
}

var pad5 = function(n) {
  return ("" + n).padStart(5, "0");
}

module.exports = {
  toBits8,
  toHex2,
  pad5
};
