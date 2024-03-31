# Research for API design

## Thread-unsafe usage patterns

### (A1) Metadata of a module

An example for this is the content of a CSS file after the content is removed. `vite:css-post` removes the CSS file content in `transform` hook and generated a new file with `this.emitFile` to extract CSS content into a CSS file. Because this data is coupled with a specific module, it doesn't need to be shared among all threads. It only needs to be shared with a thread that processes that module. In this case, using [module `meta`](https://rollupjs.org/plugin-development/#custom-module-meta-data) is suitable. It has more limited flexibility than a shared cache, but that means there's more opportunity for optimization. It is worth noting that in many of these cases, data is written by the Build Hooks and read by the Output Generation Hooks.

Examples: `moduleCache` in `vite:css`/`vite:css-post`/`vite:css-analysis`, `styles` in `vite:css-post`, `resolved` in `vite:data-uri`/`@rollup/plugin-data-uri`, `htmlProxyMap`/`htmlProxyResult` in `vite:html`, `isAsyncScriptMap` in `vite:build-html`, `workerCache` in `vite:worker`/`vite:worker-import-meta-url`, `idToPackageInfo` in `@rollup/plugin-node-resolve`, `cssMap` in `ssr-styles`(nuxt), `generatedImages` in `vite-imagetools`, `tempFiles` in `vuetify:styles`, `extracted` in `rollup-plugin-postcss`, `dirs` in `rollup-plugin-polyfill-node`, `styles` in `rollup-plugin-import-css`, `extracted` in `rollup-plugin-styles`

#### (A1a) Creating a module list

Some plugins creates a list of modules in `transform` hook and uses that in `generateBundle` hook. For example, `vite:build-html` creates a list of HTML files and `@rollup/plugin-wasm` creates a list of Wasm files.
This is possible to achieve by module `meta`, but it requires traversing all modules to get the list of module with that meta. It might be better to have an API that can get all modules with a specified metadata.

Examples: `processedHtml` in `vite:build-html`, `copies` in `@rollup/plugin-url`/`@rollup/plugin-wasm`, `facadeToLegacyChunkMap`/`facadeToLegacyChunkMap`/`facadeToModernPolyfillMap` in `@vitejs/plugin-legacy`, `workerFiles` in `rollup-plugin-off-the-main-thread`

### (A2) Metadata of a chunk

An example of this is the CSS content associated with the chunk. Because this data is coupled with a specific chunk, it doesn't need to be shared among all threads. It only needs to be shared with a thread that processes that chunk. In this case, storing it in the chunk variable like [`chunk.viteMetadata`](https://github.com/vitejs/vite/blob/f1e67b6bdba07ce156ad4a8cb3b894603993ccd8/packages/vite/src/node/plugins/metadata.ts#L11-L14) is suitable.

Examples: `pureCssChunks` in `vite:css-post`, `chunkCSSMap` in `vite:css-post`

### (A3) Metadata of an emitted file

An example of this is the original file name of the emitted file. Because this data is coupled with an emitted file, it doesn't need to be shared among all threads. It only needs to be shared with a thread that processes that emitted file.

Example: `generatedAssets` in `vite:asset`

### (A4) Listening to events

An event will be broadcasted over all threads, so the plugin need to handle it only on a single thread. We need to expose a worker thread number so that the plugin can only listen on a single thread.

Example: `server.watcher.on` usage in `@sveltejs/vite-plugin-svelte`

### (A5) Data that expects to be shared

Adding an API to handle shared state can cover these patterns. It is worth noting that in all of these cases, data is not shared among multiple plugins.

Examples:

- `VitePluginSvelteStats` in `@sveltejs/vite-plugin-svelte`
  - It needs to aggregate the data among all threads.
- `browserMapCache` in `@rollup/plugin-node-resolve`
  - This can be simply be thread safe if it gets the actual value when the cache didn't have a value. Another way is to use module `meta`.
- `currentlyResolving` in `@rollup/plugin-commonjs`
  - I guess it's not thread safe. I have to read the commonjs plugin further to understand how it's used.

