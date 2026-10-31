import UIKit
import Vision

/// 📷 인바디 결과지 글자 읽기 — 아이폰 Vision 글자 인식(한국어, 휴대폰 안, 인터넷 불필요).
/// 화면(parseInbody)이 「항목 이름 … 숫자」를 한 줄로 읽도록, 같은 높이의 글자 덩어리를 왼쪽→오른쪽으로 이어 한 줄로 만듦.
/// 안드로이드 Ocr.java(ML Kit)의 줄 묶기·기울기 보정을 그대로 옮김.
enum Ocr {
    static func read(_ data: Data, done: @escaping (String) -> Void) {
        guard let img = UIImage(data: data), let cg = upright(img) else { done(""); return }
        let W = CGFloat(cg.width), H = CGFloat(cg.height)
        let req = VNRecognizeTextRequest { r, _ in
            let obs = (r.results as? [VNRecognizedTextObservation]) ?? []
            done(rows(obs, W, H))
        }
        req.recognitionLevel = .accurate
        req.usesLanguageCorrection = false          // 숫자·단위가 사전 단어로 바뀌지 않게
        req.revision = VNRecognizeTextRequestRevision3
        req.recognitionLanguages = ["ko-KR", "en-US"]
        do { try VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:]).perform([req]) }
        catch { done("") }
    }

    /// 큰 사진은 줄이고(긴 쪽 2,400px), 사진 회전 정보대로 바로 세움
    private static func upright(_ img: UIImage) -> CGImage? {
        let w = img.size.width, h = img.size.height
        guard w > 0, h > 0 else { return nil }
        let k = min(1, 2400 / max(w, h))
        let size = CGSize(width: floor(w * k), height: floor(h * k))
        let f = UIGraphicsImageRendererFormat.default()
        f.scale = 1
        f.opaque = true
        let out = UIGraphicsImageRenderer(size: size, format: f).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            img.draw(in: CGRect(origin: .zero, size: size))
        }
        return out.cgImage
    }

    private struct Ln {
        let s: String
        let cx0, cy0, h, w: CGFloat
        var cy: CGFloat
        var x: CGFloat
    }

    /// Vision 좌표(0~1, 왼쪽 아래 기준) → 그림 좌표(픽셀, 왼쪽 위 기준)
    private static func pt(_ p: CGPoint, _ W: CGFloat, _ H: CGFloat) -> CGPoint { CGPoint(x: p.x * W, y: (1 - p.y) * H) }

    /// 사진 기울기(라디안) — 긴 글자 줄들의 윗변 기울기 중앙값
    private static func skew(_ obs: [VNRecognizedTextObservation], _ W: CGFloat, _ H: CGFloat) -> Double {
        var a: [Double] = []
        for o in obs {
            let tl = pt(o.topLeft, W, H), tr = pt(o.topRight, W, H), bl = pt(o.bottomLeft, W, H)
            let dx = Double(tr.x - tl.x), dy = Double(tr.y - tl.y)
            let hh = hypot(Double(bl.x - tl.x), Double(bl.y - tl.y))
            if dx <= 0 || hypot(dx, dy) < hh * 3 { continue }
            a.append(atan2(dy, dx))
        }
        if a.count < 3 { return 0 }
        a.sort()
        return a[a.count / 2]
    }

    static func rows(_ obs: [VNRecognizedTextObservation], _ W: CGFloat, _ H: CGFloat) -> String {
        var all: [Ln] = []
        for o in obs {
            guard let s = o.topCandidates(1).first?.string.trimmingCharacters(in: .whitespaces), !s.isEmpty else { continue }
            let b = o.boundingBox
            let r = CGRect(x: b.minX * W, y: (1 - b.maxY) * H, width: b.width * W, height: b.height * H)
            all.append(Ln(s: s, cx0: r.midX, cy0: r.midY, h: max(1, r.height), w: r.width, cy: r.midY, x: r.minX))
        }
        if all.isEmpty { return "" }
        let ang = skew(obs, W, H)
        if abs(ang) > 0.3 * .pi / 180 && abs(ang) < 20 * .pi / 180 {
            let c = CGFloat(cos(-ang)), s = CGFloat(sin(-ang))
            for i in all.indices {
                all[i].cy = all[i].cx0 * s + all[i].cy0 * c
                all[i].x = all[i].cx0 * c - all[i].cy0 * s - all[i].w / 2
            }
        }
        all.sort { $0.cy < $1.cy }
        var out = ""
        var row: [Ln] = []
        var rowCy: CGFloat = 0, rowH: CGFloat = 0
        for l in all {
            if !row.isEmpty && abs(l.cy - rowCy) > min(rowH, l.h) * 0.55 {
                flush(row, &out)
                row.removeAll()
            }
            if row.isEmpty { rowCy = l.cy; rowH = l.h }
            row.append(l)
        }
        flush(row, &out)
        return out
    }

    private static func flush(_ row: [Ln], _ out: inout String) {
        if row.isEmpty { return }
        out += row.sorted { $0.x < $1.x }.map { $0.s }.joined(separator: " ")
        out += "\n"
    }
}
