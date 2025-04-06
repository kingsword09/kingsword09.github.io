---
layout: post
title: Tauri 2.0 项目deno workspace管理依赖（1）
description: 记录使用deno workspace管理 Tauri 2.0 应用的依赖以及遇到的问题。
summary: 本文详细描述了如何使用deno workspace来管理Tauri 2.0应用的依赖，包括如何管理和发布JSR包和Crates包，以及遇到的各种问题如何解决。
tags: tauri2 coding deno
minute: 7
---

最近在开发 `Tauri 2.0` 应用时，需要开发自己的插件，但是插件开发需要使用 `TypeScript` 开发之后还需要打包才能使用，这很麻烦。于是想着要利用 `deno` 的能力，直接就可以将 `TypeScript` 包直接使用在前端项目中，最后统一打包就好了，而不需要多次打包，而且可以利用 `JSR` 发布 `deno` 包，这样之后不管是直接继续使用 `deno`，或者想改为使用 `node` 环境使用都能直接用。

#### 创建项目

##### 1. 初始化项目

`Tauri 2.0` 官方文档有提供使用 `deno` 进行初始化项目，即：

```bash
mkdir tauri2-deno-starter
cd tauri2-deno-starter
deno run -A npm:create-tauri-app
```

##### 2. 改造项目

按照官方指令创建出来的项目并不能直接利用 `deno workspace` 的功能来直接使用 `TypeScript` 代码在前端中使用。初始化出来的项目只是利用了 `deno install` 的能力安装依赖，实际上还是使用的 `package.json` 来管理依赖，而不是使用 `deno.json` 的方式管理依赖。

以创建前端项目为 `React + TypeScript` 为例：
(1) 在 `tauri2-deno-starter` 目录下创建 `deno.json` 管理全局依赖；

```json
{
  "nodeModulesDir": "auto",
  "workspace": [
    "./app" // 假设创建的 tauri 项目为 app
  ],
  "imports": {
    "@tauri-apps/api": "npm:@tauri-apps/api@^2",
    "@tauri-apps/cli": "npm:@tauri-apps/cli@^2"
  }
}
```

设置 `nodeModulesDir` 为 `auto` 是为了 deno 安装依赖时会生成 node_modules 目录。
`imports` 中添加 `@tauri-apps/api` 和 `@tauri-apps/cli` 依赖方便开发插件和应用时都可以使用。

(2) 迁移 `app` 为使用 `deno` 管理依赖
删除各种 `tsconfig` 文件和 `package.json` 文件，添加 `deno.json` 文件。
`app/deno.json` 文件如下：

```json
{
  "name": "@kingsword/app",
  "version": "0.1.0",
  "exports": {},
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "npm:react@^19.0",
    "jsxImportSourceTypes": "npm:@types/react@^19.0",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "tasks": {
    "dev": "deno run -A npm:vite",
    "build": "deno check src/main.ts && deno run -A npm:vite build",
    "preview": "deno run -A npm:vite preview",
    "tauri": "deno run -A npm:@tauri-apps/cli"
  },
  "imports": {
    "@deno/vite-plugin": "npm:@deno/vite-plugin@^1.0.0",
    "@vitejs/plugin-react": "npm:@vitejs/plugin-react",
    "react": "npm:react",
    "react-dom": "npm:react-dom",
    "react-router-dom": "npm:react-router-dom",
    "vite": "npm:vite@^6.0.3"
  }
}
```

修改 `vite.config.ts`