#### (A5a) Variables to dedupe something

Examples:

- `hasEmitted` in `vite:css-post`
  - This variable is used to only output a file once among different output formats. If there's a way to store data associated to the whole bundle instance, it can be thread safe.
- `manifest` in `vite:manifest`
  - This is similar to `hasEmitted` in `vite:css-post`. This variable is used to collect data from all bundles and output that data once on the last processed bundle.
- `warnCache` in `ssr-styles`(nuxt)
  - This Map is used to output the same warning only once. Vite's `logger` has `warnOnce` method, but Rollup only have `this.warn`.

#### (A5b) Single file component related

Examples:

- `astroFileToCompileMetadataWeakMap` in `astro:build`
  - It seems it needs to be shared: https://github.com/withastro/astro/blob/498866c8f244144a670546d9261d76ca1c290251/packages/astro/src/vite-plugin-astro/index.ts#L71-L73
- `cache`(SFC Descriptor cache)/`hmrCache`/`prevCache`/`clientCache`(script block cache)/`ssrCache`/`typeDepToSFCMap` in `@vitejs/plugin-vue`, `VitePluginSvelteCache` in `@sveltejs/vite-plugin-svelte`, `transformedOutputs` in `@builder.io/qwik`, `cachedSources` in `@marko/vite`
  - plugin-vue heavily relies on the fact that it runs in a single thread and uses cache in many places. For example, `handleHotUpdate` uses the previous descriptor and the current descriptor. In this `handleHotUpdate` case, the same file needs to be always handled by the same worker to work. Another way is to storing the descriptor to the module `meta`; this only works if the descriptor is serializable though.

### (A6) Plugins that runs heavy thread-unsafe functions

ESLint and TypeScript are heavy, but cannot be parallelized efficiently. I guess running it in all threads will cause many duplicated work without not much improvement. In this case, I guess running in a single thread different from the main thread is effective. That would avoid duplicated work and reduce precious main thread CPU time.

Examples: `ESLint` in `@rollup/plugin-eslint`/`vite-plugin-eslint`, TypeScript in `@rollup/plugin-typescript`/`vite-plugin-dts`/`@joshwooding/vite-plugin-react-docgen-typescript`/`rollup-plugin-typescript2`/`rollup-plugin-dts`, vanilla-extract compiler in `@vanilla-extract/vite-plugin`, unocss context in `@unocss/vite`

### (A7) Direct plugin communication ([`api.*`](https://rollupjs.org/plugin-development/#direct-plugin-communication))

There's two ways of using `api.*`. The first way is to expose a function or data under `api` and let other plugins access that. The second way is to tell other plugins to expose a function or data under `api` and access all plugins with that.

Examples:

- `api.reactBabel` in `@vitejs/plugin-react`
  - plugin-react reads `api.reactBabel` method from all plugins. This method is used to manipulate babel options at module granularity. The method set by other plugins might be non thread safe.
- `api.options` in `@sveltejs/vite-plugin-svelte`
  - plugin-svelte allows the options to be changed by other plugins. It has a comment that this is only intended to be used for plugins in the same monorepo.
- `api.sveltePreprocess` in `@sveltejs/vite-plugin-svelte`
  - plugin-svelte reads `api.sveltePreprocess` object from all plugins. https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/faq.md#how-do-i-add-a-svelte-preprocessor-from-a-vite-plugin
- `api.*` in `@builder.io/qwik`/`@builder.io/qwik-city`
  - qwik exposes many functions under `api`.
- `api.rakkas.*` in rakkas
  - It's called by rakkas: https://github.com/rakkasjs/rakkasjs/blob/d2c08c79007256366b3e03fc9542538d1681d507/packages/rakkasjs/src/vite-plugin/rakkas-plugins.ts#L7-L40

### (A8) Config with non-serializable values

Serializable values can be simply passed among threads, but non-serializable values (e.g. class, functions) are not. We can convert it into proxy objects, but I guess that would require complicated thread scheduling and increase parallelization overhead.

