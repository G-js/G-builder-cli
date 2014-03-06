#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var program = require('commander');
var mkdirp = require('mkdirp');
var pkg = require('../package.json');

var cwd = process.cwd();
var builder;

require('colors');

if (fs.existsSync(cwd + '/Gbuilder.js')) {
    builder = require(cwd + '/Gbuilder.js');
} else {
    throw new Error('Gbuilder.js not found');
}

function checkUpdate (callback) {
    builder.checkUpdate(function (err, update) {
        if (update) {
            console.log('-------------------------------------------'.cyan);
            console.log('Update available: %s %s', update.latest.blue, ('(current:' + update.current + ')').grey);
            console.log('Run %s to update', ('npm update ' + update.name).red);
            console.log('-------------------------------------------'.cyan);
        }
        require('update-notifier')({
            packagePath: path.resolve(__dirname, '../package.json'),
            callback: function (err, update) {
                if (update) {
                    console.log('-------------------------------------------'.cyan);
                    console.log('Update available: %s %s', update.latest.blue, ('(current:' + update.current + ')').grey);
                    console.log('Run %s to update', ('npm update -g' + update.name).red);
                    console.log('-------------------------------------------'.cyan);
                }

                callback();
            }
        });
    });
}

program
    .version(pkg.version)
    .option('--no-checkupdate', 'don\'t check update');

program
    .command('watch')
    .action(function () {
        builder.watch(function (watcher) {
            console.log('watching : [%s]', builder.config.src);
            watcher.on('all', function (event, file) {
                console.log('%s : %s', event.toUpperCase(), file.replace(builder.config.src, ''));
            });
        });

        builder.on('success', function (file) {
            console.log('%s : %s', file, '✔︎'.green);
        });

        builder.on('fail', function (file, err){
            console.log('%s : %s, %s', file, err, '✗'.red);
        });
    });

program
    .command('build [files]')
    .option('-a, --all', 'build all files')
    .option('-R, --relative', 'also build relative files')
    .option('-r, --report <path>', 'path to write report file')
    .action(function (files, config) {
        var total = 0;
        var current = 0;

        files = files ? files.split(',') : [];

        builder.on('start', function (files) {
            total = files.length;
            console.log('Start building: %d files', files.length);
        });

        builder.on('build', function (file) {
            console.log('[%d / %d] %s', ++current, total, file);
        });

        builder.build(
            files,
            {
                buildAllFiles: config.all,
                buildRelatedFiles: config.relative
            },
            function (err, report) {
                var hasError = err || Object.keys(report.errors).length;
                if (err) {
                    console.log(err.message);
                }

                Object.keys(report.errors).forEach(function (file) {
                    console.log('File :%s', file);
                    console.log(report.errors[file].stack);
                });

                if (config.report) {
                    mkdirp(path.dirname(config.report), function (err) {
                        if (err) {
                            throw err;
                        }
                        fs.writeFile(
                            config.report,
                            JSON.stringify({
                                files: report.files,
                                input: report.input,
                                output: report.output,
                                errors: report.errors
                            }, null, 4)
                        );
                    });
                }

                if (hasError) {
                    process.exit(1);
                }
            }
        );
    });



if (process.argv.indexOf('--no-checkupdate') !== -1) {
    program.parse(process.argv);
} else {
    checkUpdate(function () {
        program.parse(process.argv);
    });
}