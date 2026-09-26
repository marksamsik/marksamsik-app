package com.marksamsik.portal;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

import java.util.Locale;

/**
 * 마크삼식 보디빌딩 공식포털 앱.
 * 포털(Apps Script 웹앱)을 그대로 띄우는 창입니다. 데이터·화면은 모두 포털(구글 시트)에서 옵니다.
 * 앱 전용 기능: 인터넷 끊김 안내 화면, 뒤로가기, 외부 링크는 휴대폰 브라우저로 열기,
 *              필기 타이머 음성 안내(휴대폰 음성 엔진), 타이머 동안 화면 꺼짐 방지.
 */
public class MainActivity extends Activity {

    /** 포털 주소. Apps Script에서 「새 배포」를 하면 주소가 바뀌므로 반드시 「새 버전」으로만 배포할 것. */
    static final String HOME =
            "https://script.google.com/macros/s/AKfycbwYhsrixj_FvZCniX_xjWobQyC6EB6IXCzW_Sty-1xPbLakHMOmzRKwDKYevtE4mV6hKg/exec";
    static final String OFFLINE = "file:///android_asset/offline.html";

    private WebView web;
    private ProgressBar bar;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0F1215);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0F1215);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setIndeterminate(false);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3));
        root.addView(bar, lp);

        setContentView(root);
        applyInsets(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // 방문 통계용 브라우저 번호(localStorage)
        s.setSupportMultipleWindows(true);     // 새 창 링크 → 외부 브라우저로 넘기기 위해
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "KKApp");
        web.setWebViewClient(new PortalClient());
        web.setWebChromeClient(new PortalChrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(Uri.parse(url)));

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.KOREAN);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });

        if (Build.VERSION.SDK_INT >= 33) registerBack33();

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(HOME);
        }
    }

    /** 안드로이드 15 이상은 화면이 상태바 뒤까지 그려지므로 그만큼 여백을 줍니다. */
    private void applyInsets(View root) {
        if (Build.VERSION.SDK_INT >= 35) applyInsets35(root);
    }

    @android.annotation.TargetApi(35)
    private void applyInsets35(View root) {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsets.CONSUMED;
        });
    }

    /** 안드로이드 13 이상 뒤로가기(제스처 포함). */
    @android.annotation.TargetApi(33)
    private void registerBack33() {
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBackOrFinish);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    /** 포털 안에서 계속 열 주소인지(구글 Apps Script 도메인) 판단. 나머지는 휴대폰 브라우저로. */
    static boolean isPortal(Uri u) {
        if (u == null) return false;
        String scheme = u.getScheme(), host = u.getHost();
        if ("file".equals(scheme)) return true;
        if (!"https".equals(scheme) || host == null) return false;
        return host.equals("script.google.com")
                || host.endsWith(".googleusercontent.com")
                || host.equals("accounts.google.com");
    }

    void openExternal(Uri u) {
        if (u == null) return;
        try {
            Intent it = new Intent(Intent.ACTION_VIEW, u);
            it.addCategory(Intent.CATEGORY_BROWSABLE);
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(it);
        } catch (ActivityNotFoundException | SecurityException e) {
            // 열 수 있는 앱이 없으면 조용히 무시
        }
    }

    private void goBackOrFinish() {
        String cur = web.getUrl();
        if (cur != null && cur.startsWith(OFFLINE)) {
            finish();
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            finish();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBackOrFinish();   // 안드로이드 12 이하
    }

    private class PortalClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (isPortal(u)) return false;
            openExternal(u);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame()) view.loadUrl(OFFLINE);
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            bar.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            bar.setVisibility(View.GONE);
        }
    }

    private class PortalChrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int p) {
            bar.setProgress(p);
            bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
        }

        /** target="_blank" 링크(크몽·공고문 PDF·유튜브 등)는 휴대폰 브라우저로 엽니다. */
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            WebView tmp = new WebView(MainActivity.this);
            tmp.setWebViewClient(new WebViewClient() {
                private boolean done = false;

                private void go(WebView v, Uri u) {
                    if (done) return;
                    done = true;
                    openExternal(u);
                    v.stopLoading();
                    v.post(v::destroy);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                    go(v, req.getUrl());
                    return true;
                }

                @Override
                public void onPageStarted(WebView v, String url, Bitmap favicon) {
                    if (url != null && !url.equals("about:blank")) go(v, Uri.parse(url));
                }
            });
            WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
            t.setWebView(tmp);
            resultMsg.sendToTarget();
            return true;
        }
    }

    /** 포털 화면(자바스크립트)에서 window.KKApp 으로 부르는 앱 기능. */
    private class Bridge {
        @JavascriptInterface
        public void speak(String text) {
            if (tts == null || !ttsReady || text == null) return;
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kk");
        }

        @JavascriptInterface
        public boolean canSpeak() {
            return ttsReady;
        }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> web.loadUrl(HOME));
        }

        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }
}