Examples: postcss plugins, babel plugins, functions in config, functions in plugin options

### (A9) Wrapping plugins

`vite-plugin-inspect` wraps all the plugins. This is not possbile with parallel JS plugins and rust builtin plugins. I'm not sure how we can provide a way to inspect plugins without making it builtin.

### (A10) Vite core related things
#### (A10a) Vite specific hooks

Plugins often use [Vite specific hooks](https://vitejs.dev/guide/api-plugin.html#vite-specific-hooks) that doesn't exist in Rollup. Rolldown needs a way to run those hooks, otherwise plugins using Vite specific hooks cannot be a parallel JS plugin.

Vite specific hooks: `config`, `configResolved`, `configureServer`, `configurePreviewServer`, `transformIndexHtml`, `handleHotUpdate`

#### (A10b) asset cache

[`assetCache`](https://github.com/vitejs/vite/blob/f1e67b6bdba07ce156ad4a8cb3b894603993ccd8/packages/vite/src/node/plugins/asset.ts#L40) in `vite:asset` is difficult to make it thread safe in an easy way, because it requires sharing the state not only among the threads but also among multiple plugins. But this variable is highly intergrated to Vite core and I believe we don't need to consider this pattern that much. Also I guess we can use the `import.meta.ROLLUP_FILE_URL` feature in future.

#### (A10c) module graph

The module graph needs to be shared across the whole hooks/plugins. If we can put this in rolldown side, I guess it's not that difficult to make it possbile to access from parallel JS plugins.

#### (A10d) dep optimizer

If we are going to make Vite internal plugins a parallel JS plugin, we'll need to make dep optimizer to be able to shared in multiple threads. I guess it's possbile by providing [channels](https://doc.rust-lang.org/std/sync/mpsc/fn.channel.html), but I guess we would just migrate the plugin to rust when Vite gets rustified.

## Thread-safe usage patterns that are worth noting

### (B1) A cache that can be stored separately but better to be shared

An example of these kinds of cache is a cache of which tsconfig is used in that file and what the resolved value of that tsconfig will be.
In this case, it's fine to store the cache separately in each thread. Even if a value didn't exist in the cache, the plugin will check if the actual value and store that value in the cache. So it might fetch a same value for all threads in worst case scenario. If the overhead of sharing the value among threads is negligible (e.g. fetching the actual value takes time), it's better to have a shared cache.

Examples: `tsconfckCache` in `vite:esbuild`/`vite:esbuild-transpile`, `packageInfoCache` in `@rollup/plugin-node-resolve`, `assetsGeneratorContext.cache` in `vite-plugin-pwa`, `fileMap` in `vite-plugin-static-copy`, `mtimeCache` in `vite-plugin-compression`, `shareName2Prop` in `vite-plugin-federation`, `cache` in `vite-plugin-svg-icons`, `cache`(tsconfig) in `rollup-plugin-esbuild`

### (B2) A maps storing HMR dependencies

For example, if file `a.ts` should be reloaded if files in `./foo` directory is modified, the map has `"a.ts": "./foo"`. The plugin check the map when [`handleHotUpdate` hook](https://vitejs.dev/guide/api-plugin.html#handlehotupdate) is called. This is thread safe and doesn't require sharing states if `handleHotUpdate` hook is called in all threads.

Examples: `config.dynamicRoutes.fileToModulesMap` in `vitepress:dynamic-routes`, `depToLoaderModuleIdMap`/`idToLoaderModulesMap` in `vitepress:data`, `modulesById` in `iles:documents`

## The whole list of the plugins I checked

<details>

- [vite internal plugins](https://github.com/vitejs/vite/tree/f1e67b6bdba07ce156ad4a8cb3b894603993ccd8/packages/vite/src/node/plugins)
- [rollup official plugins](https://github.com/rollup/plugins)
- vite official plugins
  - [@vitejs/plugin-legacy](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy)
  - [@vitejs/plugin-vue](https://github.com/vitejs/vite-plugin-vue)
  - [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)
  - [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc)
  - [@vitejs/plugin-basic-ssl](https://github.com/vitejs/vite-plugin-basic-ssl)
- frameworks official plugins
  - [@sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)
  - [vite-plugin-solid](https://github.com/solidjs/vite-plugin-solid)
  - [@preact/preset-vite](https://github.com/preactjs/preset-vite)
  - [@builder.io/qwik](https://github.com/BuilderIO/qwik/blob/main/packages/qwik/src/optimizer/src/plugins/vite.ts)
  - [@marko/vite](https://github.com/marko-js/vite)
- metaframeworks internal plugins
  - [@nuxt/vite-builder](https://github.com/nuxt/nuxt/tree/main/packages/vite/src/plugins)
  - [@sveltejs/enhanced-img](https://github.com/sveltejs/kit/tree/main/packages/enhanced-img)
  - [astro](https://github.com/withastro/astro/tree/main/packages/astro/src)
  - [vitepress](https://github.com/vuejs/vitepress/tree/main/src/node/plugins)
  - [rakkasjs](https://github.com/rakkasjs/rakkasjs/tree/main/packages/rakkasjs/src/vite-plugin)
  - [iles](https://github.com/ElMassimo/iles/tree/main/packages/iles/src/node/plugin)
  - [vike](https://github.com/vikejs/vike/tree/main/vike/node/plugin/plugins)
  - [@builder.io/qwik-city](https://github.com/BuilderIO/qwik/tree/main/packages/qwik-city/buildtime/vite)
- other plugins
  - vite plugins
    - [vite-imagetools](https://github.com/JonasKruckenberg/imagetools)
    - [vite-plugin-dts](https://github.com/qmhc/vite-plugin-dts)
    - [vite-plugin-svgr](https://github.com/pd4d10/vite-plugin-svgr)
    - [vite-plugin-checker](https://github.com/fi3ework/vite-plugin-checker)
    - [vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect)
    - [vite-plugin-eslint](https://github.com/gxmari007/vite-plugin-eslint)
    - [vite-plugin-react-docgen-typescript](https://github.com/joshwooding/vite-plugin-react-docgen-typescript)
    - [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)
    - [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html)
    - [@sentry/vite-plugin](https://github.com/getsentry/sentry-javascript-bundler-plugins/tree/main/packages/vite-plugin)
    - [vite-plugin-css-injected-by-js](https://github.com/marco-prontera/vite-plugin-css-injected-by-js)
    - [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy)
    - [vite-plugin-full-reload](https://github.com/ElMassimo/vite-plugin-full-reload)
    - [vite-plugin-vue-inspector](https://github.com/webfansplz/vite-plugin-vue-inspector)
    - [vite-svg-loader](https://github.com/jpkleemans/vite-svg-loader)
    - [vite-plugin-vuetify](https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin)
    - [vite-plugin-istanbul](https://github.com/ifaxity/vite-plugin-istanbul)
    - [@originjs/vite-plugin-*](https://github.com/originjs/vite-plugins/tree/main/packages)
    - [vite-plugin-node-polyfills](https://github.com/davidmyersdev/vite-plugin-node-polyfills)
    - [vite-plugin-compression](https://github.com/vbenjs/vite-plugin-compression)
    - [vite-plugin-mkcert](https://github.com/liuweiGL/vite-plugin-mkcert)
    - [@intlify/unplugin-vue-i18n](https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n)
    - [vite-plugin-rails, vite-plugin-ruby](https://github.com/ElMassimo/vite_ruby)
    - [laravel-vite-plugin](https://github.com/laravel/vite-plugin)
    - [vite-plugin-environment](https://github.com/ElMassimo/vite-plugin-environment)
    - [vite-plugin-ejs](https://github.com/trapcodeio/vite-plugin-ejs)
    - [@vanilla-extract/vite-plugin](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/vite-plugin)
    - [@unocss/vite](https://github.com/unocss/unocss/tree/main/packages/vite)
    - [rollup-plugin-node-externals](https://github.com/Septh/rollup-plugin-node-externals)
    - [vite-plugin-externals](https://github.com/crcong/vite-plugin-externals)
    - [vite-plugin-dynamic-import](https://github.com/vite-plugin/vite-plugin-dynamic-import)
    - [@originjs/vite-plugin-federation](https://github.com/originjs/vite-plugin-federation)
    - [vite-plugin-top-level-await](https://github.com/Menci/vite-plugin-top-level-await)
    - [vite-plugin-style-import](https://github.com/vbenjs/vite-plugin-style-import)
    - [vite-plugin-commonjs](https://github.com/vite-plugin/vite-plugin-commonjs)
    - [vite-plugin-lib-inject-css](https://github.com/emosheeep/vite-plugin-lib-inject-css)
    - [@quasar/vite-plugin](https://github.com/quasarframework/quasar/tree/dev/vite-plugin)
    - [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
    - [vite-plugin-babel-macros](https://github.com/itsMapleLeaf/vite-plugin-babel-macros)
    - [vite-plugin-svg-icons](https://github.com/vbenjs/vite-plugin-svg-icons)
    - [vite-plugin-monaco-editor](https://github.com/vdesjs/vite-plugin-monaco-editor)
    - [vite-plugin-env-compatible](https://github.com/IndexXuan/vite-plugin-env-compatible)
  - rollup plugins
    - [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer)
    - [rollup-plugin-typescript2](https://github.com/ezolenko/rollup-plugin-typescript2)
    - [rollup-plugin-postcss](https://github.com/egoist/rollup-plugin-postcss)
    - [rollup-plugin-dts](https://github.com/Swatinem/rollup-plugin-dts)
    - [rollup-plugin-off-main-thread](https://github.com/surma/rollup-plugin-off-main-thread)
    - [rollup-plugin-copy](https://github.com/vladshcherbin/rollup-plugin-copy)
    - [@svgr/rollup](https://github.com/gregberge/svgr)
    - [rollup-plugin-esbuild](https://github.com/egoist/rollup-plugin-esbuild)
    - [rollup-plugin-polyfill-node](https://github.com/FredKSchott/rollup-plugin-polyfill-node)
    - [rollup-plugin-import-css](https://github.com/jleeson/rollup-plugin-import-css)
    - [rollup-plugin-styles](https://github.com/Anidetrix/rollup-plugin-styles)
    - [rollup-plugin-gzip](https://github.com/kryops/rollup-plugin-gzip)

</details>

## API design draft

### Plugin Usage
Users needs to write config like:
```ts
// rolldown.config.js
import json from '@rollup/plugin-json'
import threadSafe from 'my-threadsafe-plugin'

export default {
  plugins: [json(), threadSafe({ foo: 'foo' })]
}
```
Plugin authors will write the plugin like:
```ts
// my-thread-safe-plugin
import { defineThreadSafePlugin } from 'rolldown/plugin'
import type { Options } from './plugin-implementation.js'

export default defineThreadSafePlugin<Options>('./plugin-implementation.js')

// my-thread-safe-plugin/plugin-implementation.ts
import type { SharedState } from 'rolldown'
import type { ThreadSafePlugin, Context } from 'rolldown/plugin'
export type Options = { foo: string }

export default (Options: Options, context: Context): ThreadSafePlugin => {
  return { /* same as normal plugins but with some limitations */ }
}
```
Internal implementation will be:
```ts
// rolldown/plugin
type PluginInstantiateOpts = {
  /**
   * Whether multiple threads should be used.
   * Useful for plugins using (A6) pattern.
   * 
   * @default false
   */
  onlySingle?: boolean
}

export function defineThreadSafePlugin<Options>(
  pluginPath: string,
  opts: PluginInstantiateOpts
) {
  return (options: Options) => {
    return { _threadSafe: { path: pluginPath, options, opts } }
  }
}

export type ThreadSafePlugin = Rollup.Plugin

export type Context = {
  /**
   * Thread number
   * Useful for plugins using (A4) pattern. Also useful for plugins that does sideeffectful things and only want to do that once.
   */
  threadNumber: number

  /**
   * Explained later
   */
  createSharedState: <K, V>(key: string) => SharedState<K, V>
}
```

### Plugin hooks

Some hooks will be called in all threads for a single plugin and some hooks will be only called in a single thread. For example, `configResolved` hook should be called in all threads to tell the config for all threads.

- Called in single thread: `load`, `moduleParsed`, `onLog`, `options`, `resolveDynamicImport`, `resolveId`, `shouldTransformCachedModule`, `transform`, `augmentChunkHash`, `banner`, `footer`, `intro`, `outputOptions`, `outro`, `renderChunk`, `renderDynamicImport`, `resolveFileUrl`, `resolveImportMeta`, `config`, `transformIndexHtml`
- Called in all threads: `buildStart`, `buildEnd`, `closeWatcher`, `watchChange`, `closeBundle`, `generateBundle`, `renderError`, `renderStart`, `writeBundle`, `configResolved`, `handleHotUpdate`
- Not supported hooks in parallel plugins: `configureServer`, `configurePreviewServer`

`configureServer` and `configurePreviewServer` is difficult to support and `server` is not used other than `server.moduleGraph`. I think we don't need to support this if we add a way to access `moduleGraph` in other ways.

### Metadata related functionality

- Make sure [module `meta`](https://rollupjs.org/plugin-development/#custom-module-meta-data) works with parallel plugins. This is useful for plugins using (A1) pattern.
- Make sure chunk meta works with parallel plugins. This is useful for plugins using (A2) pattern. Maybe we can add `meta` property to `RenderedChunk` type.
- Add `meta` property to `this.emitFile` and add `this.getEmittedFileMeta(refId: string)` to plugin context. This is useful for plugins using (A3) pattern.
- Add `this.getModuleIdsWithMeta(propertyName: string): string[]` to plugin context. This is useful for plugins using (A1a) pattern.

### An API that allows a plugin to share states among threads
```ts
// my-thread-safe-plugin/plugin-implementation.ts
import { SharedState } from 'rolldown'
import { resolve } from 'heavy-resolve'

export default (Options: Options, context: Context): ThreadSafePlugin => {
  const resolveCache = context.createSharedState<string, string>('resolve')

  return {
    name: 'my-thread-safe-plugin',
    resolveId(id: string, importer?: string) {
      if (id.startsWith('my:')) {
        const key = id.slice('my:'.length)
        const result = await resolveCache.getOrFallback(key, () => {
          return await resolve(key)
        })
        return result
      }
    }
  }
}
```
```rust
#[napi]
pub struct SharedState {
  hashmap: Arc<DashMap<String, String>>
}

#[napi]
impl SharedState {
  pub fn new(plugin_id: &str, name: &str) -> Self {
    let hashmap = Arc::clone(PLUGIN_SHARED_STATE.get_or_create(plugin_id, name));
    Self { hashmap }
  }

  #[napi]
  pub async fn get(key: String) -> Option<String> { /* ... */ }

  #[napi]
  pub async fn get_or_fallback(key: String, fallback: JSFunction) -> String {
    let entry = self.hashmap.entry(key);
    match entry {
      Entry::Occupied(ref o) => o.get(),
      Entry::Vacant(v) => v.insert(fallback.callAsync().await)
    }
  }

  #[napi]
  pub async fn delete(key: String) -> Option<String> { /* ... */ }
}
```

This is useful for plugins using (A5) or (B1) pattern.

## Open questions

I've not thought about these yet. I'm going to think about it.

- How can we handle (A7) pattern in parallel plugins? Also for builtin rust plugins.
- How can we handle (A8) pattern?
- How can we handle (A9) pattern?
- How can Vite use Rolldown? ((A10) pattern)
- How well does [environment API](https://github.com/vitejs/vite/pull/16089) work with parallel plugins?
