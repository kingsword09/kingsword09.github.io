---
layout: post
title: Tauri 2.0 插件开发踩坑记录（1）
description: 记录在Tauri 2.0插件开发中遇到的Android端布尔值序列化问题，分析问题原因并提供两种解决方案。
summary: 本文详细描述了Tauri 2.0插件开发中Android端布尔值序列化问题的解决方案，包括使用JsonProperty注解和避免is前缀的两种方法。
tags: tauri2 coding
minute: 3
---

最近在开发 `Tauri 2.0` 的插件的时候，遇到了一个问题，就是我在 `TypeScript` 中定义了一个对象参数用来传递给插件，在 `Android` 端会出问题，定义如下：

`guest-js/index.ts`

```ts
export interface Options {
  privacyUrl: string;
  isPrivacyDialogRequired: boolean;
}
```

在 `Android` 中定义如下：

```kotlin
@InvokeArg
class Options {
  lateinit var privacyUrl: String
  var isPrivacyDialogRequired: Boolean = true
}
```
按照这种方式定义之后，如果在调用这个插件的时候，`isPrivacyDialogRequired` 设置为 `false`，在 `Android` 的结果依然会是：`true`。

这个问题在 `[阿里巴巴Java开发手册](https://github.com/alibaba/p3c)` 中有提到：[【强制】POJO类中布尔类型的变量，都不要加is前缀，否则部分框架解析会引起序列化错误。](https://github.com/alibaba/p3c/blob/6c59c8c36ecd8722c712d5685b8c3822c1c8b030/p3c-gitbook/%E7%BC%96%E7%A8%8B%E8%A7%84%E7%BA%A6/%E5%91%BD%E5%90%8D%E9%A3%8E%E6%A0%BC.md?plain=1#L22)

而 `Tauri 2.0` 默认使用的序列化框架 [jackson](https://github.com/FasterXML/jackson) 就会出现这个问题。两种方式解决这个问题：
1. 不使用 `is` 开头的属性来定义布尔类型变量；
2. 则是使用 `JsonProperty` 注解：

```kotlin
import com.fasterxml.jackson.annotation.JsonProperty

@InvokeArg
class Options {
  lateinit var privacyUrl: String

  @JsonProperty("isPrivacyDialogRequired")
  var isPrivacyDialogRequired: Boolean = true
}
```
{: data-line="1,7"}

通过这样修改之后，就可以正常处理反序列化了。

<br/><br/><br/>

#### 参考文档

- [Tauri 官方文档](https://v2.tauri.app/)
- [Jackson 官方文档](https://github.com/FasterXML/jackson)
- [阿里巴巴Java开发手册](https://github.com/alibaba/p3c)
