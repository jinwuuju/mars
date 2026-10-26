# GAME SYSTEMS v2 — 실행 형태 · 상태 · 분기 · 미니게임 · 테스트

> v1 CODEX_MASTER_PROMPT의 기술 계약(§1 스택, §2 아트, §4 불변식, §6 인터페이스, §7 폴더, §9 수용 조건)을 흡수·갱신한다. 이 문서에 없는 세부는 v1을 따른다. 충돌 시 이 문서 우선, SCIENCE_AND_ETHICS 최우선.

## 1. 실행 형태와 스택
- Vite + TypeScript(strict) + Phaser 3(맵·스프라이트·애니메이션) + DOM/CSS UI(대화, 명단, HUD, 미니게임 패널, 결과).
- 산출물 2가지: ① `npm run build` → `dist/index.html` 단일 파일(vite-plugin-singlefile로 JS·CSS·스프라이트 전부 인라인) ― 더블클릭만으로 오프라인 실행. ② `npm run dev` 개발 서버.
- 그래픽: 코드 안의 픽셀 매트릭스(팔레트 인덱스 문자열) → 런타임에 캔버스 텍스처 생성. 외부 이미지 없이 재현 가능한 오리지널 도트. 텍스트는 전부 DOM(캔버스 1px 폰트 금지).
- 외부 API·CDN·로그인·AI 모델·추적 SDK·백엔드 없음. 폰트는 시스템 한글 산세리프 스택.
- 스크립트: dev / build / preview / typecheck / lint / test(Vitest) / test:e2e(Playwright, 설치 불가 시 TEST_REPORT에 사유 기록).
- 저장: localStorage 키 `mirror:last-earth:save:v2`(schemaVersion 2). file:// 에서 저장이 막히면 메모리 저장 + 안내. 축제 버전 세이브는 읽지 않고 '이전 버전 기록은 이어할 수 없어요' 안내.
- 개발 환경 확인(2026-10-25): macOS 26.7.1 arm64, Node v26.10.0, npm 11.19.1, git 2.39.5.

## 2. 상태 모델 (v1 MissionState 확장)
**MissionState (이야기)**: schemaVersion, runId, runSeed, chapter, sceneId, fsmState, crewIds(확정 전 0..4, 확정 후 정확히 4, 중복 불가), crewLocked, legacyItemIds(미선발 2명에서 파생, 정확히 2), inventoryIds, resources, narrativeClock, narrativeFlags, endingId?, completed, settings.
**MeasurementState (측정, 별도 스토어)**: analysisOptIn, opportunities, events, forkLayout(시드 기반 표시 순서), qualityFlags.
- analytics 모듈은 crewIds·narrativeFlags·inventoryIds·legacyItemIds를 import하거나 읽을 수 없다. 별도 리듀서 + ESLint no-restricted-imports + 테스트로 강제(구조적 격리).
- 모든 변경은 dispatch(action) → 순수 리듀서의 원자적 트랜잭션. action id 중복 제거로 이중 클릭 무시.
- 결정성: runSeed + 순수 함수. 이어하기 후 같은 행동이면 같은 결과.

**자원(게임 추상 단위, 0..100 클램프)**: power 65 / oxygenReserve 70 / water 60 / food 60 / trust 50 / archive 50 / habitatIntegrity 70 / seedVault 100(C6부터 표시) / waterSecurity 30(C7부터 표시) / fuelMargin 2(단계).
**바닥값과 비상 회복**: oxygenReserve 20, water 15, food 15, power 15에 닿으면 비상 탱크·비상팩·예비 전지 이벤트가 개입해 바닥값 위로 되돌린다. 게임오버·사망 없음.

## 3. 챕터 FSM
intro → consent → prologue → c1_tutorial → c1_explore → c1_roster → c1_confirm → c1_locked → c1_farewell → c1_seating → c2_cargo → c2_sealed → c3_preflight → c3_diagnose → c3_reveal → c3_scale → c3_ignition → c3_ascent → c4_montage → c4_repair → c4_freetime → c4_video → c4_signal → c4_scale → c5_approach → c5_sites → c5_descent → c5_eva → c5_airlock → c6_intro → c6_diagnose → c6_reveal → c6_power → c6_restart → c7_map → c7_scale → c7_rover → c7_drill → c7_purify → c7_return → c8_dinner → c8_message → c8_board → c8_scale → c8_answer → c8_charter → ending → mirror_recap → results
- 상태마다 진입 조건(guard)과 퇴장 조건. 막히면 녹녹이 힌트 3단계(가벼운 힌트 → 위치 표시 → 자동 정렬 제안). 힌트 사용은 측정과 무관.
- 서사 시계: C1(T-04:00:00), C3(T-14:00)은 의미 있는 행동마다 정해진 만큼만 줄어든다. 실시간으로 줄지 않고, 0 직전에서 멈추며 담이 '아직 괜찮아'라고 말한다.

