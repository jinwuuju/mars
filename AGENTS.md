# AGENTS — MIRROR: LAST EARTH (v2)

## 기준 문서 (이 순서로 완독 후 코딩)
1. design/00_INDEX.md
2. design/01_STORY_BIBLE_v2.md
3. design/02_GAME_SYSTEMS_v2.md
4. design/03_MEASUREMENT_v2.md
5. design/04_BEHAVIOR_MATRIX_v2.csv
6. SCIENCE_AND_ETHICS.md (최상위 가드레일, 충돌 시 이 문서가 우선)

docs/v1_original/은 참고용이다. v2와 충돌하면 v2가 우선한다. 모아마을 축제 관련 자산·장면 ID·UI 문구·채점 규칙은 하나도 남기지 않는다.

## 절대 규칙
- 실제로 움직이는 한국어 2D 픽셀아트 게임을 만든다. 랜딩페이지·카드형 설문 금지.
- 오리지널 그래픽만 쓴다. 기존 IP의 스프라이트·맵·캐릭터·로고 복제·트레이싱 금지.
- 탑승 명단, 제외, 희생, 유산, 8개의 저울, 엔딩 대답, 헌장 정책은 STORY 플래그 전용이다. 점수에 절대 쓰지 않는다.
- 점수는 04_BEHAVIOR_MATRIX_v2의 대칭 포크·대칭 핫스팟·2탭 패널 행위로만 계산한다. 채점 행위는 자원·대사 보상·엔딩·수집에 영향 0(측정 중립성).
- analytics 모듈은 crewIds·narrativeFlags·inventoryIds·legacyItemIds를 import하거나 읽을 수 없다.
- Big Five N은 v1에서 항상 '판단 자료 부족'이다. 위협 반응으로 N을 추론하지 않는다.
- 서버 전송·추적 SDK·CDN 없음. 로컬 저장만. 분석 끄기 모드를 지원한다.
- 실시간 타이머로 실패를 판정하지 않는다. 즉시 사망·영구 게임오버 금지.
- 결과는 검증된 심리검사가 아니다. 그렇게 보이게 쓰지 않는다.
- 완료하지 않은 기능을 완료라고 보고하지 않는다. 실제 실행한 검증만 실행했다고 쓴다.
