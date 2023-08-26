const fs = require('fs-extra');
const browserify = require('browserify');
const minify = require('uglify-es').minify;
const path = require('path');

const srcDir = './src';
const distDir = './dist';
const outputFile = `${distDir}/sorla.min.js`;

function findJsFiles(dir, fileList = [])
{
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory())
        {
            findJsFiles(filePath, fileList);
        }
        else if (path.extname(filePath) === '.js')
        {
            fileList.push(filePath);
        }
    });
    return fileList;
}

function buildForBrowser(entryFile, outputFile)
{
    const b = browserify();
    b.add(entryFile);
    b.bundle((err, buf) => {
        if (err)
        {
            console.error(err);
            return;
        }
        const minifiedCode = minify(buf.toString()).code;
        fs.outputFileSync(outputFile, buf);
        fs.outputFileSync(outputFile.replace('.js', '.js'), minifiedCode);
    });
}

const allJsFiles = findJsFiles(srcDir);
buildForBrowser(allJsFiles, outputFile);