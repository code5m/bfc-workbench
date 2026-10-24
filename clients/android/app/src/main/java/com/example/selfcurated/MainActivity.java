package com.example.selfcurated;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebView view = new WebView(this);
        view.getSettings().setJavaScriptEnabled(true);
        view.setWebViewClient(new WebViewClient());
        view.loadUrl("https://YOUR-HTTPS-DOMAIN.example.com/#topics");
        setContentView(view);
    }
}
