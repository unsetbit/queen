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
      client: ['client/lib/*.js', 'client/build_resource/module_prefix.js', 'client/src/*.js', 'client/build_resource/module_postfix.js'],
      styles: ['client/lib/*.css', 'client/styles/**/*.css'],
      grunt: ['grunt.js', 'tasks/*.js']
    },
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    concat: {
      dist: {
        src: ['<banner:meta.banner>', '<config:files.client>'],
        dest: 'client/static/<%= pkg.name %>.js'
      },
      styles: {
        src: ['<banner:meta.banner>', '<config:files.styles>'],
        dest: 'client/static/<%= pkg.name %>.css'
      }
    },
    min: {
      dist: {
        src: ['<banner:meta.banner>', '<config:concat.dist.dest>'],
        dest: 'client/static/<%= pkg.name %>.min.js'
      }
    },
    lint: {
      server: '<config:files.server>',
      client: '<config:files.client>',
      grunt: '<config:files.grunt>'
    },
    watch: {
        client: {
          files: '<config:files.client>',
          tasks: 'concat'
        },
        styles: {
          files: '<config:files.styles>',
          tasks: 'concat:styles'
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

  grunt.registerTask('default', 'concat');
};