## 4. 메아리 테이블 (서사 상태 변화 · 전부 STORY)

| 원인 | 결과 |
|---|---|
| C1 미선발 2명 | legacyItemIds 2개, C4 음성 편지 화자, C8 회상 카드 |
| C2 예비 부품 | C3-b 투하 불필요, C6 power +5 |
| C2 씨앗 / 붉은감자-7 | C6 종자 손실 완화, C8 새싹 종류 |
| C2 음악·기록 / 목소리 드라이브 | C6 기록 손실 완화, C8 음악 |
| C2 정수 필터 | C7 정수 1단계 단축 |
| C2 바느질 키트 / 머플러+수선 키트 | C5 우주복 패치 경로 |
| C2 토양 샘플 | C8 지구 흙 새싹 |
| C2 놀이 상자 / 사진 | C8 저녁 놀이 장면 / C4 조용한 장면·C8 벽 |
| C3 a 보람 / b 예비 밸브 / c 재보정 | flag boram_reset / 부품 소모 또는 짐 3kg 투하 / habitatIntegrity -10 |
| C4 수리 완료 / 영상 함께 재생 | water +10 / trust +5 |
| C4 a / b / c | water -20·oxygenReserve -15 / fuelMargin -1(γ 불가)·food -10·trust +5·flag dam_call / archive +5 |
| C5 α / β / γ | power -10 / oxygenReserve -8 / habitatIntegrity -5·C7 얼음 성과 +10 |
| C5 포드 분리 / 선회 | flag pod_released(C7 회수 전까지 짐 효과 없음) / oxygenReserve -8 |
| C6 위기 · 전력 분배 · 재시동 | oxygenReserve -20 → 재시동 +5~+25(산소 토큰 0~3), 종자 -40×(3-토큰)/3(씨앗·진우주 시 -25 기준), 기록 -30×(3-토큰)/3(음악·목소리 드라이브 시 -15 기준), 난방 trust -10×(3-토큰)/3, 예비 부품 시 power +5 |
| C7 a / b / c / EVA 동행 | waterSecurity +40 / +15·archive +10·flag ilkkun / 짐 복구·trust +5 또는 waterSecurity +20 / waterSecurity +10·food -8 |
| C8 결정 방식·문·대답·이름 | 헌장 3문장, 엔딩 변주, 받는다 시 food -5 (대답은 엔딩 종류를 바꾸지 않음) |

**측정 중립성**: 이 표의 어떤 원인도 채점 포크가 아니며, 어떤 채점 포크도 이 표에 등장하지 않는다(자동 테스트 measurementNeutrality).

## 5. 미니게임
모두 키보드(Tab · 방향키 · Enter · Space · Esc)와 탭 대체 조작, 44px 터치 타깃, 실패 없는 진행(fail-forward). 성공·속도·실수는 측정에 쓰지 않는다.

