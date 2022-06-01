'use strict';

const zero = '0'.repeat(10);
module.exports = function byteArrayToBinary(array) {
  const result = [];
  for (const element of array) {
    const binary = element.toString(2);
    result.push(zero.substring(0, 8 - binary.length) + binary);
  }
  return result.join('');
};
