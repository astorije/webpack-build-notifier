/**
 * @class WebpackBuildNotifierPlugin
 * @extends Object
 * A Webpack plugin that generates OS notifications for build steps using node-notifier.
 */
var path = require('path');
var os = require('os');
var notifier = require('node-notifier');
var stripAnsi = require('strip-ansi');
var exec = require('child_process').exec;

var WebpackBuildNotifierPlugin = function(cfg) {
    cfg = cfg || {};

    var defaultIconPath = path.resolve(__dirname, 'icons');

    /**
     * @cfg {String} [title='Webpack Build']
     * The notification title prefix.
     */
    this.title = cfg.title || 'Webpack Build';
    /**
     * @cfg {String} logo
     * The absolute path to the project logo to be displayed as a content image in the notification. Optional.
     */
    this.logo = cfg.logo;
    /**
     * @cfg {String} [sound='Submarine']
     * The sound to play for notifications. Set to false to play no sound. Valid sounds are listed
     * in the node-notifier project: https://github.com/mikaelbr/node-notifier
     */
    this.sound = cfg.hasOwnProperty('sound') ? cfg.sound : 'Submarine';
    /**
     * @cfg {String} [successSound='Submarine']
     * The sound to play for success notifications. Defaults to the value of the *sound* configuration option.
     * Set to false to play no sound for success notifications. Takes precedence over the *sound* configuration option.
     */
    this.successSound = cfg.hasOwnProperty('successSound') ? cfg.successSound : this.sound;
    /**
     * @cfg {String} [warningSound='Submarine']
     * The sound to play for warning notifications. Defaults to the value of the *sound* configuration option.
     * Set to false to play no sound for warning notifications. Takes precedence over the *sound* configuration option.
     */
    this.warningSound = cfg.hasOwnProperty('warningSound') ? cfg.warningSound : this.sound;
    /**
     * @cfg {String} [failureSound='Submarine']
     * The sound to play for failure notifications. Defaults to the value of the *sound* configuration option.
     * Set to false to play no sound for failure notifications. Takes precedence over the *sound* configuration option.
     */
    this.failureSound = cfg.hasOwnProperty('failureSound') ? cfg.failureSound : this.sound;
    /**
     * @cfg {Boolean/String} [suppressSuccess=false]
     * Defines when success notifications are shown. Can be one of the following values:
     *   false     - Show success notification for each successful compilation (default).
     *   true      - Only show success notification for initial successful compilation and after failed compilations.
     *   "always"  - Never show the success notifications.
     *   "initial" - Same as true, but suppresses the initial success notification.
     */
    this.suppressSuccess = cfg.suppressSuccess || false;
    /**
     * @cfg {Boolean} [suppressWarning=false]
     * True to suppress the warning notifications, otherwise false (default).
     */
    this.suppressWarning = cfg.suppressWarning || false;
     /**
     * @cfg {Boolean} [suppressWarning=true]
     * True to suppress the compilation started notifications (default), otherwise false.
     */
    this.suppressCompileStart = cfg.suppressCompileStart !== false;
    /**
     * @cfg {Boolean} [activateTerminalOnError=false]
     * True to activate (focus) the terminal window when a compilation error occurs.
     * Note that this only works on Mac OSX.
     */
    this.activateTerminalOnError = cfg.activateTerminalOnError || false;
    /**
     * @cfg {String} [successIcon='./icons/success.png']
     * The absolute path to the icon to be displayed for success notifications.
     */
    this.successIcon = cfg.successIcon || path.join(defaultIconPath, 'success.png');
    /**
     * @cfg {String} [warningIcon='./icons/warning.png']
     * The absolute path to the icon to be displayed for warning notifications.
     */
    this.warningIcon = cfg.warningIcon || path.join(defaultIconPath, 'warning.png');
    /**
     * @cfg {String} [failureIcon='./icons/failure.png']
     * The absolute path to the icon to be displayed for failure notifications.
     */
    this.failureIcon = cfg.failureIcon || path.join(defaultIconPath, 'failure.png');
    /**
     * @cfg {String} [compileIcon='./icons/compile.png']
     * The absolute path to the icon to be displayed for compilation started notifications.
     */
    this.compileIcon = cfg.compileIcon || path.join(defaultIconPath, 'compile.png');
    /**
     * @cfg {Function} onClick
     * A function called when clicking the notification. By default, it activates the Terminal application.
     */
    this.onClick = cfg.onClick || function(notifierObject, options) { this.activateTerminalWindow(); };
    /**
     * @cfg {Function} messageFormatter
     * A function which returns a formatted notification message. The function is passed two parameters:
     *  1) {Object} error/warning - The raw error or warning object.
     *  2) {String} filepath - The path to the file containing the error/warning (if available).
     * This function must return a String.
     * The default messageFormatter will display the filename which contains the error/warning followed by the
     * error/warning message.
     * Note that the message will always be limited to 256 characters.
     */
    this.messageFormatter = function(error, filepath) {
        var message = (cfg.messageFormatter || this.defaultMessageFormatter)(error, filepath);
        if (typeof message === "string") {
            return message.substr(0, 256); // limit message length to 256 characters, fixes #20
        } else {
            throw "Invalid message type '" + typeof message + "'; messageFormatter must return a String.";
        }
    };

    // add notification click handler to activate terminal window
    notifier.on('click', this.onClick.bind(this));
};