| ID | 장 | 핵심 조작 | 규칙 요약 | 막힘 방지 |
|---|---|---|---|---|
| M0 CableHunt | 프롤로그 | 이동 · 상호작용 | 녹녹이 충전 케이블 찾기. UI 유형 전부 1회 체험(비채점) | 일정 행동 후 녹녹이가 스스로 발견 |
| M1 BoardingRoster | C1 | 드래그 / 탭 배정 | 6카드 → 4슬롯, 교체·취소, 저장 슬롯 3, 역량 레이더, 4명 전 확정 비활성 | ― |
| M2 CargoGrid | C2 | 드래그 / 탭 적재 | 10물품, 좌우 적재함, 총 ≤12kg, 각 ≤7kg, 차 ≤4kg, 기울기 계측기 | [자동 균형 제안] |
| M3 ValveWiring | C3 | 선 연결 + 테스트 | 센서 3 → 진단 버스 4포트, 라인 테스트 파형, 두 원인 찾기 | 3회 실패 시 정답 라인 깜박임 |
| M3b IgnitionHold | C3 | 길게 누르기 | 3단 추력 바를 녹색 띠에 유지 | 벗어나면 녹녹이 보정 |
| M4 PipeRoute | C4 | 타일 회전 | 5×4 관로, 필터·펌프·밸브 우선순위, 표준/새 경로 두 해답 | 회전 힌트 |
| M5 LandingSites + Descent | C5 | 지도 비교 + 자세 제어 | 3후보 레이어, 좌우·추력으로 안전 원뿔 유지, 돌풍 이벤트, 단계 모드 | 자동 안정화 |
| M5b EvaWalk | C5 | 탑다운 이동 | 38% 중력 통통 걸음, 거리 표지판, 사고 처치 분기 | 경로 안내선 |
| M6 LifeSupport | C6 | 진단 + 토큰 배분 + 순서 카드 | 4계통 다이어그램, 전력 토큰 6개(생명유지 최소치 잠금), 4단계 재시동 순서 | 잘못된 순서는 MIRROR 설명 후 재시도 |
| M7 IceRover | C7 | 레이어 격자 + 턴제 주행 + 시추 + 정수 | 3×4 격자, 배터리 칸, 경사 회피, 토크·온도 유지, 5단계 정수 | 로버 고장 시 '삽' 또는 예비 수레 |
| M8 CharterBoard | C8 | 카드 초안 + 교대 보드 + 투표 연출 | 규칙 초안 카드, 4업무 × 3교대 토큰(휴식 제약), 결정 방식 적용 | 자동 채우기 제안 |

**포크 변형 동등성**: O02 포크가 걸린 미니게임은 [표준]/[새] 두 레이아웃을 갖고, 타일 수·필요 조작 수·예상 단계가 ±10% 이내(테스트 forkParity).

## 6. 해석기와 15편성 보증
- resolveRole(role, crewIds), pickSpeaker(slotId, crewIds, location): 슬롯마다 우선순위 목록 + 장소별 최종 대체(지구: 담·녹녹이·보람 / 선내: 담·녹녹이 / 화성: 담·녹녹이·MIRROR).
- 저울 지지·우려 목소리, 요청 카드(O05 발신자), 케미 장면 모두 같은 해석기를 쓴다.
- 스폰 규칙: 맵 NPC = crewIds ∪ 고정 인물. 미선발자는 C1 작별 이후 스프라이트 팩토리 단계에서 생성 불가.
- 보증: 15편성 × 모든 대사 슬롯 × 모든 장면 → 화자 ∈ crew ∪ fixed, 미선발자 0회, 장면 수 동일, 필수 경로 완주 가능.

## 7. 재미 시스템 (전부 비채점, 채점 기회와 위치·보상 분리)
- **케미 15쌍**: 6C2=15쌍마다 짧은 장면. 한 판에 승선 4명 → 6쌍 중 4개 노출(C4 몽타주 2, C6 1, C8 1). 결과 화면 '케미 앨범'에 수집.
  하린+태오 30년 된 작업복 소매 수선 / 하린+서진 응급 키트에 바느질 라벨 / 하린+진우주 머플러 실로 화분 지지대 / 하린+도담 대피소 아이들 이름 자수 / 하린+지오 '삽'의 옷 / 태오+서진 '숫자부터 보자' 동시에 말하기 / 태오+진우주 '찻잎도 필터야!' 논쟁 / 태오+도담 정비 구술사 녹음 / 태오+지오 렌치 대 로봇 언쟁 끝에 같이 고침 / 서진+진우주 화성 첫 녹차 시음회(서진이 카페인 양부터 잰다) / 서진+도담 심장 소리 녹음 '살아 있다는 기록' / 서진+지오 손 베인 지오 '로봇은 안 다치는데' / 진우주+도담 화분에 지구 도시 이름 붙이기 / 진우주+지오 자동 물주기 실패로 작은 물난리 / 도담+지오 '삽'이 아이들 노래를 부른다
