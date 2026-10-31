import UIKit
import WebKit
import Photos

/// 🩷 마크삼식 헬스 기록(아이폰) — 운동 기록 · 식단 · 인바디 · 바프.
/// 화면(HTML)과 데이터는 모두 앱 안(www)에 있고, 기록은 휴대폰 안에만 저장. 인터넷을 쓰지 않음.
/// 안드로이드 핑크 앱(com.marksamsik.health)과 같은 화면 파일을 쓰고, 화면이 부르는 window.KKApp 이름도 같음:
///  - micStart(key) / micStop()                 : 🎙️ 말로 기록 → window.gsMic({t, text|msg})
///  - ocr(base64)                               : 📷 인바디 결과지 글자 읽기 → window.pkOcr(text)
///  - restAlarm(sec) / restCancel()             : ⏱ 휴식 끝 알림(화면 꺼져도)
///  - saveImage(name, b64) / shareImage(name, b64, caption) : 📸 오운완 사진 앱 저장·공유
///  - saveFile(name, text) / shareText(text)    : 💾 백업·CSV 저장(파일 앱), 글 공유
///  - vibrate(ms) / pageReady() / version() / platform()='ios'
/// 앱 → 화면: 왼쪽 가장자리에서 밀기 = window.kkBack() (안드로이드 뒤로가기와 같음)
final class HealthViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {

    static let scheme = "pkapp"
    static let home = URL(string: "pkapp://localhost/index.html")!
    static let bg = UIColor(red: 0x11 / 255.0, green: 0x12 / 255.0, blue: 0x14 / 255.0, alpha: 1)

    private var web: WKWebView!
    private let voice = Voice()
    private var exportURL: URL?

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.bg

        let ucc = WKUserContentController()
        ucc.add(WeakHandler(self), name: "kk")
        addUserScripts(ucc)

