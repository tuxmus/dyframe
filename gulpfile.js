'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var fs = require('fs');
var karma = require('karma').server;
var browserSync = require('browser-sync');
var runSequence = require('run-sequence');
var minimist = require('minimist');
var del = require('del');
var opn = require('opn');

var getJson = function (filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
};
var knownOptions = {
  string: 'bump',
  default: {
    bump: 'patch'
  }
};
var options = minimist(process.argv.slice(2), knownOptions);
var banner = [
  '/*!',
  ' * Dyframe',
  ' * @version <%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @author <%= pkg.author %>',
  ' * @license <%= pkg.license.type %>',
  ' */',
  ''].join('\n');
var scripts = [
  'gulpfile.js',
  'karma.conf.js',
  'src/*.js',
  'demo/*.js',
  'test/spec/*.js'
];

gulp.task('clean', function (callback) {
  del('coverage', callback);
});

gulp.task('jshint', function () {
  return gulp.src(scripts)
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

gulp.task('karma', ['clean'], function (callback) {
  karma.start({
    configFile: __dirname + '/karma.conf.js'
  }, callback);
});

gulp.task('scripts', function () {
  var pkg = getJson('package.json');
  return gulp.src('src/*.js')
    .pipe($.header(banner, {pkg: pkg}))
    .pipe(gulp.dest('.'))
    .pipe($.uglify({preserveComments: 'some'}))
    .pipe($.rename({suffix: '.min'}))
    .pipe(gulp.dest('.'));
});

gulp.task('serve', ['clean'], function () {
  browserSync({
    server: {
      baseDir: ['src', 'demo'],
    },
    notify: false,
    open: false
  });
  browserSync.emitter.once('init', function () {
    opn('http://localhost:3000/demo.html');
  });
  karma.start({
    configFile: __dirname + '/karma.conf.js',
    singleRun: false
  });
  gulp.watch([
    'demo/*',
    'src/*.js'
  ]).on('change', browserSync.reload);
  gulp.watch(scripts, ['jshint']);
});

gulp.task('link', function () {
  var downloadBase = 'https://github.com/htanjo/dyframe/raw/';
  var pattern = new RegExp(downloadBase + '.*?[\/]', 'g');
  var version = getJson('package.json').version;
  var downloadDir = downloadBase + 'v' + version + '/';
  return gulp.src(['README.md', 'demo/index.html'], {base: '.'})
    .pipe($.replace(pattern, downloadDir))
    .pipe(gulp.dest('.'));
});

gulp.task('bump', function () {
  return gulp.src(['package.json', 'bower.json'])
    .pipe($.bump({type: options.bump}))
    .pipe(gulp.dest('.'));
});

gulp.task('commit', ['build', 'link'], function () {
  var version = getJson('package.json').version;
  return gulp.src(['package.json', 'bower.json', '*.js', 'README.md', 'demo/index.html'])
    .pipe($.git.commit('Release v' + version));
});

gulp.task('tag', function (callback) {
  var version = getJson('package.json').version;
  $.git.tag('v' + version, 'Release v' + version, callback);
});

gulp.task('deploy', ['test'], function () {
  return gulp.src(['src/*.js', 'demo/**/*', '!demo/demo.html'])
    .pipe($.ghPages());
});

gulp.task('test', ['jshint', 'karma']);

gulp.task('build', ['scripts']);

gulp.task('release', function (callback) {
  runSequence('test', 'bump', 'commit', 'tag', callback);
});

gulp.task('default', ['test', 'build']);