- **지구 조각 24개**: 장마다 숨은 조사 오브젝트 3개(크레용 그림, 추첨함 영수증, 마지막 학교 종 사진 등). 도감 수집.
- **녹녹이 × MIRROR**: C5 질투 → C6 선후배 소동 → C7 '형이 생겼어요' → 엔딩 숨은 춤(일꾼-3 회수 시).
- **장면 도감**: 결과 화면에 '이번 판에서 보지 못한 장면 n개'(실루엣만). 15편성 × 저울 조합이 리플레이 동기.
- **손맛**: 스냅, 반짝 피드백, 표정 변화, 작은 떨림(모션 감소 시 정지 이미지).
- **사진 모드**: 엔딩 미장센을 PNG로 로컬 저장.

## 8. 아트 디렉션 (v1 §2 유지 + 추가)
- 팔레트 토큰(v1): --ink #283044, --night #171D34, --earth #547E9D, --alert #F48B70, --mars #D99573, --mars-shadow #9E6680, --glass #E9F3EF, --warm #FFF4DA, --mint #96D9BC, --highlight #FFD47B.
- 스프라이트 24×32, 2~2.5등신, 4방향 걷기 2~4프레임, 표정 3종 이상. 정수 배율, nearest-neighbor.
- 인물 9명(플레이어·담·하린·태오·서진·진우주·도담·지오·보람) + 로봇 3기(녹녹이·MIRROR 패널·일꾼-3) + 무전 초상(담희).
- 맵 4종(지하 발사장 / 아크-06 내부 / 화성 표면 / 제로돔 내부) + 챕터 변형 레이어. y-sort, 그림자, 전경, 파티클(재·먼지·별).
- 선택/제외 표시에 선악 색(빨강·초록) 금지 → 하이라이트 노랑 vs 중립 회색 + 아이콘·텍스트.
- 품질 게이트: 타이틀·C1·C6를 1366×768, 390×844에서 캡처해 같은 수준인지 검토.

## 9. 접근성 · 설정
prefers-reduced-motion, 모션 강도 3단계, 재난 연출 강도 조절, 효과음 기본 OFF, 자막 상시, 글자 크기 3단계, 키보드 전 기능, 드래그의 탭 대체, 프롤로그 스킵, 시작 전 내용 안내(재난·생존자 선별·가족과의 이별). 입력 방식은 측정에 반영하지 않는다.

## 10. 테스트 계획 (v1 §9 전부 + v2 추가)

| 테스트 | 내용 |
|---|---|
| roster | 0~3명 확정 불가, 교체·취소, 중복 불가, 잠금 후 변경 불가 |
| fifteenRosters | 15편성 × 전 장면: 스폰·화자·장면 수·완주 |
| absenceFallback | 6명 각각 부재 시 대체 경로 존재 |
| dilemmaBalance | 저울마다 각 선택지가 비용 1개 이상, 지배 선택지 없음 |
| measurementNeutrality | 포크 양쪽 선택 시 MissionState diff = 0 |
| analyticsIsolation | 같은 이벤트 + 15편성 + 하린 유무 → 점수 동일, 금지 import 0 |
| forkParity / counterbalance | 변형 레이아웃 ±10%, 표시 순서 시드 회전 + 위치 기록 |
| idempotency | 중복 클릭·새로고침·재진입 시 기회당 1회 확정 |
| resourceInvariants | 0..100, 바닥값 회복, 산소 0 미만 불가 |
| endingsReachable | 4엔딩 모두 도달 경로 존재 |
| persistence | 저장·이어하기·초기화·동의 해제·구버전 거부 |
| recoverySim | 03_MEASUREMENT §10 합성 플레이어 시뮬레이션 리포트 |
| e2e | 전체 완주(1366×768, 390×844), 저장·재개 |

## 11. 개발 단계 (v2)
- **Phase A** 골격(Vite·TS·Phaser·단일 HTML 빌드) + 상태·저장·FSM + 타이틀·동의·프롤로그 + C1 수직 슬라이스(발사장 맵, 인물 스프라이트 1차, 튜토리얼, 명단 보드, 권고 반전, 작별·유산, 좌석 포크). 캡처 2종으로 품질 검토 후 다음 단계.
- **Phase B** 아트 패스(4개 맵, 표정·걷기), C2·C3.
- **Phase C** C4~C8, 메아리, 15편성 해석기, 엔딩·선택의 거울.
- **Phase D** 측정 엔진·결과 화면·개인정보·접근성.
- **Phase E** 전체 검증 → README · MEASUREMENT_LIMITATIONS · TEST_REPORT.
