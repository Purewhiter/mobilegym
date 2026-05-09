# Disclaimer / 免责声明

This document applies to all use of the mobile-gym repository.
本声明适用于 mobile-gym 仓库的所有使用情形。

---

## English

mobile-gym is a research environment for training and evaluating
vision-language agents that operate mobile user interfaces. It includes
UI simulations of several well-known mobile applications, including but
not limited to WeChat, Alipay, Bilibili, RedBook (Xiaohongshu), X
(Twitter), Reddit, Spotify, Tencent Meeting, eBay, and 12306 Railway.

### No affiliation

This project and its authors are NOT affiliated with, endorsed by,
sponsored by, or in any way officially connected to the companies that
own the products mentioned above.

### Trademarks

All product names, logos, and trademarks are the property of their
respective owners and are used here for nominative purposes only — to
identify which real-world application a given module is intended to
model — and to enable reproducible academic research on mobile UI
agents.

### Not a substitute for the original applications

The simulated apps in this repository are intended solely as training
and evaluation targets for research agents. They are NOT, and are not
intended to be, a substitute, replacement, or competing implementation
of any third-party application. Specifically, they:

- are not intended to include proprietary code or backend logic from
  the original applications; third-party visual assets, icons, theme
  resources, fonts, images, or derived representations are addressed in
  the dedicated section below;
- do NOT connect to, interact with, or impersonate the real services
  of those applications;
- do NOT provide any of the real-world functionality (messaging,
  payment, content delivery, social interaction, ticketing, etc.) of
  those applications to end users;
- use synthetic, sanitized, or AI-generated content in place of any
  real user-generated material.

Any resemblance in visual design, naming, or behavior is solely to the
extent necessary to make the environment realistic for agent training
and evaluation.

### Data provenance

All data shipped with this environment falls into one of two
categories:

(a) **Fully synthetic or AI-generated** — produced by the maintainers
    or by generative models, with no correspondence to any real user,
    post, or piece of content on any third-party platform; or

(b) **Collected through official developer APIs** of the relevant
    platforms, under the access terms in effect at the time of
    collection, limited to content that was publicly visible via those
    APIs, and processed to remove or pseudonymize personally
    identifying information where practicable.

The data is redistributed solely to reproduce the benchmark described
in the accompanying paper, **for non-commercial academic research**.
Copyright in any underlying user-generated content remains with its
respective authors; the maintainers make no ownership claim. Users of
this repository are responsible for ensuring that their own downstream
use complies with each relevant platform's **current** developer terms
and applicable law in their jurisdiction.

The dataset compilation and any synthetic content authored by the
maintainers are licensed under the Creative Commons
Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).
The full text and a preamble describing how this license interacts with
the underlying author copyright in API-collected content are in the
LICENSE-DATA file at the root of this repository.

### No model training on platform content

The data described above is provided solely as **environment content**
— the visual and textual context inside the simulated UIs that agents
observe during interaction. It is NOT, and is not intended to be:

- a training corpus for language-model pre-training, fine-tuning, or
  instruction tuning;
- a training signal for any generative model that targets reproduction
  of the underlying user-generated content;
- redistributed for the purpose of building or improving generative
  models on the underlying platform content.

The maintainers have not used, and do not use, this data to train any
machine learning model. Where users employ this environment for
downstream agent training (e.g., reinforcement learning over
trajectories collected inside the simulated UIs), they are responsible
for ensuring that their own training procedure complies with each
relevant platform's developer terms regarding the use of platform
content for AI / ML.

### Third-party themes, icons, and visual assets

Some simulated UI modules may include visual assets, icons, theme-like
resources, fonts, images, or derived representations used solely to
reproduce the research environment for non-commercial academic
evaluation. The maintainers do not claim ownership over any third-party
trademarks, theme resources, icons, fonts, wallpapers, images, or other
visual materials.

Where metadata is available, attribution such as theme names and
author or designer names is preserved in the corresponding app UI or
resource metadata. We are grateful to the original creators whose work
helps make the research environment more realistic.

If you are a rights holder and believe that any asset, theme resource,
icon, font, image, or derived representation in this repository
infringes your rights or should not be redistributed, please contact
the maintainers or open a GitHub issue. We will promptly review the
request and remove, replace, or disable the relevant material.

### Takedown