{: data-line="3,11"}

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import deno from "@deno/vite-plugin";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [
    deno(), //
    react(),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

(3) 创建完整项目结构
添加 `plugins` 目录用于管理 `Tauri 2.0` 的插件，添加 `packages` 目录用于管理前端工具 `TypeScript` 包。完整项目结构如下：

```text
tauri2-deno-starter/
├── app/                 # 应用主目录
│   ├── src/             # 前端源代码
│   └── src-tauri/       # Tauri相关配置和Rust代码
├── plugins/             # 自定义Tauri插件
├── packages/            # 自定义Deno TS包
├── deno.json            # Deno配置文件
```

#### 开发 `deno` 包

##### 1. 创建 lib

```bash
cd packages
deno init [package_name] --lib
```

##### 2. 添加到 `workspace`

`tauri2-deno-starter/deno.json`

{: data-line="5"}

```json
{
  "nodeModulesDir": "auto",
  "workspace": [
    "./app" // 假设创建的 tauri 项目为 app
    "./packages/[package_name]"
  ],
  "imports": {
    "@tauri-apps/api": "npm:@tauri-apps/api@^2",
    "@tauri-apps/cli": "npm:@tauri-apps/cli@^2"
  }
}
```

##### 3. 发布 `deno` 包

如果需要发布 deno 包，提供给 deno 和 npm 用户使用，则可以查看 [JSR](https://jsr.io) 的文档，发布指令为：

```bash
deno publish
```

#### 开发 `Tauri 2.0` 插件

##### 1. 创建插件

```bash
cd plugins
deno run -A npm:@tauri-apps/cli plugin new [plugin_name]
```

##### 2. 添加到 `workspace`

在 `tauri-plugin-[plugins_name]` 和 `tauri-plugin-[plugins_name]/examples/tauri-app` 下都要添加 `deno.json` 文件。
`tauri-plugin-[plugins_name]/deno.json`:

```json
{
  "name": "@kingsword/tauri-plugin-[plugins_name]-api",
  "version": "0.1.0",
  "exports": "./guest-js/index.ts"
}
```

`tauri-plugin-[plugins_name]/examples/tauri-app/deno.json` 则参考 `app/deno.json` 的设置，`examples/tauri-app` 中的修改也和 `app` 的修改一致，需要去掉 `tsconfig` 和 `package.json` 等。

`tauri2-deno-starter/deno.json`

{: data-line="5,6"}

```json
{
  "nodeModulesDir": "auto",
  "workspace": [
    "./app" // 假设创建的 tauri 项目为 app
    "./plugins/tauri-plugin-[plugins_name]",
    "./plugins/tauri-plugin-[plugins_name]/examples/tauri-app",
  ],
  "imports": {
    "@tauri-apps/api": "npm:@tauri-apps/api@^2",
    "@tauri-apps/cli": "npm:@tauri-apps/cli@^2"
  }
}
```

##### 3. 发布插件

发布插件通常需要将 `guest-js` 目录下的 `TypeScript` 包发布到 `JSR` 以及 `rust` 包发布到 `crates`，deno 包发布已经在前面解释过，也可看文档，rust 包则使用如下命令：

```bash
cargo publish

# 不要通过构建它们来验证内容则：
cargo publish --no-verify
```

#### 运行项目

到此可以运行桌面端程序了：

```bash
deno task --filter 'app' tauri dev
```

#### 添加移动端支持

如果需要添加移动端的支持，还需要创建移动端项目，即

##### 1. 初始化移动端项目

```bash
cd app
deno run -A npm:@tauri-apps/cli android init
deno run -A npm:@tauri-apps/cli ios init
```

##### 2. 添加到 `workspace`

在 `android` 目录下添加 `deno.json`

```json
{
  "name": "@kingsword/app-android",
  "exports": {},
  "tasks": {
    "tauri": "deno run -A npm:@tauri-apps/cli"
  }
}
```

在 `apple` 目录下添加 `deno.json`

```json
{
  "name": "@kingsword/app-ios",
  "exports": {},
  "tasks": {
    "tauri": "deno run -A npm:@tauri-apps/cli"
  }
}
```

之后在 `tauri2-deno-starter/deno.json` 中添加即可：

{: data-line="5,6"}

```json
{
  "nodeModulesDir": "auto",
  "workspace": [
    "./app" // 假设创建的 tauri 项目为 app
    "./app/src-tauri/gen/android",
    "./app/src-tauri/gen/ios"
  ],
  "imports": {
    "@tauri-apps/api": "npm:@tauri-apps/api@^2",
    "@tauri-apps/cli": "npm:@tauri-apps/cli@^2"
  }
}
```

##### 3. 运行移动端项目

```bash
# android
deno task --filter 'app' tauri android dev

# ios
deno task --filter 'app' tauri ios dev
```

以上就是开发一个使用 `deno workspace` 来管理 `Tauri 2.0` 应用依赖的过程。

<br/><br/><br/>

#### 参考文档

- [Tauri 官方文档](https://v2.tauri.app/)
- [deno 官方文档](https://deno.com)
- [jsr publish](https://jsr.io/docs/publishing-packages)
- [cargo publish](https://doc.rust-lang.org/cargo/commands/cargo-publish.html)
- [tauri2-deno-starter](https://github.com/kingsword09/tauri2-deno-starter)
