# 마크삼식 보디빌딩 — 안드로이드 앱 (만드는 법)

이 저장소는 「마크삼식의 생체 2급 보디빌딩 공식포털」을 띄우는 안드로이드 앱입니다.
화면·데이터는 모두 포털(구글 Apps Script + 구글 시트)에서 오므로, **포털을 고쳐도 앱을 다시 만들 필요가 없습니다.**

## 🗺️ 전체 순서

1. GitHub 저장소 만들기
2. 파일 올리기
3. 비밀값 4개 넣기 (서명 키)
4. 앱 만들기 버튼 누르기 → `.aab` 받기
5. (선택) 내 폰에 `.apk` 설치해 먼저 확인
6. 개인정보처리방침 주소 켜기 (GitHub Pages)
7. Play Console에 업로드 → `store/스토어_등록자료.md` 순서대로

---

## 1️⃣ 저장소 만들기
1. github.com 로그인 → 오른쪽 위 **＋** → **New repository**
2. Repository name: `marksamsik-app`
3. **Public** 선택 (개인정보처리방침 페이지를 무료로 공개하려면 Public 필요. 비밀번호는 코드에 없으니 공개돼도 안전)
4. 아무것도 체크하지 말고 **Create repository**

## 2️⃣ 파일 올리기
1. 받은 `marksamsik-app.zip`을 PC에서 압축 풀기
2. 새 저장소 화면의 **uploading an existing file** 링크 클릭
3. 압축 푼 폴더 **안의 내용 전부**(app, docs, store, .github, build.gradle …)를 드래그해서 끌어다 놓기
   - ⚠️ `.github` 폴더가 안 보이면: 윈도우 탐색기 「보기 → 숨긴 항목」 체크, 맥은 Finder에서 `Cmd + Shift + .`
4. 아래 **Commit changes** 클릭
5. 확인: 저장소 첫 화면에 `.github`, `app`, `docs`, `store` 폴더가 보이면 성공

## 3️⃣ 비밀값 4개 넣기
1. 저장소 위쪽 **Settings** → 왼쪽 **Secrets and variables** → **Actions**
2. **New repository secret** 을 눌러 아래 4개를 하나씩 저장 (값은 따로 받은 `비밀값_4개.txt` 참고)
   - `KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`
3. 확인: Repository secrets 목록에 4개가 보이면 성공
4. ⚠️ `marksamsik-upload.jks`와 `비밀값_4개.txt`는 **절대 저장소에 올리지 말고** 따로 보관하세요. 잃어버리면 앱 업데이트가 막힙니다.

## 4️⃣ 앱 만들기
1. 저장소 위쪽 **Actions** 탭 → (처음이면 초록 버튼 「I understand… enable」 클릭)
2. 왼쪽 **앱 만들기 (AAB)** → 오른쪽 **Run workflow** → 초록 **Run workflow**
3. 5~10분 기다리면 초록 체크 ✅
4. 그 실행을 클릭 → 맨 아래 **Artifacts** 의 `marksamsik-app-번호` 다운로드 → 압축 풀면
   - `app-release.aab` → Play Console 업로드용
   - `app-release.apk` → 내 폰에 직접 설치해 보는 용
5. 빨간 ❌ 가 뜨면: 실행을 클릭 → 빨간 단계 → 오류 문구를 복사해 Claude에게 보여 주세요

## 5️⃣ (선택) 내 폰에서 먼저 확인
1. `app-release.apk`를 카카오톡 나에게 보내기·구글 드라이브 등으로 폰에 옮김
2. 폰에서 열기 → 「출처를 알 수 없는 앱 설치 허용」 → 설치
3. 확인할 것: 포털이 뜨는지 / 뒤로가기 / 크몽 링크가 폰 브라우저로 열리는지 / 비행기모드에서 「인터넷 연결을 확인해 주세요」 화면 / 꿀팁 › 필기 타이머 「소리 확인」 음성

## 6️⃣ 개인정보처리방침 주소 켜기
1. **Settings** → 왼쪽 **Pages**
2. Source: **Deploy from a branch** / Branch: **main**, 폴더 **/docs** → **Save**
3. 1~2분 뒤 위쪽에 나오는 주소 + `privacy.html`
   예) `https://깃허브아이디.github.io/marksamsik-app/privacy.html`
4. 문의 이메일은 `ssp8915@gmail.com`으로 이미 들어가 있습니다. 바꾸려면 GitHub에서 `docs/privacy.html` 열기 → ✏️ 연필 → 수정 → Commit

## 7️⃣ 앱 업데이트할 때
- 포털 내용·디자인 변경 → **앱 업데이트 필요 없음** (Apps Script 「새 버전」 배포만)
- 앱 자체(아이콘·이름·기능)를 바꿀 때만 4️⃣를 다시 실행 → 새 `.aab`를 Play Console에 올림 (버전 번호는 자동으로 올라감)

## ⚠️ 꼭 지킬 것
- 포털 주소가 바뀌면 앱이 먹통이 됩니다 → Apps Script는 항상 「배포 관리 → ✏️ → 새 버전」으로만 배포
- 패키지 이름 `com.marksamsik.portal`은 스토어에 올린 뒤 바꿀 수 없습니다

## 🔧 기술 메모 (Claude용)
- Java, 외부 라이브러리 없음. minSdk 24 / targetSdk·compileSdk 36 / AGP 8.11.1 / Gradle 8.13(Actions에서 설치)
- `MainActivity.HOME` = 포털 주소. script.google.com·*.googleusercontent.com·accounts.google.com 만 앱 안, 나머지는 외부 브라우저
- JS 브리지 `window.KKApp`: `speak(text)`, `canSpeak()`, `keepScreenOn(bool)`, `retry()`, `version()` — 포털 Index의 `tmSay`·`tmAwake`가 사용
- 인터넷 오류 시 `assets/offline.html`
- 서명: GitHub Secrets → `KEYSTORE_FILE` 환경변수로 전달, 업로드 키 alias `upload` (Play 앱 서명 사용)
