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
        server: ['test/**/*.js']
      },
      client: {
        src: 'lib/client',
        srcFiles: 'lib/client/**/*'
      },
      styles: ['lib/client/styles/external/**/*.css', 'lib/client/styles/**/*.css']
    },
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    concat: {
      styles: {
        src: ['<banner:meta.banner>', '<config:files.styles>'],
        dest: 'static/<%= pkg.name %>.css'
      }
    },
    hug: {
      dist: {
        header: '<config:files.client.lib>',
        src: '<config:files.client.src>',
        dest: 'static/<%= pkg.name %>.js'
      }
    },
    min: {
      dist: {
        src: ['<banner:meta.banner>', '<config:hug.dist.dest>'],
        dest: 'build/<%= pkg.name %>.min.js'
      }
    },
    copy: {
      release: {
        files: {
          "build/release/": "static/**"
        }
      }
    },
    lint: {
      server: '<config:files.server>',
      client: '<config:files.client.srcFiles>'
    },
    watch: {
        client: {
          files: '<config:files.client.srcFiles>',
          tasks: 'hug'
        },
        styles: {
          files: '<config:files.styles>',
          tasks: 'concat:styles'
        }
    },
    clean: {
      build: ['./build/']
    },
    test: {
      lib: '<config:files.test.server>'
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
  
  grunt.registerTask('build-js', 'hug');
  grunt.registerTask('build-css', 'concat:styles');
  grunt.registerTask('build', 'build-js build-css');

  grunt.registerTask('build-dev', 'build');
  grunt.registerTask('build-release', 'build min copy:release');

  grunt.registerTask('default', 'clean:build build-release');
};