        let cfg = WKWebViewConfiguration()
        cfg.userContentController = ucc
        cfg.setURLSchemeHandler(LocalScheme(), forURLScheme: Self.scheme)
        cfg.websiteDataStore = .default()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = .all

        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = Self.bg
        web.scrollView.backgroundColor = Self.bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)

        let g = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: g.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: g.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: g.trailingAnchor)
        ])

        // 안드로이드 뒤로가기 대신: 화면 왼쪽 가장자리에서 오른쪽으로 밀기
        let edge = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(edgeBack(_:)))
        edge.edges = .left
        view.addGestureRecognizer(edge)

        voice.onEvent = { [weak self] t, text in self?.sendMic(t, text) }
        web.load(URLRequest(url: Self.home))

        NotificationCenter.default.addObserver(self, selector: #selector(appBackground),
                                               name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    // MARK: window.KKApp 심기 + 기록 지킴이
    /// 기록 지킴이: 아이폰은 저장 공간이 부족할 때 웹 저장소(localStorage)를 지울 수 있어서,
    /// 화면이 pk_ 기록을 저장할 때마다 같은 내용을 앱 파일(Application Support/pk_backup.json)에도 써 두고,
    /// 앱을 열었는데 웹 저장소가 비어 있으면 그 파일로 되살림. (화면 코드는 안드로이드와 같은 그대로)
    private func addUserScripts(_ ucc: WKUserContentController) {
        let ver = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?") + "-ios"
        let snap = (try? String(contentsOf: Self.backupFile, encoding: .utf8)) ?? "null"
        let safeSnap = snap.isEmpty ? "null" : snap
        let js = """
        (function(){
          function p(m){ try { window.webkit.messageHandlers.kk.postMessage(m); } catch(e){} }
          try {
            var snap = \(safeSnap);
            var has = false;
            for (var i = 0; i < localStorage.length; i++) { if ((localStorage.key(i) || '').indexOf('pk_') === 0) { has = true; break; } }
            if (!has && snap && typeof snap === 'object') { for (var k in snap) { if (k.indexOf('pk_') === 0) localStorage.setItem(k, snap[k]); } }
          } catch(e) {}
          var tm = null;
          function dump(){ tm = null; try { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('pk_') === 0) o[k] = localStorage.getItem(k); } p({t:'backup', x: JSON.stringify(o)}); } catch(e){} }
          function later(){ if (tm) clearTimeout(tm); tm = setTimeout(dump, 800); }
          try {
            var S = Storage.prototype, set = S.setItem, rem = S.removeItem, clr = S.clear;
            S.setItem = function(k, v){ var r = set.apply(this, arguments); if (this === window.localStorage) later(); return r; };
            S.removeItem = function(k){ var r = rem.apply(this, arguments); if (this === window.localStorage) later(); return r; };
            S.clear = function(){ var r = clr.apply(this, arguments); if (this === window.localStorage) later(); return r; };
          } catch(e) {}
          window.__pkDump = dump;
          window.KKApp = {
            vibrate: function(ms){ p({t:'vib', n: +ms || 0}); },
            micStart: function(k){ p({t:'micStart'}); },
            micStop: function(){ p({t:'micStop'}); },
            ocr: function(b){ p({t:'ocr', x: String(b || '')}); },
            restAlarm: function(s){ p({t:'rest', n: +s || 0}); },
            restCancel: function(){ p({t:'restCancel'}); },
            saveImage: function(n, b){ p({t:'saveImage', n: String(n || ''), x: String(b || '')}); },
            shareImage: function(n, b, c){ p({t:'shareImage', n: String(n || ''), x: String(b || ''), c: String(c || '')}); },
            shareText: function(t){ p({t:'shareText', x: String(t == null ? '' : t)}); },
            saveFile: function(n, t){ p({t:'saveFile', n: String(n || ''), x: String(t == null ? '' : t)}); },
            pageReady: function(){ },
            version: function(){ return '\(ver)'; },
            platform: function(){ return 'ios'; }
          };
        })();
        """
        ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    static var backupFile: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("pk_backup.json")
    }

    private func saveBackup(_ json: String) {
        // 빈 저장소({})로 기존 백업을 덮지 않음(설정에서 「모두 지우기」를 한 경우는 화면이 pk_ 키를 지우므로 {} → 지움 반영)
        guard let d = json.data(using: .utf8) else { return }
        try? d.write(to: Self.backupFile, options: .atomic)
    }

    @objc private func appBackground() {
        web?.evaluateJavaScript("window.__pkDump&&__pkDump()", completionHandler: nil)
        voice.stop()
    }

    // MARK: 화면 → 앱
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let t = m["t"] as? String else { return }
        let n = m["n"] as? String ?? ""
        let x = m["x"] as? String ?? ""
        switch t {
        case "vib":
            Rest.vibrate((m["n"] as? NSNumber)?.intValue ?? 0)
        case "micStart":
            voice.start()
        case "micStop":
            voice.stop()
        case "ocr":
            guard let d = Data(base64Encoded: x, options: .ignoreUnknownCharacters) else { sendOcr(""); return }
            DispatchQueue.global(qos: .userInitiated).async { Ocr.read(d) { [weak self] s in self?.sendOcr(s) } }
        case "rest":
            Rest.start((m["n"] as? NSNumber)?.intValue ?? 60)
        case "restCancel":
            Rest.cancel()
        case "saveImage":
            saveImage(x)
        case "shareImage":
            shareImage(Self.safe(n, "ounwan.png"), x, m["c"] as? String ?? "")
        case "shareText":
            share([x])
        case "saveFile":
            saveFile(Self.safe(n, "backup.json"), x)
        case "backup":
            saveBackup(x)
        default:
            break
        }
    }

    private func sendMic(_ t: String, _ text: String) {
        var o: [String: String] = ["t": t]
        if t == "err" { o["msg"] = text } else { o["text"] = text }
        guard let d = try? JSONSerialization.data(withJSONObject: o), let s = String(data: d, encoding: .utf8) else { return }
        js("window.gsMic&&gsMic(\(s))")
    }

    private func sendOcr(_ text: String) {
        js("window.pkOcr&&pkOcr(\(Self.quote(text)))")
    }

    private func js(_ code: String) {
        DispatchQueue.main.async { self.web?.evaluateJavaScript(code, completionHandler: nil) }
    }

    // MARK: 📸 오운완 사진 앱 저장 (추가만 허락받음 — 사진을 읽지 않음)
    private func saveImage(_ b64: String) {
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { toast("이미지를 만들지 못했어요"); return }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { st in
            guard st == .authorized || st == .limited else {
                self.toast("사진 저장 권한이 꺼져 있어요. 아이폰 설정 › 마크삼식 헬스 기록 › 사진에서 켜 주세요.")
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
            }) { ok, _ in
                self.toast(ok ? "📸 사진 앱에 저장했어요" : "저장하지 못했어요")
            }
        }
    }

    private func shareImage(_ name: String, _ b64: String, _ caption: String) {
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { toast("공유하지 못했어요"); return }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("share", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let f = dir.appendingPathComponent(name)
        do { try data.write(to: f, options: .atomic) } catch { toast("공유하지 못했어요"); return }
        var items: [Any] = [f]
        if !caption.isEmpty { items.append(caption) }
        share(items)
    }

    private func share(_ items: [Any]) {
        DispatchQueue.main.async {
            let a = UIActivityViewController(activityItems: items, applicationActivities: nil)
            a.popoverPresentationController?.sourceView = self.view
            a.popoverPresentationController?.sourceRect = CGRect(x: self.view.bounds.midX, y: self.view.bounds.maxY - 40, width: 1, height: 1)
            self.present(a, animated: true)
        }
    }

    // MARK: 💾 백업·CSV → 「파일」 앱에 저장할 곳 고르기
    private func saveFile(_ name: String, _ text: String) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("export", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let f = dir.appendingPathComponent(name)
        do { try text.data(using: .utf8)?.write(to: f, options: .atomic) } catch { toast("저장하지 못했어요"); return }
        exportURL = f
        DispatchQueue.main.async {
            let p = UIDocumentPickerViewController(forExporting: [f], asCopy: true)
            p.delegate = self
            self.present(p, animated: true)
        }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        toast("💾 저장했어요")
        cleanupExport()
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { cleanupExport() }

    private func cleanupExport() {
        if let f = exportURL { try? FileManager.default.removeItem(at: f) }
        exportURL = nil
    }

    // MARK: 뒤로(왼쪽 가장자리 밀기) → 화면의 kkBack
    @objc private func edgeBack(_ g: UIScreenEdgePanGestureRecognizer) {
        guard g.state == .ended else { return }
        web.evaluateJavaScript("(function(){try{return !!(window.kkBack&&window.kkBack());}catch(e){return false;}})()", completionHandler: nil)
    }

    // MARK: WKNavigationDelegate — 앱 안 파일만 열고, https 링크는 사파리로
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = action.request.url, let s = u.scheme?.lowercased() else { decisionHandler(.cancel); return }
        if s == Self.scheme || s == "about" || s == "data" || s == "blob" { decisionHandler(.allow); return }
        if s == "https" || s == "mailto" { UIApplication.shared.open(u) }
        decisionHandler(.cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: Self.home))
    }

    // MARK: WKUIDelegate — 새 창은 사파리로, alert/confirm/prompt 는 아이폰 알림창
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url, u.scheme?.lowercased() == "https" { UIApplication.shared.open(u) }
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

    // MARK: 공통
    private func toast(_ msg: String) {
        DispatchQueue.main.async {
            let l = PaddedLabel()
            l.text = msg
            l.numberOfLines = 0
            l.textAlignment = .center
            l.font = .systemFont(ofSize: 15, weight: .semibold)
            l.textColor = .white
            l.backgroundColor = UIColor(white: 0.12, alpha: 0.94)
            l.layer.cornerRadius = 14
            l.clipsToBounds = true
            l.alpha = 0
            l.translatesAutoresizingMaskIntoConstraints = false
            self.view.addSubview(l)
            NSLayoutConstraint.activate([
                l.centerXAnchor.constraint(equalTo: self.view.centerXAnchor),
                l.bottomAnchor.constraint(equalTo: self.view.safeAreaLayoutGuide.bottomAnchor, constant: -90),
                l.widthAnchor.constraint(lessThanOrEqualTo: self.view.widthAnchor, constant: -48)
            ])
            UIView.animate(withDuration: 0.2, animations: { l.alpha = 1 }) { _ in
                UIView.animate(withDuration: 0.3, delay: 2.2, options: [], animations: { l.alpha = 0 }) { _ in l.removeFromSuperview() }
            }
        }
    }

    static func safe(_ name: String, _ def: String) -> String {
        let bad = CharacterSet(charactersIn: "\\/:*?\"<>|")
        let n = name.components(separatedBy: bad).joined(separator: "_").trimmingCharacters(in: .whitespaces)
        return n.isEmpty ? def : n
    }

    static func quote(_ s: String) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: [s]), let a = String(data: d, encoding: .utf8) else { return "\"\"" }
        return String(a.dropFirst().dropLast())
    }
}

/// 앱 안 www 폴더를 pkapp://localhost/ 주소로 내보냄 — 주소가 고정돼 기록(localStorage)이 같은 곳에 남고, 캔버스 저장도 막히지 않음
final class LocalScheme: NSObject, WKURLSchemeHandler {
    private let root: URL = Bundle.main.resourceURL!.appendingPathComponent("www", isDirectory: true).standardizedFileURL

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { task.didFailWithError(URLError(.badURL)); return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let f = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard f.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: f) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let headers = ["Content-Type": Self.mime(f.pathExtension.lowercased()),
                       "Content-Length": String(data.count),
                       "Cache-Control": "no-cache"]
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(resp)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) { }

    static func mime(_ ext: String) -> String {
        switch ext {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "jpg", "jpeg": return "image/jpeg"
        case "png": return "image/png"
        case "svg": return "image/svg+xml"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
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

/// 안쪽 여백이 있는 글자 상자(알림 문구)
final class PaddedLabel: UILabel {
    private let inset = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
    override func drawText(in rect: CGRect) { super.drawText(in: rect.inset(by: inset)) }
    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width: s.width + inset.left + inset.right, height: s.height + inset.top + inset.bottom)
    }
}
