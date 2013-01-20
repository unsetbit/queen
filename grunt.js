module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
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
        src: '<config:files.client.src>',
        dest: 'build/<%= pkg.name %>.js',
        exportedVariable: 'Queen',
        exports: './lib/client/WorkerProvider.js',
        path: ['./components']
      }
    },
    min: {
      client: {
        src: ['<banner:meta.banner>', '<config:hug.client.dest>'],
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
    lint: {
      server: '<config:files.server>',
      client: '<config:files.client.src>'
    },
    watch: {
        client: {
          files: '<config:files.client.src>',
          tasks: 'hug:client copy:dev'
        },
        styles: {
          files: './lib/client/styles/**/*',
          tasks: 'less concat:styles'
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
        src: ['<config:files.styles>'],
        dest: 'static/<%= pkg.name %>.css'
      }
    },
    clean: {
      build: ['./build/']
    },
    nodeunit: {
      lib: '<config:files.test.server>'
    },
    bower: {},
    jshint: {
      server: {
        options: {
          node: true,
          strict: false,
          sub: true,
          expr: true
        }
      },
      client: {
        options: {
          browser: true,
          sub: true
        }
      },
      options: {
        quotmark: 'single',
        camelcase: true,
        trailing: true,
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true
      },
      globals: {}
    }
  });

  grunt.loadNpmTasks('grunt-hug');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-less');
  
  grunt.registerTask('build-js', 'hug');
  grunt.registerTask('build-css', 'less concat:styles');
  grunt.registerTask('build', 'lint build-js build-css');

  grunt.registerTask('build-dev', 'build copy:dev');
  grunt.registerTask('build-release', 'clean bower build min copy:dist');

  grunt.renameTask('test','nodeunit');
  grunt.registerTask('test', 'nodeunit');

  grunt.registerTask('default', 'clean bower build-dev');

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