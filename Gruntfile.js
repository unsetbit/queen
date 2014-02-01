module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: require('./package.json'),
    files: {
      server: ['lib/server/**/*.js'],
      test: {
        server: ['test/server/**/*.js']
      },
      client: {
        libs: '',
        src: 'lib/client/*.js'
      },
      monitor: {
        header: 'lib/monitor/lib/soyutils.js',
        src: 'lib/monitor/**/*.js'
      },
      styles: [ 
        './lib/client/styles/external/**/*.css', 
        './lib/client/styles/**/*.css', 
        './lib/client/styles/less.css'
      ]
    },
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    hug: {
      client: {
        src: '<%= files.client.src %>',
        dest: 'build/<%= pkg.name %>.js',
        exportedVariable: 'Queen',
        exports: './lib/client/WorkerProvider.js',
        path: ['./bower_components']
      }
    },
    uglify: {
      client: {
        src: ['<%= hug.client.dest %>'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    copy: {
      dist: {
        files: {
          "./static/" : "./dist/**/*"
        }
      },
      dev: {
        files: {
          "./static/" : "./build/**/*"
        }
      }
    },
    watch: {
        client: {
          files: '<%= files.client.src %>',
          tasks: ['hug:client', 'copy:dev']
        },
        styles: {
          files: './lib/client/styles/**/*',
          tasks: ['less', 'concat:styles']
        }
    },
    less: {
      styles:{
        files: {
          './lib/client/styles/less.css': './lib/client/styles/*.less'
        }
      }
    },
    concat: {
      styles: {
        src: ['<%= files.styles %>'],
        dest: 'static/<%= pkg.name %>.css'
      }
    },
    clean: {
      build: ['./build/']
    },
    nodeunit: {
      lib: '<%= files.test.server %>'
    },
    bower: {},
    jshint: {
      server: {
        files: { src: ['<%= files.server %>']}, 
        options: {
          node: true,
          strict: false,
          sub: true,
          expr: true
        }
      },
      client: {
        files: {
          src: ['<%= files.client.src %>']
        }, 
        options: {
          node: true,
          browser: true,
          sub: true,
          globals: {
            Modernizr: true,
            io: true
          }
        }
      },
      options: {
        quotmark: 'single',
        camelcase: true,
        eqeqeq: true,
        immed: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        globals: {
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-hug');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  
  grunt.registerTask('build-js', ['hug']);
  grunt.registerTask('build-css', ['less', 'concat:styles']);
  grunt.registerTask('build', ['lint', 'build-js', 'build-css']);

  grunt.registerTask('build-dev', ['build', 'copy:dev']);
  grunt.registerTask('build-release', ['clean', 'bower', 'build', 'uglify', 'copy:dist']);

  grunt.registerTask('test', ['nodeunit']);
  grunt.registerTask('lint', ['jshint']);

  grunt.registerTask('default', ['clean', 'bower', 'build-dev']);

  grunt.registerTask('bower', function(){
    var done = this.async();
    var bower = require('bower');
    bower.commands.
        install().
        on('end', function(data){
          if(data) grunt.log.writeln(data); 
          done(true);
        }).
        on('error', function(err){
          if(err) grunt.log.writeln(err);
          done(false);
        });
  });
};