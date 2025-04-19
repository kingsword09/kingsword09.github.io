---
layout: post
title: GitHub提交签名验证
description: 记录在 GitHub 提交时如何配置 GPG 签名验证的详细步骤与常见问题解决方法。
summary: 本文详细介绍了如何为 GitHub 配置 GPG 提交签名验证的完整流程，包括密钥生成、配置、常见错误及其解决方案。
tags: coding
minute: 4
---

最近在 `GitHub` 贡献 `Pull Request` 时，发现贡献者需要提交签名验证，因此记录下这个过程。

以 `Mac` 电脑为例：

#### GPG

##### 1. 安装 `GPG` 程序
```bash
brew install gnupg
```
> 如果是 windows 则安装 [Gpg4win](https://www.gpg4win.org/)。

##### 2. 生成 `GPG` 密钥

(1) 生成密钥
```bash
gpg --full-generate-key
```
> 使用默认加密即可（椭圆曲线ECC）
>
> 电子邮箱需要填写经过 `GitHub` 验证的邮箱

(2) 先获取 `GPG` 密钥 `ID`
```bash
$ gpg --list-secret-keys --keyid-format=long
/Users/hubot/.gnupg/secring.gpg
------------------------------------
sec   4096R/3AA5C34371567BD2 2016-03-10 [expires: 2017-03-10]
uid                          Hubot <hubot@example.com>
ssb   4096R/4BB6D45482678BE3 2016-03-10
```

(3) 获取公钥
```bash
gpg --armor --export 3AA5C34371567BD2
# Prints the GPG key ID, in ASCII armor format
```

(4) 复制以 `-----BEGIN PGP PUBLIC KEY BLOCK-----` 开头并以 `-----END PGP PUBLIC KEY BLOCK-----` 结尾的 GPG 密钥。

(5) [将 `GPG` 密钥新增到 `GitHub` 帐户](https://docs.github.com/zh/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account)

- 在 GitHub 任意页面的右上角，单击个人资料照片，然后单击 “设置”****。
- 在边栏的“访问”部分中，单击 “SSH 和 GPG 密钥”。
- 在“GPG 密钥”标头旁边，单击“新建 GPG 密钥”。
- 在“标题”字段中键入 GPG 密钥的名称。
- 在“密钥”字段中，粘贴生成 GPG 密钥时复制的 GPG 密钥。
- 单击“添加 GPG 密钥”
- 若要确认操作，请向 GitHub 帐户进行身份验证以确认操作。

(6) `git` `commit` 配置 `signing`
- 全局配置
```bash
git config --global user.signingkey 4874E921904AC200
git config --global commit.gpgsign true
```

- 项目配置
```bash
git config user.signingkey 4874E921904AC200
git config commit.gpgsign true
```

##### 3. 配置 `GPG`
因为平时使用 `GitHub Desktop` 提交代码，需要有一个可以输入 `GPG` `passphrases` 的 `GUI` 程序，如果使用命令行则不需要，因为默认的 `pinentry` 可以在命令行中出现 `dialog` 来输入。

(1) 安装 `pinentry` `GUI` 程序
```bash
brew install pinentry-mac
```

(2) 配置 `gpg-agent.conf` 用于控制弹出 `pinentry` 的频次和程序
`gpg-agent.conf` 位置：
- `Mac`：`~/.gnupg/gpg-agent.conf`
```bash
# Set the default cache time to 1 day. 
default-cache-ttl 86400 
# Set the max cache time to 30 days. 
max-cache-ttl 2592000 
# Set pinentry GUI program (Only MacOS)
pinentry-program /opt/homebrew/bin/pinentry-mac
```
- `Windows`： `C:\Users\<username>\AppData\Roaming\gnupg\gpg-agent.conf`
> powershell可以使用 `cd $env:AppData/gnupg` 进入 `gnupg` 配置目录
```bash
# Set the default cache time to 1 day. 
default-cache-ttl 86400 
# Set the max cache time to 30 days. 
max-cache-ttl 2592000 
```

##### 4. 重启 `gpg-agent`
```bash
gpgconf --kill gpg-agent
gpg-connect-agent reloadagent /bye
```

#### QA
- `gpg: signing failed: Inappropriate ioctl for device`

出现这个错误是因为没有弹出 `pinentry` `GUI` 程序输入 `passphrases`。

- 如何备份和导入 `GPG` 配置

[备份和恢复 `GPG` `key`](https://www.jwillikers.com/backup-and-restore-a-gpg-key)

<br/><br/><br/>

#### 参考文档

- [生成 `GPG` 密钥](https://docs.github.com/zh/authentication/managing-commit-signature-verification/generating-a-new-gpg-key)
- [将 `GPG` 密钥添加到 `GitHub` 帐户](https://docs.github.com/zh/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account)
- [备份和恢复 `GPG` `key`](https://www.jwillikers.com/backup-and-restore-a-gpg-key)
- [How can I get GPG Agent to cache my password?](https://askubuntu.com/questions/805459/how-can-i-get-gpg-agent-to-cache-my-password)