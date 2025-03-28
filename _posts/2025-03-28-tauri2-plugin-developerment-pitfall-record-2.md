---
layout: post
title: Tauri 2.0 插件开发踩坑记录（2）
description: 记录在Tauri 2.0插件开发中如何使用addPluginListener来实现异步返回数据。
summary: 本文详细介绍了Tauri 2.0插件开发中使用addPluginListener实现异步数据返回的完整过程，包括tauri-plugin-mobile-onbackpressed-listener插件的实现，以及解决前端无法接收返回数据问题的具体方案。
tags: tauri2 coding
minute: 3
---

开发 `Tauri 2.0` 的插件时，可能会有异步返回数据的需求，这时候就需要使用到 [addpluginlistener](https://v2.tauri.app/reference/javascript/api/namespacecore/#addpluginlistener)。

假设要开发的插件为: [tauri-plugin-mobile-onbackpressed-listener](https://github.com/kingsword09/tauri-plugins-workspace/tree/main/packages/tauri-plugin-mobile-onbackpressed-listener)。

在 `TypeScript` 的接口定义中就可以以下面的方式进行定义：

`guest-js/index.ts`：

```ts
import {
  addPluginListener,
  invoke,
  PluginListener,
} from "@tauri-apps/api/core";

export async function registerBackEvent(
  goBack: () => void
): Promise<PluginListener> {
  await invoke("plugin:mobile-onbackpressed-listener|register_back_event");

  return await addPluginListener(
    "mobile-onbackpressed-listener",
    "mobile-onbackpressed-goback",
    (result) => {
      goBack();
    }
  );
}
```

定义了一个插件 `command`:`register_back_event` 和一个监听 `event`:`mobile-onbackpressed-goback`。接下来就可以在各个平台进行实现相关代码了。

- 在 `Android` 端可以通过 `onBackPressedDispatcher` 和 `onBackInvokedDispatcher` 来监听设备的返回事件，`registerBackEvent` 这个事件处理时可以直接通过 `invoke.resolve()` 返回就可以了。

- 在 `iOS` 端，则需要做一些特殊处理，因为 `iOS` 本身没有返回监听相关的功能，需要具体实现，也可以参考 [MobileOnBackPressedListenerPlugin.swift](https://github.com/kingsword09/tauri-plugins-workspace/blob/main/packages/tauri-plugin-mobile-onbackpressed-listener/ios/Sources/MobileOnBackPressedListenerPlugin.swift) 此处代码来实现。

在这之后，你就可以通过监听到返回，在 `Android` 端和 `iOS` 端分别触发：`trigger("mobile-onbackpressed-goback", JSObject())` 来实现通知到前端代码来执行 `goBack` 方法。

当你以为一切都完成时，坑就出现了，你会发现 `trigger` 怎么都无法通知到前端，查阅官方文档也没有看到有相关的说明，而且官方似乎没有相关的示例可以查看。

后来是在看到第三方的插件时，通过对比才发现问题所在。需要将 `addPluginListener` 的 `command` 也添加到你的插件的 `command` 中，即

`tauri-plugin-mobile-onbackpressed-goback/build.rs`:

{: data-line="3,4"}

```rust
const COMMANDS: &[&str] = &[
  "register_back_event",
  "registerListener",
  "remove_listener"
]
```

这样才能够实现 `trigger` 可以通知到前端。之后在使用插件时，也需要在 `app` 中的 `capabilities/*.json` 添加上相关的权限：

```json
"permissions": [
  "mobile-onbackpressed-listener:allow-register-back-event",
  "mobile-onbackpressed-listener:allow-registerListener",
  "mobile-onbackpressed-listener:allow-remove-listener"
]
```

如此，这个插件就可以正常使用了。

<br/><br/><br/>

#### 参考文档

- [Tauri 官方文档](https://v2.tauri.app/)
- [tauri-plugin-mobile-onbackpressed-listener](https://github.com/kingsword09/tauri-plugins-workspace/tree/main/packages/tauri-plugin-mobile-onbackpressed-listener)