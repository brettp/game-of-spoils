'use strict';

var gulp       = require('gulp');
var del        = require('del');
var haml       = require('gulp-haml');
var coffee     = require('gulp-coffee');
var coffeelint = require('gulp-coffeelint');
var jsontf     = require('gulp-json-transform');
var stylish    = require('coffeelint-stylish');
var sass       = require('gulp-sass');
var gutil      = require('gulp-util');
var tinylr     = require('tiny-lr');




// Copy static folders to build directory
gulp.task('update-static', function() {

  // del('build/*/assets/fonts/*');
  // gulp.src('src/assets/fonts/**')
  //     .pipe(gulp.dest('build/chrome/assets/fonts'))
  //     .pipe(gulp.dest('build/firefox/assets/fonts'));

  del('build/*/assets/icons/*');
  gulp.src('src/assets/icons/**')
      .pipe(gulp.dest('build/chrome/assets/icons'))
      .pipe(gulp.dest('build/firefox/assets/icons'));

  del('build/*/assets/images/*');
  gulp.src('src/assets/images/**')
      .pipe(gulp.dest('build/chrome/assets/images'))
      .pipe(gulp.dest('build/firefox/assets/images'));

  del('build/*/assets/vendor/*');
  gulp.src('src/scripts/vendor/*.js')
      .pipe(gulp.dest('build/chrome/scripts/vendor'))
      .pipe(gulp.dest('build/firefox/scripts/vendor'));

  del('build/*/manifest.json');
  return gulp.src('src/manifest.json')
             .pipe(gulp.dest('build/chrome'))
             .pipe(jsontf(function(data, file) {
               data.applications = {
                 "gecko": {
                   "id": "gameofspoilslite@brettp.github.io"
                 }
               };
               return data;
             }, 2))
             .pipe(gulp.dest('build/firefox'));
});


// HAML
gulp.task('haml', function () {
  del('build/*/*.html');
  gulp.src('src/*.haml')
    .pipe(haml())
    .pipe(gulp.dest('build/chrome'))
    .pipe(gulp.dest('build/firefox'));
});

// Coffee
gulp.task('coffee', function() {
  del('build/*/scripts/*.js');
  gulp.src('src/scripts/*.coffee')
    // .pipe(coffeelint(null, {disable: 'max_line_length'}))
    // .pipe(coffeelint.reporter(stylish))
    .pipe(coffee({bare: true}).on('error', gutil.log))
    .pipe(gulp.dest('build/chrome/scripts/'))
    .pipe(gulp.dest('build/firefox/scripts/'));
});

// SASS
gulp.task('sass', function () {
  del('build/*/styles/*.css');
  gulp.src('src/styles/*.sass')
    .pipe(sass({outputStyle: 'expanded'}))
    .pipe(gulp.dest('build/chrome/styles'))
    .pipe(gulp.dest('build/firefox/styles'));
});


// Watch paths
var watchPaths = {
  coffee: [
    'src/scripts/*.coffee',
    'src/scripts/vendor/*.coffee'
  ],
  assets: [
    'src/assets/**',
    'src/assets/**/*',
    'src/manifest.json'
  ],
  sass: [
    'src/styles/*.sass',
  ],
  haml: [
    'src/*.haml',
  ]
};

// Watch task
gulp.task('watch', function() {

  gulp.watch(watchPaths.coffee, ['coffee']);
  gulp.watch(watchPaths.assets, ['update-static']);
  gulp.watch(watchPaths.sass,   ['sass']);
  gulp.watch(watchPaths.haml,   ['haml']);

  // Auto reload chrome extension
  var livereload = tinylr();
  livereload.listen(35729);
  gulp.watch(['build/chrome/**/*', 'build/chrome/scripts/**/*'], function (evt) {
    console.log('reload!')
    livereload.changed({
        body: {
            files: [evt.path]
        }
    });
  });
});


gulp.task('build', ['update-static', 'haml', 'coffee', 'sass'], function() {} );

// Default gulp is watch
gulp.task('default', ['watch'], function() {} );
