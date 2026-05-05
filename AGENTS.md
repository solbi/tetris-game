# AGENTS.md

## 저장소 형태
- 정적 브라우저 테트리스 게임이다. 패키지 매니저, 의존성, 빌드 단계, 린트 설정, 테스트 러너, CI가 없다.
- `index.html`이 진입점이며 `styles.css`와 `script.js`를 직접 로드한다. 게임 로직은 전역 `script.js`에 모여 있다.

## 실행 명령
- 직접 열기: `open index.html`
- 로컬 서버: `python3 -m http.server 5173` 실행 후 `http://127.0.0.1:5173` 접속
- 도구가 추가되기 전에는 `npm`, `pnpm`, 테스트 명령을 임의로 만들지 않는다.

## 검증
- 자동화 테스트가 없으므로 브라우저에서 수동 검증한다.
- 시작, 일시정지/계속, 새 게임, 키보드 조작, 보관, 하드/소프트 드롭, 착지 위치 토글, 효과음 토글, 모바일 컨트롤/반응형 레이아웃을 확인한다.

## 구현 메모
- 작업에서 명시하지 않는 한 한국어 UI 문구와 README 문구를 유지한다.
- 보드 크기는 서로 맞물려 있다. `script.js`는 `COLS = 10`, `ROWS = 20`, `BLOCK = 30`을 쓰고, `index.html`의 보드 캔버스는 `300 x 600`, CSS는 `--cell`로 표시 크기를 조정한다.
- 최고 점수는 `localStorage`의 `classic-tetris-best` 키에 저장된다.
- 효과음은 오디오 파일 없이 Web Audio API로 생성한다.
- `.codex/environments/environment.toml`은 자동 생성 파일이므로 직접 수정하지 않는다.
