import Foundation
import Speech
import AVFoundation

/// 🎙️ 말로 기록 — 아이폰 음성 인식(한 문장 받아쓰기).
/// 결과는 onEvent 로 알림: part(중간 글자) · final(최종 글자) · err(안내 문구). 반드시 메인 스레드에서 부름.
/// 기기 안 인식을 지원하는 아이폰이면 기기 안에서만 인식(음성이 밖으로 안 나감).
/// 지원하지 않는 아이폰은 onDeviceOnly 설정에 따라: false = 애플 음성 인식 서버 사용 / true = 직접 입력 안내.
final class Voice {
    static let onDeviceOnly = false

    var onEvent: ((String, String) -> Void)?

    private let rec = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR"))
    private let engine = AVAudioEngine()
    private var req: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var last = ""
    private var finished = true
    private var silence: Timer?
    private var cap: Timer?
    private var onDevice = false      // 이번 시도가 기기 안 인식인지
    private var retried = false       // 기기 안 인식 실패 → 서버 인식으로 한 번 더 시도했는지
    private var gen = 0               // 시도 번호: 취소된 앞 시도의 늦은 결과를 버림
    private var buffers = 0           // 진단: 마이크에서 받은 소리 묶음 수(0이면 마이크 입력이 안 들어온 것)

    func start() {
        stop()
        finished = false
        SFSpeechRecognizer.requestAuthorization { st in
            DispatchQueue.main.async {
                guard !self.finished else { return }
                guard st == .authorized else {
                    self.fail("음성 인식 권한이 꺼져 있어요. 아이폰 설정 › 마크삼식 헬스 기록에서 켜 주세요.")
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { ok in
                    DispatchQueue.main.async {
                        guard !self.finished else { return }
                        guard ok else {
                            self.fail("마이크 권한이 꺼져 있어요. 아이폰 설정 › 마크삼식 헬스 기록에서 켜 주세요.")
                            return
                        }
                        self.retried = false
                        self.begin(preferOnDevice: true)
                    }
                }
            }
        }
    }

    func stop() {
        finished = true
        cleanup()
    }

    private func begin(preferOnDevice: Bool) {
        guard let rec = rec else { fail("이 아이폰은 한국어 음성 인식을 지원하지 않아요. 직접 입력해 주세요."); return }
        guard rec.isAvailable else {
            fail("지금은 음성 인식을 쓸 수 없어요. 아이폰 설정 › 일반 › 키보드 › 「받아쓰기 활성화」를 켜고, 인터넷 연결을 확인해 주세요.")
            return
        }
        if Self.onDeviceOnly && !rec.supportsOnDeviceRecognition {
            fail("이 아이폰은 기기 안 음성 인식을 지원하지 않아요. 직접 입력해 주세요.")
            return
        }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch { fail("마이크를 열지 못했어요."); return }

        let r = SFSpeechAudioBufferRecognitionRequest()
        r.shouldReportPartialResults = true
        onDevice = preferOnDevice && rec.supportsOnDeviceRecognition
        r.requiresOnDeviceRecognition = onDevice
        req = r
        last = ""

        let input = engine.inputNode
        let fmt = input.outputFormat(forBus: 0)
        guard fmt.sampleRate > 0, fmt.channelCount > 0 else { fail("마이크를 열지 못했어요."); return }
        input.removeTap(onBus: 0)
        buffers = 0
        input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self, weak r] buf, _ in
            r?.append(buf)
            DispatchQueue.main.async { self?.buffers += 1 }
        }
        engine.prepare()
        do { try engine.start() } catch { fail("마이크를 열지 못했어요."); return }

        gen += 1
        let g = gen
        task = rec.recognitionTask(with: r) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, g == self.gen else { return }
                self.handle(result, error)
            }
        }
        // 안드로이드처럼 말이 멈추면 저절로 끝: 처음 5초 동안 아무 말 없으면 끝, 말한 뒤 1.5초 조용하면 끝, 최대 15초
        cap = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in self?.finish() }
        armSilence(6)
    }

    private func handle(_ result: SFSpeechRecognitionResult?, _ error: Error?) {
        if finished { return }
        if let res = result {
            last = res.bestTranscription.formattedString
            if res.isFinal { finish(); return }
            if !last.isEmpty { onEvent?("part", last); armSilence(1.5) }
        }
        if let e = error as NSError? {
            if !last.isEmpty { finish(); return }
            // 기기 안 인식이 준비 안 됨(언어 자료 없음 등) → 애플 서버 인식으로 한 번 더
            if onDevice && !retried && !Self.isNoSpeech(e) && !Self.onDeviceOnly {
                retried = true
                cleanup()
                begin(preferOnDevice: false)
                return
            }
            fail(Self.message(e))
        }
    }

    static func isNoSpeech(_ e: NSError) -> Bool {
        return e.domain == "kAFAssistantErrorDomain" && (e.code == 1110 || e.code == 203)
    }

    /// 실패 원인을 알 수 있게 안내 + 코드(문의할 때 캡처로 보면 원인을 바로 앎)
    static func message(_ e: NSError) -> String {
        let code = "(\(e.domain) \(e.code))"
        if isNoSpeech(e) { return "잘 못 들었어요. 다시 눌러 주세요. " + code }
        if e.domain == "kLSRErrorDomain" && e.code == 201 {
            return "아이폰 받아쓰기가 꺼져 있어요. 설정 › 일반 › 키보드 › 「받아쓰기 활성화」를 켜 주세요. " + code
        }
        if e.domain == "kAFAssistantErrorDomain" && (e.code == 1700 || e.code == 1101) {
            return "음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 직접 입력해 주세요. " + code
        }
        return "음성 인식에 실패했어요. 다시 눌러 주세요. " + code
    }

    private func armSilence(_ sec: TimeInterval) {
        silence?.invalidate()
        silence = Timer.scheduledTimer(withTimeInterval: sec, repeats: false) { [weak self] _ in
            guard let self = self, !self.finished else { return }
            // 기기 안 인식이 아무 글자도 못 내면 애플 서버 인식으로 한 번 더(말은 다시 해야 함)
            if self.last.isEmpty && self.onDevice && !self.retried && !Self.onDeviceOnly {
                self.retried = true
                self.cleanup()
                self.onEvent?("part", "다시 한 번 말해 주세요…")
                self.begin(preferOnDevice: false)
                return
            }
            self.finish()
        }
    }

    private func finish() {
        if finished { return }
        finished = true
        let t = last.trimmingCharacters(in: .whitespacesAndNewlines)
        cleanup()
        if t.isEmpty { onEvent?("err", "잘 못 들었어요. 다시 눌러 주세요. (진단: 소리 \(buffers) · \(onDevice ? "기기 안" : "서버") 인식)") } else { onEvent?("final", t) }
    }

    private func fail(_ msg: String) {
        finished = true
        cleanup()
        onEvent?("err", msg)
    }

    private func cleanup() {
        silence?.invalidate(); silence = nil
        cap?.invalidate(); cap = nil
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        req?.endAudio()
        task?.cancel()
        req = nil
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
