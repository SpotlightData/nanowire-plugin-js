const pkg = require('./package.json');

module.exports = {
  name: pkg.name,
  testMatch: ['<rootDir>/lib/**/*.test.js'],
};
