import { h, clear, pxImg } from './dom';
import { lines, type ModalHost, infoPanel } from './panels';
import { PLAYER_LOOKS } from '../art/look';
import { portraitURL } from '../art/sprites';
import type { PlayerProfile } from '../core/state';
import type { Settings } from '../core/persistence';

export function showTitle(root: HTMLElement, opts: {
  canContinue: boolean;
  saveNote: string | null;
  persistent: boolean;
  onNew: () => void;
  onContinue: () => void;
  onAbout: () => void;
  onSettings: () => void;
}): void {
  clear(root);
  root.className = 'show title';
  root.append(
    h('div', { class: 'title-screen' },
      h('h1', { class: 'logo' }, h('span', { class: 'logo-en' }, 'MIRROR: LAST EARTH'), h('span', { class: 'logo-ko' }, '마지막 지구인')),
      h('nav', { class: 'title-menu', 'aria-label': '시작 메뉴' },
        h('button', { class: 'btn primary big', type: 'button', onClick: opts.onNew }, '마지막 배에 타기'),
        h('button', { class: 'btn big', type: 'button', disabled: !opts.canContinue, onClick: opts.onContinue }, '이어하기'),
        h('button', { class: 'btn', type: 'button', onClick: opts.onAbout }, '어떤 게임인가요'),
        h('button', { class: 'btn', type: 'button', onClick: opts.onSettings }, '설정'),
      ),
      opts.saveNote ? h('p', { class: 'note' }, opts.saveNote) : null,
      h('p', { class: 'title-foot' },
        '가상의 2087년을 그린 창작 게임 · 행동 기록은 이 기기 브라우저에만 저장돼요',
        opts.persistent ? null : ' · (이 환경에서는 브라우저 저장이 막혀 있어 새로고침하면 기록이 사라져요)'),
    ),
  );
}

export function showConsent(root: HTMLElement, onChoose: (optIn: boolean) => void): void {
  clear(root);
  root.className = 'show paper';
  root.append(
    h('div', { class: 'paper-card' },
      h('h2', {}, '시작하기 전에'),
      h('section', {},
        h('h3', {}, '내용 안내'),
        h('p', {}, '이 이야기에는 재난, 생존자 선별, 가족·친구와의 이별이 나와요. 죽음이나 잔혹한 장면은 나오지 않아요. 설정에서 움직임과 연출 강도를 줄일 수 있어요.'),
      ),
      h('section', {},
        h('h3', {}, '행동 기록 안내'),
        h('p', {}, '게임은 플레이하는 동안 "어떤 방식으로 일했는지"를 기록해서, 마지막에 탐색적인 결과(MBTI 스타일 4글자와 빅파이브 경향)를 보여 줘요.'),
        lines([
          '공식 MBTI® 검사나 심리검사가 아니에요. 게임 속 행동으로 추정한 비공식 결과예요.',
          '누구를 태웠는지, 무엇을 희생했는지 같은 도덕적 결정은 결과에 절대 쓰지 않아요.',
          '기록은 이 기기의 브라우저에만 저장되고 어디로도 전송되지 않아요. 언제든 지울 수 있어요.',
          '분석 없이 플레이해도 이야기는 똑같이 진행돼요(결과지만 만들지 않아요).',
        ]),
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: () => onChoose(false) }, '분석 없이 플레이'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => onChoose(true) }, '행동 분석 켜고 시작'),
      ),
    ),
  );
}

export function showSetup(root: HTMLElement, onDone: (p: PlayerProfile) => void): void {
  clear(root);
  root.className = 'show paper';
  let look = 0;
  let relation: PlayerProfile['relation'] = 'sibling';
  const input = h('input', { type: 'text', maxlength: '12', placeholder: '시민 대표', 'aria-label': '이름', class: 'text-input' });
  const looksRow = h('div', { class: 'looks', role: 'group', 'aria-label': '외형' });
  const relRow = h('div', { class: 'row', role: 'group', 'aria-label': '하린과의 관계' });
  const draw = (): void => {
    clear(looksRow);
    PLAYER_LOOKS.forEach((L, i) => looksRow.append(
      h('button', { class: `look-btn${look === i ? ' on' : ''}`, type: 'button', 'aria-pressed': String(look === i), onClick: () => { look = i; draw(); } },
        pxImg(portraitURL(L, 'joy'), `외형 ${i + 1}`, 'look'))));
    clear(relRow);
    ([['sibling', '하린은 나의 동생'], ['friend', '하린은 나의 오랜 친구']] as const).forEach(([v, label]) => relRow.append(
      h('button', { class: `btn${relation === v ? ' primary' : ''}`, type: 'button', 'aria-pressed': String(relation === v), onClick: () => { relation = v; draw(); } }, label)));
  };
  draw();
  root.append(
    h('div', { class: 'paper-card' },
      h('h2', {}, '시민 대표'),
      h('p', { class: 'muted' }, '난민 자치회의 공개 추첨으로 뽑힌 평범한 시민이에요. 여기서 고르는 것은 이야기의 호칭과 모습만 바꾸고, 결과에는 쓰이지 않아요.'),
      h('label', { class: 'field' }, h('span', {}, '이름'), input),
      h('div', { class: 'field' }, h('span', {}, '모습'), looksRow),
      h('div', { class: 'field' }, h('span', {}, '하린과의 관계'), relRow),
      h('div', { class: 'row' }, h('button', { class: 'btn primary big', type: 'button', onClick: () => onDone({ name: input.value.trim() || '시민 대표', look, relation }) }, '발사장으로')),
    ),
  );
  input.focus();
}

