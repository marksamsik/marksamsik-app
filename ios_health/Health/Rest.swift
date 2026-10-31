import UIKit
import AudioToolbox
import UserNotifications

/// ⏱ 휴식 끝 알림 — 휴식 시간(최대 10분) 뒤에 울리는 아이폰 로컬 알림.
/// 화면이 꺼져 있거나 다른 앱을 보고 있어도 알림이 옴. 앱이 앞에 있으면 AppDelegate 에서 진동만.
enum Rest {
    static let id = "rest"

    static func start(_ sec: Int) {
        let s = max(1, min(600, sec))
        let c = UNUserNotificationCenter.current()
        c.removePendingNotificationRequests(withIdentifiers: [id])
        c.removeDeliveredNotifications(withIdentifiers: [id])
        // 처음 한 번만 허락을 묻고, 그 뒤로는 바로 결과가 옴
        c.requestAuthorization(options: [.alert, .sound]) { ok, _ in
            guard ok else { return }
            let ct = UNMutableNotificationContent()
            ct.title = "⏱ 휴식 끝!"
            ct.body = "다음 세트 시작해요 💪"
            ct.sound = .default
            let trig = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(s), repeats: false)
            c.add(UNNotificationRequest(identifier: id, content: ct, trigger: trig))
        }
    }

    static func cancel() {
        let c = UNUserNotificationCenter.current()
        c.removePendingNotificationRequests(withIdentifiers: [id])
        c.removeDeliveredNotifications(withIdentifiers: [id])
    }

    /// 휴식 끝 진동(세 번)
    static func buzz() {
        DispatchQueue.main.async {
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { AudioServicesPlaySystemSound(kSystemSoundID_Vibrate) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { AudioServicesPlaySystemSound(kSystemSoundID_Vibrate) }
        }
    }

    /// 화면의 짧은 진동(vibrate(ms)). 아이폰은 길이를 못 정하므로 짧으면 톡, 길면 진동
    static func vibrate(_ ms: Int) {
        DispatchQueue.main.async {
            if ms >= 300 { AudioServicesPlaySystemSound(kSystemSoundID_Vibrate) }
            else { UIImpactFeedbackGenerator(style: ms >= 60 ? .medium : .light).impactOccurred() }
        }
    }
}
