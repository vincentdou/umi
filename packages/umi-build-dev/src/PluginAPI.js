import debug from 'debug';
import assert from 'assert';
import isPlainObject from 'is-plain-object';
import { winPath, findJS, findCSS } from 'umi-utils';
import registerBabel, { addBabelRegisterFiles } from './registerBabel';

export default class PluginAPI {
  constructor(id, service) {
    this.id = id;
    this.service = service;
    this.debug = debug(`umi-plugin: ${id}`);
    this.winPath = winPath;
    this.findJS = findJS;
    this.findCSS = findCSS;

    this.API_TYPE = {
      ADD: Symbol('add'),
      MODIFY: Symbol('modify'),
      EVENT: Symbol('event'),
    };

    this._addMethods();
  }

  _addMethods() {
    this.registerMethod('chainWebpackConfig', {
      type: this.API_TYPE.EVENT,
    });
    this.registerMethod('_registerConfig', {
      type: this.API_TYPE.ADD,
    });

    [
      [
        'chainWebpackConfig',
        {
          type: this.API_TYPE.EVENT,
        },
      ],
      [
        '_registerConfig',
        {
          type: this.API_TYPE.ADD,
        },
      ],
      'onStart',
      'onDevCompileDone',
      'onBuildSuccess',
      'onBuildFail',
      'addPageWatcher',
      'addEntryImport',
      'addEntryImportAhead',
      'addRendererWrapperWithComponent',
      'addRouterImport',
      'addRouterImportAhead',
      'modifyAFWebpackOpts',
      'modifyEntryRender',
      'modifyEntryHistory',
      'modifyRouterRootComponent',
    ].forEach(method => {
      if (Array.isArray(method)) {
        this.registerMethod(...method);
      } else {
        let type;
        if (method.indexOf('modify') === 0) {
          type = this.API_TYPE.MODIFY;
        } else if (method.indexOf('add') === 0) {
          type = this.API_TYPE.ADD;
        } else if (
          method.indexOf('on') === 0 ||
          method.indexOf('before') === 0 ||
          method.indexOf('after') === 0
        ) {
          type = this.API_TYPE.ADD;
        } else {
          throw new Error(`unexpected method name ${method}`);
        }
        this.registerMethod(method, { type });
      }
    });
  }

  register(hook, fn) {
    assert(
      typeof hook === 'string',
      `The first argument of api.register() must be string, but got ${hook}`,
    );
    assert(
      typeof fn === 'function',
      `The second argument of api.register() must be function, but got ${fn}`,
    );
    const { pluginHooks } = this.service;
    pluginHooks[hook] = pluginHooks[hook] || [];
    pluginHooks[hook].push({
      fn,
    });
  }

  registerCommand(name, opts, fn) {
    const { commands } = this.service;
    if (typeof opts === 'function') {
      fn = opts;
      opts = null;
    }
    assert(
      !(name in commands),
      `Command ${name} exists, please select another one.`,
    );
    commands[name] = { fn, opts: opts || {} };
  }

  registerPlugin(opts) {
    assert(isPlainObject(opts), `opts should be plain object, but got ${opts}`);
    const { id, apply } = opts;
    assert(id && apply, `id and apply must supplied`);
    assert(typeof id === 'string', `id must be string`);
    assert(typeof apply === 'function', `apply must be function`);
    assert(
      id.indexOf('user:') !== 0 && id.indexOf('built-in:') !== 0,
      `api.registerPlugin() should not register plugin prefixed with user: and built-in:`,
    );
    assert(
      Object.keys(opts).every(key => ['id', 'apply', 'opts'].includes(key)),
      `Only id, apply and opts is valid plugin properties`,
    );
    this.service.extraPlugins.push(opts);
  }

  registerMethod(name, opts) {
    assert(!this[name], `api.${name} exists.`);
    assert(opts, `opts must supplied`);
    const { type, apply } = opts;
    assert(!(type && apply), `Only be one for type and apply.`);
    assert(type || apply, `One of type and apply must supplied.`);

    this.service.pluginMethods[name] = (...args) => {
      if (apply) {
        this.register(name, opts => {
          return apply(opts, ...args);
        });
      } else if (type === this.API_TYPE.ADD) {
        this.register(name, opts => {
          return (opts.memo || []).concat(
            typeof args[0] === 'function'
              ? args[0](opts.memo, opts.args)
              : args[0],
          );
        });
      } else if (type === this.API_TYPE.MODIFY) {
        this.register(name, opts => {
          return typeof args[0] === 'function'
            ? args[0](opts.memo, opts.args)
            : args[0];
        });
      } else if (type === this.API_TYPE.EVENT) {
        this.register(name, opts => {
          args[0](opts.args);
        });
      } else {
        throw new Error(`unexpected api type ${type}`);
      }
    };
  }

  addBabelRegister(files) {
    assert(
      Array.isArray(files),
      `files for registerBabel must be Array, but got ${files}`,
    );
    addBabelRegisterFiles(files);
    registerBabel({
      cwd: this.service.cwd,
    });
  }
}
