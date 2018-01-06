module.exports = function(callback) {

    // do app specific cleaning before exiting
    process.on('exit', function () {
        callback();
    });

    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
        console.log('Ctrl-C...');
        process.exit(2);
    });

    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function(e) {
        console.log('Uncaught Exception...');
        console.log(e.stack);
        process.exit(99);
    });
}