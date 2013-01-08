// JS Hint options
var JSHINT_BROWSER = {
  browser: true,
  es5: true
};

var JSHINT_NODE = {
  node: true,
  es5: true
};

module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',
    files: {
      server: ['server/lib/*.js'],
      test: {
        server: ['test/server/**/*.js']
      },
      client: {
        src: 'lib/client/**/*.js'
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
        dest: 'static/<%= pkg.name %>.js',
        exportedVariable: 'Queen',
        exports: './lib/client/WorkerProvider.js'
      },
      monitor: {
        src: '<config:files.monitor.src>',
        header: '<config:files.monitor.header>',
        dest: 'static/<%= pkg.name %>-monitor.js',
        exportedVariable: 'QueenMonitor',
        exports: './lib/monitor/Monitor.js'
      }
    },
    min: {
      dist: {
        src: ['<banner:meta.banner>', '<config:hug.client.dest>'],
        dest: 'build/<%= pkg.name %>.min.js'
      }
    },
    lint: {
      server: '<config:files.server>',
      client: '<config:files.client.srcFiles>'
    },
    watch: {
        client: {
          files: '<config:files.client.src>',
          tasks: 'hug:client'
        },
        monitor: {
          files: '<config:files.monitor.src>',
          tasks: 'hug:monitor'
        },
        styles: {
          files: './lib/client/styles/**/*',
          tasks: 'less concat:styles'
        },
        soyMonitor: {
          files: './lib/monitor/soy/**/*.soy',
          tasks: 'soy:monitor hug:monitor'
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
    test: {
      lib: '<config:files.test.server>'
    },
    soy : {
        monitor: {
            src: [ './lib/monitor/soy/**/*.soy' ],
            inputPrefix : '',
            outputPathFormat : './{INPUT_DIRECTORY}/{INPUT_FILE_NAME}.js',
            codeStyle : 'stringbuilder',
            locales : [],
            messageFilePathFormat : undefined,
            shouldGenerateJsdoc : false,
            shouldProvideRequireSoyNamespaces : false,
            compileTimeGlobalsFile : undefined,
            shouldGenerateGoogMsgDefs : false,
            bidiGlobalDir : 0, //accepts 1 (ltr) or -1 (rtl)

            // Options missing from documentation
            cssHandlingScheme : undefined, // 'literal', 'reference', 'goog'
            googMsgsAreExternal : false,
            isUsingIjData : undefined,
            messagePluginModule : undefined, //full class reference
            pluginModules: [], // array of full class reference strings.
            shouldDeclareTopLevelNamespaces : undefined,
            useGoogIsRtlForBidiGlobalDir : false,

            // classpath with which to run the compiler. Used in conjunction with messagePluginModule and pluginModules
            classpath : ''
        }
    },

    jshint: {
      server: {
        options: JSHINT_NODE
      },
      grunt: {
        options: JSHINT_NODE
      },
      client: {
        options: JSHINT_BROWSER
      },

      options: {
        quotmark: 'single',
        camelcase: true,
        strict: true,
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
  grunt.loadNpmTasks('grunt-soy');
  
  grunt.registerTask('build-js', 'soy hug');
  grunt.registerTask('build-css', 'less concat:styles');
  grunt.registerTask('build', 'build-js build-css');

  grunt.registerTask('build-dev', 'build');
  grunt.registerTask('build-release', 'build min');

  grunt.registerTask('default', 'clean:build build-release');
};