/** 콜드 오픈. 클릭/Enter로 넘기고, 언제든 건너뛸 수 있다. 강제 대기 없음. */
export function runPrologue(root: HTMLElement, reduced: boolean): Promise<void> {
  const frames: { cls: string; caption?: string; text: string; sub?: string }[] = [
    { cls: 'beeps', text: '· · ·', sub: '[짧은 비프음 세 번]' },
    { cls: 'curve', caption: '2087.11.19 / 지구 비상방송', text: '푸른 곡선 너머, 먼 섬광.' },
    { cls: 'wave', caption: '방송', text: '전 세계 피난 방송을 종료합니다. 이 방송은 마지막입니다.' },
    { cls: 'silence', text: '……', sub: '[2초 무음]' },
    { cls: 'bunker', text: '정전된 지하 발사장. 웅크린 사람들 위로, 창밖의 재가 내린다.' },
  ];
  return new Promise((resolve) => {
    let i = 0;
    let timer: number | undefined;
    const finish = (): void => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      clear(root);
      root.className = '';
      resolve();
    };
    const next = (): void => {
      i += 1;
      if (i >= frames.length) finish();
      else draw();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') { e.preventDefault(); next(); }
    };
    const draw = (): void => {
      window.clearTimeout(timer);
      const f = frames[i];
      clear(root);
      root.className = `show prologue ${f.cls}${reduced ? ' still' : ''}`;
      const stage = h('div', { class: 'pro-stage', onClick: next },
        f.cls === 'curve' ? h('div', { class: 'pro-earth', 'aria-hidden': 'true' }) : null,
        f.cls === 'wave' ? h('div', { class: 'pro-wave', 'aria-hidden': 'true' }, ...Array.from({ length: 24 }, (_, k) => h('i', { style: { animationDelay: `${(k % 8) * 0.09}s` } }))) : null,
        f.caption ? h('p', { class: 'pro-caption' }, f.caption) : null,
        h('p', { class: 'pro-text' }, f.text),
        f.sub ? h('p', { class: 'pro-sub' }, f.sub) : null,
        h('p', { class: 'pro-hint' }, '화면을 누르거나 Enter로 넘기기'),
      );
      root.append(
        stage,
        h('button', { class: 'btn small pro-skip', type: 'button', onClick: finish }, '건너뛰기'),
        h('p', { class: 'pro-fiction' }, '이 이야기는 가상의 2087년을 배경으로 한 창작이에요.'),
      );
      timer = window.setTimeout(next, 4200);
    };
    document.addEventListener('keydown', onKey);
    draw();
  });
}

