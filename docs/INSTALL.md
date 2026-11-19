# 설치 안내

이 문서는 Mac mini에서 iPad로 앱을 설치하고 자동 재설치를 설정하는 방법을 설명합니다.

무료 Apple 계정으로 서명한 앱은 7일 뒤에 만료됩니다. 자동 재설치 스크립트는 5일마다 앱을 다시 서명해서 설치합니다. 앱은 만료 2일 전부터 경고를 표시합니다.

## 1. Mac mini 준비

1. Mac mini에 Xcode를 설치하십시오.
2. Xcode를 열고 Settings > Accounts에서 Apple 계정에 로그인하십시오.
3. 터미널에서 다음 명령으로 XcodeGen을 설치하십시오.

```sh
brew install xcodegen
```

## 2. Local.xcconfig 작성

1. 예시 파일을 복사하십시오.

```sh
cd ~/repo/kid-board
cp Config/Local.xcconfig.example Config/Local.xcconfig
```

2. `Config/Local.xcconfig`를 열어 팀 ID와 고유 번들 ID를 입력하십시오.
3. 번들 ID는 다른 앱과 겹치지 않아야 합니다.

## 3. iPad 연결

1. iPad를 케이블로 Mac mini에 연결하십시오.
2. iPad에서 "이 컴퓨터를 신뢰하겠습니까?"가 나오면 신뢰를 선택하십시오.
3. iPad의 설정 > 개인정보 보호 및 보안 > 개발자 모드를 켜십시오. iPad가 다시 시작됩니다.
4. Xcode에서 Window > Devices and Simulators를 여십시오.
5. 목록에서 iPad를 선택하십시오.
6. "Connect via network"를 켜십시오.
7. iPad와 Mac mini는 같은 Wi-Fi에 있어야 합니다.

## 4. 첫 설치와 인증서 신뢰

1. 다음 명령으로 앱을 한 번 설치하십시오.

```sh
cd ~/repo/kid-board
xcodegen generate
open KidBoard.xcodeproj
```

2. Xcode에서 iPad를 대상으로 선택하고 Run을 누르십시오.
3. iPad에서 설정 > 일반 > VPN 및 기기 관리를 여십시오.
4. 개발자 앱에서 본인의 Apple 계정을 선택하고 신뢰를 누르십시오.

## 5. DEVICE_ID 확인과 config.env 작성

1. 다음 명령으로 iPad의 ID를 확인하십시오.

```sh
xcrun devicectl list devices
```

2. Identifier 열의 값을 복사하십시오.
3. 설정 파일을 만드십시오.

```sh
cd ~/repo/kid-board/scripts/reinstall
cp config.env.example config.env
```

4. `config.env`를 열어 `PROJECT_DIR`, `DEVICE_ID`, `BUNDLE_ID`를 입력하십시오.
5. `BUNDLE_ID`는 `Config/Local.xcconfig`와 같아야 합니다.
6. `xcode-select`가 Command Line Tools를 가리키면 `DEVELOPER_DIR` 줄의 주석을 푸십시오.

## 6. Mac mini 설정

1. 시스템 설정 > 사용자 및 그룹에서 자동 로그인을 켜십시오.
2. FileVault가 켜져 있으면 자동 로그인이 되지 않습니다. 이 경우 FileVault를 끄십시오.
3. 시스템 설정 > 에너지 절약에서 디스플레이가 꺼져도 Mac mini가 잠들지 않게 설정하십시오.
4. 정전 뒤에 자동으로 시작하는 옵션이 있으면 켜십시오.

## 7. 자동 재설치 등록

1. 먼저 스크립트를 직접 실행해서 확인하십시오.

```sh
zsh ~/repo/kid-board/scripts/reinstall/kidboard-reinstall.sh --force
```

2. 성공하면 LaunchAgent를 등록하십시오.

```sh
zsh ~/repo/kid-board/scripts/reinstall/install-agent.sh
```

3. 등록하면 매일 새벽 3시에 스크립트가 실행됩니다.
4. 마지막 설치 후 5일이 지나지 않았으면 스크립트는 건너뜁니다.
5. 실패하면 Mac mini에 알림이 표시됩니다.
6. 로그는 다음 파일에서 확인하십시오.

```sh
open "$HOME/Library/Application Support/KidBoardReinstall"
```

7. 같은 명령을 다시 실행해도 안전합니다. 기존 등록을 먼저 해제하고 다시 등록합니다.

## 8. 사용법 유도 접근 켜기

1. iPad의 설정 > 손쉬운 사용 > 사용법 유도 접근을 여십시오.
2. 사용법 유도 접근을 켜십시오.
3. 암호 설정에서 암호를 정하십시오.
4. 앱을 열고 홈 버튼 또는 측면 버튼을 세 번 누르십시오.
5. 시작을 누르십시오.

## 문제 해결

1. 알림이 나타나면 `reinstall.log`를 확인하십시오.
2. 설치가 실패하면 iPad가 켜져 있고 같은 Wi-Fi에 연결되어 있는지 확인하십시오.
3. 서명이 실패하면 Xcode를 열고 Apple 계정 로그인 상태를 확인하십시오.
