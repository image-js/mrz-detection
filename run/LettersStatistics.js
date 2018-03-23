'use strict';

var fs = require('fs');

var Papa = require('papaparse');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789<'.toUpperCase();
const LINE_LENGTH = 'line length';
const NOT_EQUAL_LINES = 'not equal lines';

class LettersStatistics {
  constructor(filepath) {
    var file = fs.readFileSync(filepath, 'utf-8');
    var data = Papa.parse(file).data.filter((elem) => elem[0] !== '');
    this.data = {};
    for (var i = 0; i < data.length; ++i) {
      var currentMRZ = data[i].slice(1);
      var name = data[i][0];

      if (currentMRZ.length < 2) {
        throw new Error(`MRZ for ${name} should have at least 2 lines`);
      }

      this.data[name] = currentMRZ;
    }

    this.letters = {};
    for (i = 0; i < ALPHABET.length; ++i) {
      var letter = ALPHABET[i];
      this.letters[letter] = {
        count: 0,
        errors: new Set([])
      };
    }

    for (var elem of [LINE_LENGTH, NOT_EQUAL_LINES]) {
      this.letters[elem] = {
        count: 0,
        errors: new Set([])
      };
    }
  }

  check(filename, mrz) {
    var data = this.data[filename];

    if (data.length !== mrz.length) {
      this.letters[NOT_EQUAL_LINES].count++;
      this.letters[NOT_EQUAL_LINES].errors.add(filename);
      return;
    }

    for (var i = 0; i < mrz.length; ++i) {
      var currentLine = mrz[i];
      var ground = data[i];

      if (currentLine.length !== ground.length) {
        this.letters[LINE_LENGTH].count++;
        this.letters[LINE_LENGTH].errors.add(filename);
        continue;
      }

      for (var j = 0; j < currentLine.length; ++j) {
        var predictedLetter = currentLine[j];

        var groundLetter = ground[j];
        if (predictedLetter !== groundLetter) {
          this.letters[groundLetter].count++;
          this.letters[groundLetter].errors.add(
            `${predictedLetter} ${i + 1}:${j + 1} ${filename}`
          );
        }
      }
    }
  }

  getResults() {
    return this.letters;
  }
}

module.exports = LettersStatistics;
