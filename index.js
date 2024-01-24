
const fs = require('fs-extra');
const browserify = require('browserify');
const minify = require('uglify-es').minify;
const path = require('path');
const terser = require('terser');

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

function buildForBrowser(entryFile, outputFile) {
    const b = browserify();
    b.add(entryFile);
    b.bundle(async (err, buf) => {
        if (err) {
            console.error(err);
            return;
        }

        const code = buf.toString();
        try {
            const minified = await terser.minify(code, {
                compress: true,
                mangle: {
                    keep_classnames: true,
                    keep_fnames: true
                }
            });

            if (minified.error) {
                console.error(minified.error);
                return;
            }

            fs.outputFileSync(outputFile, code);
            fs.outputFileSync(outputFile, minified.code);
        } catch (minifyErr) {
            console.error(minifyErr);
        }
    });
}

const allJsFiles = findJsFiles(srcDir);
buildForBrowser(allJsFiles, outputFile);