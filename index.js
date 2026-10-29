
const fs = require('fs-extra');
const browserify = require('browserify');
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
        // a failed build must fail the command, otherwise an old dist file silently stays in place
        if (err) {
            console.error(err.message);
            process.exitCode = 1;
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
                process.exitCode = 1;
                return;
            }

            fs.outputFileSync(outputFile, minified.code);
            console.log(`${outputFile}: ${(minified.code.length / 1024).toFixed(1)} kB`);
        } catch (minifyErr) {
            console.error(minifyErr);
            process.exitCode = 1;
        }
    });
}

// only the library entry: bundling every file in src/ also pulled src/helper.js and faker (1.6 MB)
buildForBrowser([path.join(srcDir, 'sorla.js')], outputFile);