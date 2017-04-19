'use strict';

const path = require('path');
const handlebars = require('handlebars');
const PaniniEngine = require('../lib/engine');

/**
 * Panini engine to render Handlebars templates.
 */
class HandlebarsEngine extends PaniniEngine {
  /**
   * Create a new engine instance.
   * @param {object} options - Panini options.
   */
  constructor(options) {
    super(options);
    this.engine = handlebars.create();
    this.compilerOpts = {
      preventIndent: true
    };

    this.engine.registerDecorator('block', program => {
      console.log(program());
    });
  }

  /**
   * Load layouts, partials, helpers, and data.
   * @returns {Promise} Promise which resolves when setup is done.
   */
  setup() {
    const mapFiles = PaniniEngine.mapFiles;
    const mapPaths = PaniniEngine.mapPaths;
    const extensions = '**/*.{html,hbs,handlebars}';
    this.layouts = {};

    return Promise.all([
      super.setup(),
      mapFiles(this.options.input, this.options.layouts, extensions, (filePath, contents) => {
        const name = path.basename(filePath, path.extname(filePath));
        this.layouts[name] = contents;
      }),
      mapFiles(this.options.input, this.options.partials, extensions, (filePath, contents) => {
        const name = path.relative(
          path.join(process.cwd(), this.options.input, this.options.partials),
          filePath
        ).replace(/\..*$/, '');
        this.engine.registerPartial(name, contents + '\n');
      }),
      mapPaths(this.options.input, this.options.helpers, '**/*.js', filePath => {
        const name = path.basename(filePath, '.js');

        try {
          if (this.engine.helpers[name]) {
            delete require.cache[require.resolve(filePath)];
            this.engine.unregisterHelper(name);
          }

          const helper = require(filePath);
          this.engine.registerHelper(name, helper);
        } catch (err) {
          console.warn('Error when loading ' + name + '.js as a Handlebars helper.');
        }
      })
    ]);
  }

  /**
   * Render a Handlebars page and layout.
   * @param {String} pageBody - Handlebars template string.
   * @param {Object} pageData - Handlebars context.
   * @param {Object} file - Vinyl source file.
   * @returns {String} Rendered page.
   */
  render(pageBody, pageData, file) {
    const layout = this.layouts[pageData.layout];

    try {
      if (!layout) {
        if (pageData.layout === 'default') {
          throw new Error('You must have a layout named "default".');
        } else {
          throw new Error(`No layout named "${pageData.layout}" exists.`);
        }
      }

      const page = layout.replace(/{{> ?body ?}}/, pageBody);
      const template = this.engine.compile(page, this.compilerOpts);

      return template(pageData);
    } catch (err) {
      return this.error(err, file.path);
    }
  }
}

HandlebarsEngine.features = ['layouts', 'partials', 'helpers'];

module.exports = HandlebarsEngine;
