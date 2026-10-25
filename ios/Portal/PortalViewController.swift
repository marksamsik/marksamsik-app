import UIKit
import WebKit
import AVFoundation

/// 마크삼식 보디빌딩(아이폰) — 포털(Apps Script 웹앱)을 GitHub 액자 페이지로 띄우는 화면.
/// 안드로이드 빨강 앱(com.marksamsik.portal)과 같은 동작:
///  - 시작 주소 = 액자 페이지(docs/index.html) → 포털 /exec 를 iframe 으로 띄움
///  - 포털 화면이 부르는 window.KKApp : speak(text) · canSpeak() · keepScreenOn(bool) · retry() · version()
///  - 인터넷 끊김 → 앱 안 안내 화면(web/offline.html), 바깥 링크·새 창은 사파리로
final class PortalViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    /// 포털 주소 자체는 docs/index.html 의 PORTAL 값(Apps Script 는 반드시 「새 버전」으로만 배포)
    static let home = URL(string: "https://marksamsik.github.io/marksamsik-app/")!
    static let bg = UIColor(red: 0x0f / 255.0, green: 0x12 / 255.0, blue: 0x15 / 255.0, alpha: 1)

    private var web: WKWebView!
    private let bar = UIProgressView(progressViewStyle: .bar)
    private let speech = AVSpeechSynthesizer()
    private var progressObs: NSKeyValueObservation?

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.bg

        let ucc = WKUserContentController()
        ucc.add(WeakHandler(self), name: "kk")
        let ver = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?") + "-ios"
        // 모든 프레임(포털은 액자 안 iframe)에 window.KKApp 을 심는다 — 안드로이드 addJavascriptInterface 와 같은 이름
        let js = """
        (function(){ if (window.KKApp) return;
          function p(m){ try { window.webkit.messageHandlers.kk.postMessage(m); } catch(e){} }
          window.KKApp = {
            speak: function(t){ p({t:'speak', x:String(t == null ? '' : t)}); },
            canSpeak: function(){ return true; },
            keepScreenOn: function(b){ p({t:'keep', on: !!b}); },
            retry: function(){ p({t:'retry'}); },
            version: function(){ return '\(ver)'; },
            platform: function(){ return 'ios'; }
          };
        })();
        """
        ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false))

        let cfg = WKWebViewConfiguration()
        cfg.userContentController = ucc
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = .all
        cfg.websiteDataStore = .default()

        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = Self.bg
        web.scrollView.backgroundColor = Self.bg
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)

        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.progressTintColor = UIColor(red: 0.84, green: 0.16, blue: 0.17, alpha: 1)
        bar.trackTintColor = .clear
        view.addSubview(bar)

        let g = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: g.topAnchor),
            web.bottomAnchor.constraint(equalTo: g.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: g.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: g.trailingAnchor),
            bar.topAnchor.constraint(equalTo: g.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 3)
        ])
        progressObs = web.observe(\.estimatedProgress, options: [.new]) { [weak self] w, _ in
            guard let self = self else { return }
            self.bar.setProgress(Float(w.estimatedProgress), animated: true)
            self.bar.isHidden = w.estimatedProgress >= 1
        }

        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        loadHome()
    }

    private func loadHome() { web.load(URLRequest(url: Self.home)) }

    private func loadOffline() {
        guard let f = Bundle.main.url(forResource: "offline", withExtension: "html", subdirectory: "web") else { return }
        web.loadFileURL(f, allowingReadAccessTo: f.deletingLastPathComponent())
    }

    // MARK: 포털 안에서 계속 열 주소(구글 Apps Script·액자). 나머지는 사파리로
    static func isPortal(_ u: URL?) -> Bool {
        guard let u = u, let scheme = u.scheme?.lowercased() else { return false }
        if ["file", "about", "data", "blob", "javascript"].contains(scheme) { return true }
        guard scheme == "https", let host = u.host?.lowercased() else { return false }
        return host == "marksamsik.github.io" || host == "script.google.com"
            || host.hasSuffix(".googleusercontent.com") || host == "accounts.google.com"
    }

    private func openExternal(_ u: URL?) {
        guard let u = u, let s = u.scheme?.lowercased(), ["http", "https", "mailto", "tel", "sms"].contains(s) else { return }
        UIApplication.shared.open(u)
    }

    // MARK: WKNavigationDelegate
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let u = action.request.url
        let main = action.targetFrame?.isMainFrame ?? true
        if Self.isPortal(u) { decisionHandler(.allow); return }
        // 바깥 주소: 화면 전체가 넘어가거나 사용자가 누른 링크면 사파리로. 포털 안에 박힌 영상 등(iframe 자동 로드)은 그대로 둠
        if main || action.navigationType == .linkActivated {
            openExternal(u)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        offlineIfNeeded(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        offlineIfNeeded(error)
    }

    private func offlineIfNeeded(_ error: Error) {
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code != NSURLErrorCancelled { loadOffline() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { loadHome() }

    // MARK: WKUIDelegate — target="_blank" · window.open → 사파리
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        openExternal(action.request.url)
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }

    // MARK: window.KKApp → 앱
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let t = m["t"] as? String else { return }
        switch t {
        case "speak":
            let x = (m["x"] as? String) ?? ""
            if speech.isSpeaking { speech.stopSpeaking(at: .immediate) }   // 안드로이드 QUEUE_FLUSH 와 같게
            guard !x.isEmpty else { return }
            try? AVAudioSession.sharedInstance().setActive(true)
            let u = AVSpeechUtterance(string: x)
            u.voice = AVSpeechSynthesisVoice(language: "ko-KR")
            speech.speak(u)
        case "keep":
            UIApplication.shared.isIdleTimerDisabled = (m["on"] as? Bool) ?? false
        case "retry":
            loadHome()
        default:
            break
        }
    }
}

/// WKUserContentController 가 화면을 붙잡아 메모리가 안 풀리는 것을 막는 약한 연결
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(ucc, didReceive: message)
    }
}