If you are a rights holder and believe that any content in this
repository infringes your rights, please open a GitHub issue or contact
the maintainers. We will review and remove or modify the relevant
content promptly.

---

## 中文

mobile-gym 是用于**训练和评测**手机操作 Agent的研究**环境**。环境中包含对若干第三方应用 UI 的模拟，包括但不限于微信、支付宝、哔哩哔哩、小红书、X（推特）、Reddit、Spotify、腾讯会议、eBay、铁路12306 等。

### 无关联声明

本项目及其作者与上述应用所属公司**不存在任何附属、代言、赞助或官方合作关系**。

### 商标归属

所有产品名称、标识、商标均归各自权利人所有。本项目仅在指示性合理使用的范围内提及这些名称，目的是说明某个模块所对应的真实应用，并保证学术研究的可复现性。

### 不替代原应用的任何功能

本仓库中的模拟应用仅作为研究 Agent 的训练与评测对象，**不构成、也不意图构成**对所提及的任何第三方应用的替代、替换或竞争性实现。具体而言，它们——

- 不意图包含原应用的专有代码或后端逻辑；第三方视觉素材、图标、类主题资源、字体、图片或其派生表示见下方专门说明；
- 不会连接、调用、冒充原应用的真实服务；
- 不向最终用户提供原应用的任何真实功能（消息收发、支付、内容分发、社交互动、购票等服务）；
- 使用合成数据或 AI 生成内容替代任何真实的用户产生内容（UGC）。

视觉设计、命名、行为上的相似仅限于使本环境对 Agent 训练与评测真实可用所必需的范围。

### 数据来源

本环境随附的数据均属以下两类之一：

（一）**完全为合成数据或 AI 生成内容**：由维护者制作或由生成式模型生产。

（二）**通过相关平台的官方开发者接口采集**：遵循采集当时有效的访问条款，仅限官方接口返回的、当时公开可见的内容，并遵循平台使用协议。

上述数据仅为复现配套论文描述的评测结果而再分发，**仅限非商业学术研究使用**。任何用户产生内容（UGC）的版权归原作者所有，维护者**不主张任何所有权**。使用者需自行确保其下游使用符合相关平台**当前**的开发者条款，以及所在司法管辖区的适用法律。

数据集的整理、处理及维护者原创的合成内容采用 **Creative Commons 署名-非商业性使用 4.0 国际许可协议（CC BY-NC 4.0）** 授权。完整协议文本，以及说明该许可与"通过 API 采集内容的原作者版权"如何分层共存的前言，见仓库根目录的 LICENSE-DATA 文件。

### 不基于平台内容训练模型

上述数据仅作为**环境内容**提供——即 Agent 在与模拟 UI 交互时所观察到的视觉与文本上下文。它**不是、也不意图作为**：

- 语言模型预训练、微调或指令微调的训练语料；
- 以再现原始用户产生内容为目标的生成式模型训练信号；
- 用于构建或改进基于上述平台内容的生成式模型而再分发的语料。

维护者**未曾、也不会**使用本数据训练直接任何机器学习模型。若使用者将本环境用于下游的 Agent 训练（例如基于在模拟 UI 内采集的交互轨迹开展强化学习），应自行确保其训练流程符合相关平台关于将平台内容用于 AI / ML 的开发者条款。

### 第三方主题、图标与视觉素材

部分模拟 UI 模块可能包含用于复现实验环境的视觉素材、图标、类主题资源、字体、图片或其派生表示，仅用于非商业学术研究与评测。维护者不主张对任何第三方商标、主题资源、图标、字体、壁纸、图片或其他视觉材料享有所有权。

若相关元数据可用，主题名称、作者或设计师名称等来源信息会尽量保留在对应 App UI 或资源元数据中。我们感谢原始创作者的工作，这些内容使研究环境更加真实。

若您是相关权利人，并认为本仓库中的任何素材、主题资源、图标、字体、图片或其派生表示侵犯了您的权益，或不应被再分发，请通过 GitHub Issue 或邮件联系维护者。我们将及时审阅，并删除、替换或禁用相关内容。

### 侵权处理

若您是权利人，并认为本仓库的某些内容侵犯了您的合法权益，请通过GitHub Issue 或邮件联系维护者。我们将及时审阅并删除或修改相关内容。
