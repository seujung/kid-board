# kid-board

자녀용 할 일 보드입니다. 벽에 거는 iPad Air 2(iPadOS 15)에서 쓰는 웹 앱입니다.

- 웹 앱 주소: https://seujung.github.io/kid-board/
- 설치와 관리 방법: [web/INSTALL.md](web/INSTALL.md)

## 네이티브 앱 코드

`App/`, `Packages/`, `project.yml`은 SwiftUI 앱 코드입니다. iPadOS 17 이상을 대상으로 하므로 iPad Air 2에서는 쓰지 않습니다.

## 웹 앱 개발

```bash
cd web
npm ci
npm run dev
npm test
npx playwright test
```
