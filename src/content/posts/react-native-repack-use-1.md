---
title: "React Native 使用 Repack 创建项目（1）"
description: "记录使用repack创建react native项目。"
summary: "本文详细描述了repack创建react native项目以及在创建项目的过程中遇到的问题和解决方式。"
tags:
  - react-native
  - coding
  - repack
minute: 3
pubDate: "2025-03-30"
---

#### 1. 创建项目

最近在使用 [Repack](https://github.com/callstack/repack) 创建 `react native` 项目。

由于 `react native` 项目都默认是 `yarn` 的支持更好，但是我想要使用 `pnpm` 初始化这个项目，即：

```bash
# repack 5.0.5
pnpm dlx @callstack/repack-init
```

#### 2. 安装依赖

创建完之后使用 `pnpm i` 安装以来之后，启动项目会失败，缺少了很多依赖，需要自行安装依赖才行。

缺少了以下依赖：

```bash
@react-native/gradle-plugin
@react-native/codegen
babel-plugin-syntax-hermes-parser
@babel/plugin-syntax-typescript
@react-native/babel-plugin-codegen
```

之后使用 `pnpm add -D` 安装这些依赖就行了。

#### 3. 运行

###### 1. Android

```bash
pnpm android
```

###### 2. iOS

```bash
# 安装 cocoapods 依赖
pnpm dlx pod-install

# 运行
pnpm ios
```

#### 4. QA

###### 1. 使用 `Android Studio` 打开 `android` 目录出现 `Cannot run program "node"` 异常时怎么解决？

（1）查询 `node` 指令位置

```bash
which node
```

（2）替换 `node_modules/@callstack/repack/android/build.gradle` 中的 `node` 指令

```diff
- commandLine("node", "--print", "require.resolve('react-native/package.json')")
# 比如 node 位置是 /usr/local/bin/node
+ commandLine("/usr/local/bin/node", "--print", "require.resolve('react-native/package.json')")
```

###### 2. 出现 `Missing ExternalProject for :` 异常？

替换 `android/settings.gradle` 中的如下内容：

```diff
- pluginManagement { includeBuild("../node_modules/@react-native/gradle-plugin") }
+ pluginManagement { includeBuild(file('../node_modules/@react-native/gradle-plugin').toPath().toRealPath().toAbsolutePath().toString()) }

- includeBuild('../node_modules/@react-native/gradle-plugin')
+ includeBuild(file('../node_modules/@react-native/gradle-plugin').toPath().toRealPath().toAbsolutePath().toString())
```

<br/><br/><br/>

#### 参考文档

- [React Native 官方文档](https://reactnative.dev/)
- [repack](https://re-pack.dev/)
- [Missing ExternalProject for :](https://github.com/react-native-community/cli/issues/1207#issuecomment-2232732690)
