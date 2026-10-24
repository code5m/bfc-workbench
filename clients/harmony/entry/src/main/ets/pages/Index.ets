import web_webview from '@ohos.web.webview';

@Entry
@Component
struct Index {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  build() { Web({ src: 'https://YOUR-HTTPS-DOMAIN.example.com/#topics', controller: this.controller }).width('100%').height('100%'); }
}