var buildSuccessful = false;
var hasRun = false;

WebpackBuildNotifierPlugin.prototype.defaultMessageFormatter = function(error, filepath) {
    return filepath + os.EOL + (error.message ? error.message.replace(error.module ? error.module.resource : '', '') : '');
};

WebpackBuildNotifierPlugin.prototype.activateTerminalWindow = function() {
    if (os.platform() === 'darwin') {
        exec('osascript -e \'tell application "Terminal" to activate\'');
    } else if (os.platform() === 'win32') {
        // TODO: Windows platform
    }
};

WebpackBuildNotifierPlugin.prototype.onCompilationWatchRun = function(compilation, callback) {
    notifier.notify({
        title: this.title,
        message: 'Compilation started...',
        contentImage: this.logo,
        icon: this.compileIcon
    });
    callback();
};

WebpackBuildNotifierPlugin.prototype.onCompilationDone = function(results) {
    var notify,
        title = this.title + ' - ',
        msg = 'Build successful!',
        icon = this.successIcon,
        sound = this.successSound;

    if (results.hasErrors()) {
        var error = results.compilation.errors[0];
        notify = true;
        title += 'Error';
        msg = this.messageFormatter(error, error.module && error.module.rawRequest ? error.module.rawRequest : '');
        icon = this.failureIcon;
        sound = this.failureSound;
        buildSuccessful = false;
    } else if (!this.suppressWarning && results.hasWarnings()) {
        var warning = results.compilation.warnings[0];
        notify = true;
        title += 'Warning';
        msg = this.messageFormatter(warning, warning.module && warning.module.rawRequest ? warning.module.rawRequest : '');
        icon = this.warningIcon;
        sound = this.warningSound;
        buildSuccessful = false;
    } else {
        title += 'Success';
        if (this.suppressSuccess === "always" || (this.suppressSuccess === "initial" && !hasRun)) {
            notify = false;
        } else if (this.suppressSuccess === false || !buildSuccessful) {
            notify = true; // previous build failed, let's show a notification even if success notifications are suppressed
        }
        buildSuccessful = true;
    }

    if (notify) {
        notifier.notify({
            title: title,
            message: stripAnsi(msg),
            sound: sound,
            contentImage: this.logo,
            icon: icon,
            wait: true
        });
    }

    if (this.activateTerminalOnError && !buildSuccessful) {
        this.activateTerminalWindow();
    }

    hasRun = true;
};

WebpackBuildNotifierPlugin.prototype.apply = function(compiler) {
    if (!this.suppressCompileStart) {
        compiler.plugin('watch-run', this.onCompilationWatchRun.bind(this));
    }
    compiler.plugin('done', this.onCompilationDone.bind(this));
};

module.exports = WebpackBuildNotifierPlugin;
