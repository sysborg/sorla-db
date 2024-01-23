const path = require('path');

module.exports = {
    mode: "production",
    target: "web",
    entry: './src/sorla.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'sorla.min.js'
    }
}