export function aboutPanel(host: ModalHost): Promise<void> {
  return infoPanel(host, '어떤 게임인가요', h('div', { class: 'about' },
    h('p', {}, '지구가 끝나는 날, 아무 권력도 없는 보통 사람이 마지막 우주선의 네 좌석에 누구를 태울지 정하고, 7개월을 날아 화성에 새로운 공동체를 만드는 이야기예요.'),
    h('h3', {}, '이야기와 실제의 구분'),
    lines([
      '2087년의 혜성 파편 재난, 아크-06, 제로돔, 모든 수치는 게임 속 창작이에요. 실제 미래 예측이나 NASA의 공식 계획이 아니에요.',
      '지구는 폭발하지 않아요. 검붉은 지구는 지표의 재난과 문명 붕괴를 극적으로 표현한 SF 연출이에요.',
      '실제 화성은 중력이 지구의 약 38%이고, 대기는 매우 희박하며 대부분 이산화탄소라 맨몸으로 숨쉴 수 없어요. 하루는 약 24시간 37분이에요.',
      '화성은 지구보다 훨씬 살기 어려운 곳이에요. 이 게임은 지구를 떠나는 것이 좋은 해답이라고 말하지 않아요.',
    ]),
    h('h3', {}, '빨리 진행하고 싶다면'),
    lines([
      '[녹녹이에게 맡기기]: 퍼즐·작업 화면에서 누르면 녹녹이가 대신 풀고 바로 다음 이야기로 넘어가요. 귀찮을 때 쓰는 스킵 버튼이에요. 매번 누르기도 귀찮다면 메뉴 › 설정 › 퍼즐에서 자동 진행으로 바꿀 수 있어요.',
      '[⏩ 대화 넘기기]: 대사가 길 때 대화창에서 누르면 그 대화의 남은 줄을 한 번에 넘겨요. 고르는 순간(선택지)은 건너뛰지 않아요.',
      '맡기거나 건너뛰어도 이야기·엔딩·결과지는 똑같이 이어져요.',
    ]),
    h('h3', {}, '행동 분석'),
    lines([
      '탐색형 행동 분석 게임이에요. 임상검사, 공식 MBTI® 검사, 채용 평가 도구가 아니에요.',
      '"동등하게 괜찮은 두 방식 중 무엇을 골랐는지" 같은 행동만 쓰고, 누구를 태웠는지·도덕적 결정은 쓰지 않아요.',
      '빅파이브 신경성(N)은 짧은 게임과 위기 상황만으로 추정하지 않아요.',
      '기록은 이 기기 브라우저에만 저장되고 전송되지 않아요.',
    ]),
  ));
}

export function settingsPanel(host: ModalHost, current: Settings, onChange: (s: Settings) => void, extra?: Node): Promise<void> {
  let s = { ...current };
  const body = h('div', { class: 'settings' });
  const draw = (): void => {
    clear(body);
    const group = <T extends string | number | boolean>(label: string, options: [T, string][], value: T, set: (v: T) => void): HTMLElement =>
      h('div', { class: 'field' }, h('span', {}, label), h('div', { class: 'row', role: 'group', 'aria-label': label },
        ...options.map(([v, l]) => h('button', { class: `btn small${v === value ? ' primary' : ''}`, type: 'button', 'aria-pressed': String(v === value), onClick: () => { set(v); onChange(s); draw(); } }, l))));
    body.append(
      group<0 | 1 | 2>('글자 크기', [[0, '작게'], [1, '보통'], [2, '크게']], s.textScale, (v) => { s = { ...s, textScale: v }; }),
      group<boolean>('움직임 줄이기', [[false, '끄기'], [true, '켜기']], s.reducedMotion, (v) => { s = { ...s, reducedMotion: v }; }),
      group<0 | 1 | 2>('재난 연출 강도', [[0, '약하게'], [1, '보통'], [2, '강하게']], s.intensity, (v) => { s = { ...s, intensity: v }; }),
      group<'auto' | 'manual'>('퍼즐', [['manual', '직접 풀기'], ['auto', '녹녹이에게 맡기기 (자동 진행)']], s.puzzles, (v) => { s = { ...s, puzzles: v }; }),
      h('p', { class: 'muted small field-note' }, s.puzzles === 'auto'
        ? '퍼즐이 나오면 녹녹이가 알아서 풀고 바로 넘어가요. 귀찮은 사람을 위한 스킵·자동 진행 모드예요. 결과·엔딩에는 영향이 없어요.'
        : '퍼즐을 직접 풀어요. 한 번 틀리면 정답이 반짝이고, 막히면 언제든 [녹녹이에게 맡기기]를 눌러 건너뛸 수 있어요.'),
      h('p', { class: 'muted small' }, '효과음은 아직 없어요(기본 꺼짐). 움직임 설정은 다음 장면부터 완전히 적용돼요.'),
      extra ?? '',
    );
  };
  draw();
  return infoPanel(host, '설정', body);
}

export function showChapterEnd(root: HTMLElement, opts: { title: string; items: string[]; note: string; onTitle: () => void; onWipe: () => void }): void {
  clear(root);
  root.className = 'show paper';
  root.append(
    h('div', { class: 'paper-card' },
      h('h2', {}, opts.title),
      lines(opts.items),
      h('p', { class: 'note' }, opts.note),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: opts.onWipe }, '기록 삭제'),
        h('button', { class: 'btn primary', type: 'button', onClick: opts.onTitle }, '타이틀로'),
      ),
    ),
  );
}
