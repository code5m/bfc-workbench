# 自选多端客户端源码

## 当前状态

- Android：Gradle Android Application 源码骨架，入口为 `android/app/src/main/java/.../MainActivity.java`。
- iOS：SwiftUI + WKWebView 源码入口 `ios/SelfCuratedApp.swift`。
- 鸿蒙：ArkTS WebView 源码入口 `harmony/entry/src/main/ets/pages/Index.ets`。
- 微信小程序：可导入工程在 `wechat-miniprogram/`。

三端都通过 HTTPS 配置入口访问同一套自选后端和 PC 工作台，不复制专题、分类、差异判定等业务逻辑。

## 尚未验证项

当前主机没有 Android SDK/adb、Xcode 或鸿蒙 Hvigor，因此 Android APK、iOS 工程和鸿蒙 HAP 尚未完成构建与设备验证。正式验证前需要：

1. 将各端源码中的 `YOUR-HTTPS-DOMAIN.example.com` 替换为部署后的 HTTPS 域名。
2. Android 配置 SDK 与签名；iOS 配置 Xcode、Bundle ID、签名和设备；鸿蒙配置 DevEco Studio、应用 ID 和签名。
3. 分别验证登录、B站播放、返回专题、继续下一节和权限隔离。
