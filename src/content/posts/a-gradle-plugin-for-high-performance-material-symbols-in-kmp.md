---
title: "Kotlin Multiplatform 项目的高性能 Material Symbols 生成插件"
description: "按需生成与智能缓存的 Material Symbols Gradle 插件 —— 让图标包体积缩减 99%+，并行下载、增量构建、可复现输出，完美适配 Compose Multiplatform。"
summary: "本文详细介绍了如何使用 SymbolCraft 插件来自动下载和缓存 Material Symbols SVG，并自动转化为 Composable 组件，从而在 KMP 项目中实现高性能、小体积的图标管理方案。"
tags:
  - coding
  - kmp
minute: 8
pubDate: "2025-09-27"
---

最近在开发 Kotlin Multiplatform App 时，需要使用一些图标。很自然地想到了 `material-icons-extended` 库，但集成后发现了一个严重的问题：无论怎么使用 `Proguard` 进行混淆压缩，App 的图标包体积始终会增加 11.3 MB。这对于追求轻量化的现代应用来说，是难以接受的。

为了解决这个问题，我决定寻找一个可以按需引入、只包含项目中实际使用到的图标的解决方案。调研中发现 Google 在 2022 年推出了新的图标系列 [Material Symbols](https://fonts.google.com/icons)，它提供了更丰富的样式和配置。于是，我开发了一款名为 **SymbolCraft** 的 Gradle 插件，旨在彻底解决 KMP 项目中的图标体积问题。

[SymbolCraft](https://github.com/kingsword09/SymbolCraft) 是一个为 Kotlin Multiplatform 设计的、支持按需生成 Material Symbols 图标的 Gradle 插件。它通过分析您的配置，自动从 CDN (借助 [esm.sh](https://esm.sh)) 下载指定图标库`@material-symbols/svg-[100-700]`的 SVG 文件，并利用 [DevSrSouza/svg-to-compose](https://github.com/DevSrSouza/svg-to-compose) 库将其转换为高性能的 `ImageVector`。


除了解决体积问题，SymbolCraft 还着力于优化开发体验和构建性能。它内置了 **智能缓存** 机制，避免重复下载；利用 Kotlin 协程实现 **并行下载**，加快生成速度；并保证 **确定性构建**，生成的代码完全一致，对版本控制和 Gradle 的构建缓存都非常友好。

当然，它也全面支持 Material Symbols 丰富的样式选项（粗细、风格、填充），并能生成高质量的矢量图形。其中我最喜欢的功能之一是 **Compose 预览**，插件可以自动为所有生成的图标创建 `@Preview` 函数，让你在 IDE 里就能一目了然，极大提升了开发效率。

### 那么，如何开始使用？

集成 SymbolCraft 的过程非常流畅。首先，像添加其他 Gradle 插件一样，在 `libs.versions.toml` 中定义它：

```toml
[plugins]
symbolCraft = { id = "io.github.kingsword09.symbolcraft", version = "0.1.1" }
```

接着在你的模块 `build.gradle.kts` 文件中应用这个插件：

```kotlin
plugins {
    alias(libs.plugins.symbolCraft)
}
```

最关键的一步来了：通过 `materialSymbols` DSL 配置块告诉 SymbolCraft 你需要哪些图标。它的配置非常灵活，既可以为单个图标精细定义样式，也支持便捷的批量操作。如果你不确定某个图标的名称，或者想浏览所有可用的图标，可以访问 [Material Symbols Demo](https://marella.github.io/material-symbols/demo/) 这个网站，它非常方便：

```kotlin
materialSymbols {
    // 基础配置
    packageName.set("com.app.symbols")
    outputDirectory.set("src/commonMain/kotlin") // 支持多平台项目
    cacheEnabled.set(true)

    // (可选) 开启 Compose 预览生成
    generatePreview.set(true)

    // 配置单个图标，比如 "search"
    symbol("search") {
        style(weight = 400, variant = SymbolVariant.OUTLINED, fill = SymbolFill.UNFILLED)
        style(weight = 500, variant = SymbolVariant.OUTLINED, fill = SymbolFill.FILLED)
    }

    // 使用便捷的批量配置方法
    symbol("home") {
        standardWeights() // 自动添加 400, 500, 700 三种粗细
    }

    symbol("person") {
        allVariants(weight = 400) // 添加所有变体 (outlined, rounded, sharp)
    }

    // 批量配置多个图标
    symbols("favorite", "star", "bookmark") {
        weights(400, 500, variant = SymbolVariant.OUTLINED)
    }
}
```

### 从配置到代码：完整的工作流是怎样的？

配置完成后，我们就可以让 SymbolCraft 大显身手了。只需在终端运行一个简单的 Gradle 命令：

```bash
./gradlew generateMaterialSymbols
```

> 如果遇到缓存问题或想强制重新生成所有图标，可以加上 `--rerun-tasks` 参数。

插件便会开始工作，你会看到它高效地下载 SVG、命中缓存、并最终生成代码。任务成功后，在你指定的输出目录（例如 `src/commonMain/kotlin/com/app/symbols`）下，就会出现所有图标对应的 Kotlin 文件。

接下来，在你的 Composable 函数中就可以直接引用这些新鲜出炉的 `ImageVector` 了：

```kotlin
import com.app.symbols.MaterialSymbols
import com.app.symbols.materialsymbols.SearchW400Outlined
import com.app.symbols.materialsymbols.HomeW700Rounded
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable

@Composable
fun MyScreen() {
    // 你可以直接导入使用
    Icon(
        imageVector = SearchW400Outlined,
        contentDescription = "Search"
    )

    // 或者通过 MaterialSymbols 对象访问，方便查找
    Icon(
        imageVector = MaterialSymbols.HomeW700Rounded,
        contentDescription = "Home"
    )
}
```

但我们如何确认生成的图标就是我们想要的样式呢？总不能每次都运行 App 查看吧。这正是 `generatePreview` 功能的用武之地。开启后，SymbolCraft 会额外生成一个预览文件，让你在 Android Studio 或 IntelliJ IDEA 的预览面板中就能一览所有图标的实际效果，极大地方便了调试和验证。

### 总结

SymbolCraft 通过按需生成和智能缓存的策略，成功解决了在 KMP 项目中使用 Material Symbols 导致的包体积膨胀问题。它不仅提供了强大的功能和灵活的配置，还通过 Compose 预览等特性优化了开发体验。如果你也在为 KMP 项目的图标方案而烦恼，不妨试试 SymbolCraft！

<br/><br/><br/>

#### 参考文档

- [SymbolCraft GitHub Repository](https://github.com/kingsword09/SymbolCraft)
- [Material Symbols - Google Fonts](https://fonts.google.com/icons)
- [Material Symbols Demo - by marella](https://marella.github.io/material-symbols/demo/)
