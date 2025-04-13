---
layout: post
title: Tauri 2.0 插件开发踩坑记录（3）
description: 记录在Tauri 2.0插件开发中变量命名导致的异常问题。
summary: 本文详细介绍了Tauri 2.0插件开发中遇到的因为变量命名导致的问题，以及开发插件用于Android应用内授权安装应用出现的问题和解决方案。
tags: tauri2 coding
minute: 2
---

最近使用 `Tauri 2.0` 封装 `web` 前端为 `app` 时，有个需求就是在 `Android` 应用内授权安装应用，但是在开发过程中遇到了一些问题，本文将详细介绍这些问题以及解决方案。

假设要开发的插件为: [tauri-plugin-android-package-install](https://github.com/kingsword09/tauri-plugins-workspace/tree/main/packages/tauri-plugin-android-package-install)。

在 `TypeScript` 的接口定义中就可以以下面的方式进行定义：
`guest-js/index.ts`：

```ts
import { invoke } from "@tauri-apps/api/core";
export async function install(installPath: string): Promise<void> {
  await invoke("plugin:android-package-install|install", {
    installPath,
  });
}
```

在 `Rust` 中定义的命令如下：

```rust
#[command]
pub(crate) async fn install<R: Runtime>(app: AppHandle<R>, install_path: String) -> Result<()> {
  app.android_package_install().install(install_path)
}
```

在这里就遇到了第一个问题：因为 `Rust` 中定义的参数名是 `install_path`，则 `TypeScript` 中定义必须使用 `installPath`，即 `invoke` 的 `args` 参数名必须使用 `installPath`，否则会出现以下错误：

```shell
Msg: Uncaught (in promise) invalid args `installPath` for command `install`: command install missing required key installPath
```

代码如下：

```ts
// ❌错误
import { invoke } from "@tauri-apps/api/core";
export async function install(install_path: string): Promise<void> {
  await invoke("plugin:android-package-install|install", {
    install_path,
  });
}

// ✅正确
import { invoke } from "@tauri-apps/api/core";
export async function install(installPath: string): Promise<void> {
  await invoke("plugin:android-package-install|install", {
    installPath,
  });
}

// ✅正确
import { invoke } from "@tauri-apps/api/core";
export async function install(install_path: string): Promise<void> {
  await invoke("plugin:android-package-install|install", {
    installPath: install_path,
  });
}
```

第二个可能遇到的问题是安装问题，即：

```shell
FileProvider Issue: Failed to find configured root that contains
```

需要在 `res/xml/file_paths.xml` 配置 `files-path`，即：

{: data-line="5"}

```diff
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <external-path name="my_images" path="." />
  <cache-path name="my_cache_images" path="." />
  <files-path name="apk_files" path="." />
</paths>
```

具体其它细节就不再赘述了，可以看 [tauri-plugin-android-package-install](https://github.com/kingsword09/tauri-plugins-workspace/tree/main/packages/tauri-plugin-android-package-install) 详细代码。

<br/><br/><br/>

#### 参考文档

- [Tauri 官方文档](https://v2.tauri.app/)
- [tauri-plugin-android-package-install](https://github.com/kingsword09/tauri-plugins-workspace/tree/main/packages/tauri-plugin-android-package-install)
