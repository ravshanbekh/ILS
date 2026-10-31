/**
 * "Tez yozish" — uchdan-uchgacha sinov (lokal baza + haqiqiy Socket.IO).
 *
 * Mashq (server hisoblagan WPM, shubhali natija), Socket kirish qoidalari,
 * duel / 4 kishilik / jamoaviy bellashuvlar (parallel), firibgarlik
 * (imkonsiz tez progress), ELO, reytinglar, admin marshrutlari,
 * jamoaviy 8 × 8 sig'imi, sinf musobaqasi (mentor ochadi, 20 o'quvchi, erta
 * yakunlash, reytingsiz, tarix + Excel, egalik tekshiruvi).
 * Fixture'lar "tpe2e" belgisi bilan yaratiladi va oxirida o'chiriladi.
 *
 * Ishlatish (backend papkasidan, LOKAL baza bilan):  npm run e2e:typing
 */
import http from 'http';

const PORT = Number(process.env.TYPING_E2E_PORT || 5097);
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
let failed = 0;
function check(name: string, cond: unknown, extra = '') {
  if (cond) {
    pass++;
    console.log(`  OK   ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    console.log(`  XATO ${name}${extra ? ' — ' + extra : ''}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { default: express } = await import('express');
  const { Server } = await import('socket.io');
  const { io: ioc } = await import('socket.io-client');
  const jwt = (await import('jsonwebtoken')).default;
  const { default: prisma } = await import('../src/config/database');
  const { env } = await import('../src/config/env');
  const { default: typingRoutes } = await import('../src/modules/typing/typing.routes');
  const { initTypingGateway } = await import('../src/modules/typing/typing.rooms');
  const { errorHandler } = await import('../src/shared/middleware/errorHandler');

  const app = express();
  app.use(express.json());
  app.use('/api/typing', typingRoutes);
  app.use(errorHandler);
  const server = http.createServer(app);
  const io = new Server(server);
  initTypingGateway(io);
  await new Promise<void>((r) => server.listen(PORT, r));

  const tag = `tpe2e${Date.now().toString(36)}`;
  const users: { id: string; token: string; name: string }[] = [];
  const mk = async (role: 'student' | 'teacher' | 'admin' | 'assistant', i: number) => {
    const u = await prisma.user.create({ data: { fullName: `TP ${role} ${i}`, login: `${tag}_${role}${i}`, passwordHash: 'x', role } });
    return { id: u.id, name: u.fullName, token: jwt.sign({ userId: u.id, role, login: u.login, tv: 0 }, env.JWT_SECRET) };
  };
  const S = [];
  for (let i = 1; i <= 27; i++) S.push(await mk('student', i));
  const teacher = await mk('teacher', 1);
  const teacher2 = await mk('teacher', 2);
  const assistant = await mk('assistant', 1);
  const admin = await mk('admin', 1);
  users.push(...S, teacher, teacher2, assistant, admin);
  const group = await prisma.group.create({ data: { name: `${tag}-G` } });
  await prisma.groupStudent.createMany({ data: S.slice(0, 2).map((s) => ({ groupId: group.id, studentId: s.id })) });

  const api = async (token: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}/api/typing${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as any };
  };

  const sockets: any[] = [];
  const connect = (token?: string) =>
    new Promise<any>((resolve) => {
      const s = ioc(`${BASE}/typing`, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', (e: Error) => resolve({ error: e.message }));
    });
  const emit = (s: any, ev: string, data: unknown = {}) => new Promise<any>((r) => s.emit(ev, data, r));

  try {
    // ── 1. Mashq ──────────────────────────────────────────────────────────────
    console.log('\n0) Kontent');
    const { raceText, CODE_LANGS } = await import('../src/modules/typing/typing.content');
    let shortest = Infinity;
    for (const lang of CODE_LANGS) for (let k = 0; k < 40; k++) shortest = Math.min(shortest, raceText('code', lang).text.length);
    check('kod poygasi matni har doim yetarli uzun (barcha tillar × 40)', shortest >= 100, `eng qisqasi ${shortest}`);
    check('matn poygasi ~40 so\'z', raceText('text', 'uz').text.split(' ').length === 40);

    console.log('\n1) Mashq (solo)');
    const cat = await api(S[0].token, 'GET', '/catalog');
    check('katalog', cat.json?.data?.codeLangs?.includes('Python') && cat.json.data.durations.includes(60));
    const st = await api(S[0].token, 'POST', '/solo/start', { contentType: 'text', variant: 'uz', durationSec: 15 });
    check('solo start: matnni server beradi', st.status === 200 && st.json.data.text.split(' ').length >= 80, `${st.json?.data?.text?.slice(0, 40)}…`);
    const tst = await api(teacher.token, 'POST', '/solo/start', { contentType: 'text' });
    check('ustoz mashq sessiyasini ocholmaydi (faqat o\'quvchi)', tst.status === 403);
    const early = await api(S[0].token, 'POST', '/solo/finish', {
      sessionId: st.json.data.sessionId, elapsedMs: 15000,
      counts: { correctChars: 250, totalKeys: 260, errors: 10, maxCombo: 40 },
    });
    check('15 s mashqni darhol yuborish → shubhali (flagged)', early.json?.data?.result?.flagged === true, early.json?.data?.result?.flagReason);
    const again = await api(S[0].token, 'POST', '/solo/finish', { sessionId: st.json.data.sessionId, elapsedMs: 15000, counts: { correctChars: 1, totalKeys: 1, errors: 0, maxCombo: 1 } });
    check('sessiya bir martalik', again.status === 400);
    const code = await api(S[1].token, 'POST', '/solo/start', { contentType: 'code', variant: 'Python' });
    const codeFin = await api(S[1].token, 'POST', '/solo/finish', {
      sessionId: code.json.data.sessionId, elapsedMs: 30000,
      counts: { correctChars: code.json.data.text.length, totalKeys: code.json.data.text.length, errors: 0, maxCombo: 50 },
    });
    check('kod: mijoz 30 s desa ham server oynasi bilan cheklanadi → imkonsiz tezlik flagged', codeFin.json?.data?.result?.flagged === true, codeFin.json?.data?.result?.flagReason);
    // Halol 15 s mashq — parallel kutamiz (bellashuvlar bilan birga)
    const honest = (async () => {
      const s2 = await api(S[2].token, 'POST', '/solo/start', { contentType: 'text', variant: 'en', durationSec: 15 });
      await sleep(15300);
      return api(S[2].token, 'POST', '/solo/finish', {
        sessionId: s2.json.data.sessionId, elapsedMs: 15000,
        counts: { correctChars: 75, totalKeys: 80, errors: 5, maxCombo: 30 }, // 75 belgi / 5 / 0.25 daq = 60 wpm, 94%
      });
    })();

    // ── 2. Socket kirish ──────────────────────────────────────────────────────
    console.log('\n2) Socket kirish qoidalari');
    const anon = await connect();
    check('tokensiz → AUTH_REQUIRED', anon.error === 'AUTH_REQUIRED', anon.error);
    const tch = await connect(teacher.token);
    check('ustoz ulanadi (sinf musobaqasi uchun)', tch.connected === true, tch.error);
    const ast = await connect(assistant.token);
    check('assistent → STUDENTS_ONLY', ast.error === 'STUDENTS_ONLY', ast.error);
    const c: any[] = [];
    for (const s of S) c.push(await connect(s.token));
    check('27 o\'quvchi ulandi', c.every((x) => x.connected));

    // ── 3. Lobby'lar ──────────────────────────────────────────────────────────
    console.log('\n3) Xonalar va lobby');
    const duel = await emit(c[0], 'room:create', { mode: 'duel', contentType: 'text', variant: 'en' });
    check('duel xona yaratildi', duel.ok && duel.room.code.length === 5 && duel.room.maxPlayers === 2);
    check('lobby\'da matn yopiq', duel.room.text === null && duel.room.textLength > 100);
    const watch = await emit(c[9], 'lobbies:watch');
    check('ochiq xonalar ro\'yxati', watch.rooms.some((r: any) => r.code === duel.room.code));
    const soloStart = await emit(c[0], 'room:start');
    check('1 kishi bilan boshlab bo\'lmaydi', !soloStart.ok);
    const j2 = await emit(c[1], 'room:join', { code: duel.room.code.toLowerCase() });
    check('kod bilan qo\'shilish (katta-kichik harf farqsiz)', j2.ok && j2.room.players.length === 2);
    const j3 = await emit(c[9], 'room:join', { code: duel.room.code });
    check('duel to\'la → 3-o\'yinchi rad', !j3.ok && j3.error.includes('to\'la'));
    const notHost = await emit(c[1], 'room:start');
    check('faqat xona egasi boshlaydi', !notHost.ok);

    const ffa = await emit(c[2], 'room:create', { mode: 'ffa', contentType: 'code', variant: 'JavaScript' });
    for (const i of [3, 4, 5]) await emit(c[i], 'room:join', { code: ffa.room.code });
    const team = await emit(c[6], 'room:create', { mode: 'team', contentType: 'text', variant: 'uz', isPrivate: true });
    check('yopiq xona ochiq ro\'yxatda yo\'q', !(await emit(c[9], 'lobbies:watch')).rooms.some((r: any) => r.code === team.room.code));
    await emit(c[7], 'room:join', { code: team.room.code });
    const teamState1 = (await emit(c[7], 'room:join', { code: team.room.code })).room;
    check('jamoaga avtomatik taqsimlash (A, B)', teamState1.players.map((p: any) => p.team).sort().join('') === 'AB');
    await emit(c[7], 'room:team', { team: 'A' });
    const oneTeam = await emit(c[6], 'room:start');
    check('bitta jamoa bo\'sh → boshlab bo\'lmaydi', !oneTeam.ok && oneTeam.error.includes('jamoada'));
    await emit(c[8], 'room:join', { code: team.room.code });
    await emit(c[8], 'room:team', { team: 'B' });
    await emit(c[9], 'room:join', { code: team.room.code });
    await emit(c[9], 'room:team', { team: 'B' });

    // Kick sinovi: c[9] ni chiqarib, qaytadan qo'shamiz
    const kick = await emit(c[6], 'room:kick', { userId: S[9].id });
    check('xona egasi lobby\'dan chiqara oladi', kick.ok);
    await emit(c[9], 'room:join', { code: team.room.code });
    await emit(c[9], 'room:team', { team: 'B' });

    // ── 4. Poyga ──────────────────────────────────────────────────────────────
    console.log('\n4) Bellashuvlar (parallel)');
    const states = new Map<string, any>();
    c.forEach((s, i) => s.on('room:state', (r: any) => states.set(`${i}`, r)));
    const startD = await emit(c[0], 'room:start');
    const startF = await emit(c[2], 'room:start');
    const startT = await emit(c[6], 'room:start');
    check('uchala xona boshlandi', startD.ok && startF.ok && startT.ok, [startD.error, startF.error, startT.error].join(' '));
    await sleep(3300);
    const textOf = (i: number) => states.get(`${i}`)?.text as string;
    check('sanoqdan keyin matn ochildi va hammada bir xil', textOf(0) && textOf(0) === textOf(1) && textOf(2) === textOf(5));

    // Simulyatsiya: har o'yinchi o'z tezligida (belgi/soniya)
    const stopRace = new Set<number>();
    const race = (i: number, cps: number, cheat = false) =>
      (async () => {
        const len = textOf(i).length;
        const t0 = Date.now();
        let errors = 0;
        for (;;) {
          await sleep(400);
          const el = (Date.now() - t0) / 1000;
          const pos = cheat ? len : Math.min(len, Math.floor(el * cps));
          if (Math.random() < 0.3) errors++;
          c[i].emit('race:progress', { pos, keys: pos + errors, errors, maxCombo: Math.min(pos, 40) });
          if (pos >= len && (!cheat || (states.get(`${i}`)?.players ?? []).find((p: any) => p.userId === S[i].id)?.finishedAt)) break;
          if (states.get(`${i}`)?.status === 'finished') break; // mentor erta yakunladi
          if (stopRace.has(i)) break; // o'yinchi chiqib ketdi — holat endi unga kelmaydi
          if (el > 70) break;
        }
      })();
    await Promise.all([
      race(0, 20), race(1, 14), // duel
      race(2, 18), race(3, 16), race(4, 12), race(5, 0, true), // ffa — 5-chi firibgar
      race(6, 16), race(7, 15), race(8, 10), race(9, 11), // team: A (6,7) tezroq
    ]);
    await sleep(1500);

    const res = (i: number) => states.get(`${i}`)?.results;
    const d = res(0);
    check('duel natijasi', d?.players?.length === 2 && d.players[0].userId === S[0].id && d.players[0].place === 1, JSON.stringify(d?.players?.map((p: any) => [p.place, p.wpm, p.delta])));
    check('duel: server WPM ≈ 20 cps → ~240 wpm emas, haqiqiy vaqt bo\'yicha', d?.players?.[0]?.wpm > 150 && d.players[0].wpm < 260, `${d?.players?.[0]?.wpm}`);
    check('duel: ELO +16 / −16', d?.rated && d.players[0].delta === 16 && d.players[1].delta === -16);
    const f = res(2);
    const cheater = f?.players?.find((p: any) => p.userId === S[5].id);
    check('4 kishilik: firibgar belgilandi', cheater?.flagged === true);
    check('4 kishilik: firibgar bor → reyting o\'zgarmadi', f?.rated === false && f.players.every((p: any) => p.delta === 0));
    check('4 kishilik: o\'rinlar 1..4', f?.players?.map((p: any) => p.place).sort().join(',') === '1,2,3,4');
    const t = res(6);
    check('jamoaviy: g\'olib A', t?.winnerTeam === 'A', JSON.stringify(t?.teamAvg));
    check('jamoaviy: A a\'zolari 1-o\'rin, ELO +', t?.players?.filter((p: any) => p.team === 'A').every((p: any) => p.place === 1 && p.delta > 0));
    check('jamoaviy: B a\'zolari ELO −', t?.players?.filter((p: any) => p.team === 'B').every((p: any) => p.delta < 0));

    const dbMatches = await prisma.typingMatch.findMany({ where: { players: { some: { userId: { in: S.map((s) => s.id) } } } }, include: { players: true } });
    check('bazada 3 ta o\'yin', dbMatches.length === 3 && dbMatches.every((m) => m.status === 'finished' && m.text.length > 50));
    const r0 = await prisma.typingRating.findUnique({ where: { userId: S[0].id } });
    check('reyting bazada (1016, 1 g\'alaba)', r0?.rating === 1016 && r0.wins === 1);
    const r5 = await prisma.typingRating.findUnique({ where: { userId: S[5].id } });
    check('firibgarga reyting yozilmadi', !r5);

    // ── 5. Reyting va statistika ──────────────────────────────────────────────
    console.log('\n5) Reytinglar');
    const h = await honest;
    check('halol 15 s mashq qabul qilindi (60 wpm)', h.json?.data?.result?.flagged === false && h.json.data.result.wpm === 60, JSON.stringify(h.json?.data?.result));
    const lbText = await api(S[2].token, 'GET', '/leaderboard?category=text&period=week');
    const mine = lbText.json?.data?.top?.find((r: any) => r.userId === S[2].id);
    check('matn reytingida halol natija', !!mine && lbText.json.data.me?.userId === S[2].id);
    check('matn reytingida shubhali natija yo\'q', !lbText.json.data.top.some((r: any) => r.userId === S[0].id && r.value === 1000));
    const lbBattle = await api(S[0].token, 'GET', '/leaderboard?category=battle');
    check('jang reytingi: 1-o\'rin duel g\'olibi yoki jamoa', lbBattle.json?.data?.top?.[0]?.value >= 1016, JSON.stringify(lbBattle.json?.data?.top?.slice(0, 3).map((r: any) => [r.fullName, r.value])));
    const lbGroup = await api(S[0].token, 'GET', `/leaderboard?category=battle&groupId=${group.id}`);
    check('guruh filtri', lbGroup.json?.data?.top?.every((r: any) => [S[0].id, S[1].id].includes(r.userId)) && lbGroup.json.data.total === 2);
    const lbCode = await api(S[2].token, 'GET', '/leaderboard?category=code');
    check('kod reytingi (bellashuv natijalari ham kiradi)', lbCode.json?.data?.top?.some((r: any) => r.userId === S[2].id));
    const stats = await api(S[0].token, 'GET', '/me/stats');
    check('shaxsiy statistika', stats.json?.data?.battles === 1 && stats.json.data.rating.rating === 1016 && stats.json.data.recent.length >= 2);

    // ── 6. Admin ──────────────────────────────────────────────────────────────
    console.log('\n6) Admin');
    const ov = await api(admin.token, 'GET', '/admin/overview');
    check('admin overview', ov.json?.data?.testsLast7d >= 12 && ov.json.data.flagged7d >= 2, JSON.stringify(ov.json?.data?.matches7d));
    const ar = await api(admin.token, 'GET', '/admin/results?flagged=true&search=TP');
    check('admin natijalar (shubhali filtr)', ar.json?.data?.items?.length >= 2 && ar.json.data.items.every((i: any) => i.flagged));
    const am = await api(admin.token, 'GET', '/admin/matches?mode=team');
    check('admin o\'yinlar (jamoaviy)', am.json?.data?.items?.[0]?.players?.length === 4);
    const md = await api(admin.token, 'GET', `/admin/matches/${am.json.data.items[0].id}`);
    check('admin o\'yin tafsiloti', md.json?.data?.players?.length === 4 && md.json.data.results.length === 4);
    const ast2 = await api(admin.token, 'GET', `/admin/students/${S[0].id}/stats`);
    check('admin: o\'quvchi statistikasi', ast2.json?.data?.battles === 1);
    const live = await api(admin.token, 'GET', '/admin/live');
    check('admin: jonli xonalar', Array.isArray(live.json?.data));
    const forbidden = await api(S[0].token, 'GET', '/admin/overview');
    check('o\'quvchi admin marshrutiga kira olmaydi', forbidden.status === 403);

    // ── 7. Chiqib ketish ──────────────────────────────────────────────────────
    console.log('\n7) Chiqish va xona egasi');
    const lr = await emit(c[0], 'room:create', { mode: 'ffa', contentType: 'text' });
    await emit(c[1], 'room:join', { code: lr.room.code });
    await emit(c[0], 'room:leave');
    await sleep(200);
    const after = states.get('1');
    check('xona egasi chiqsa — egalik keyingi o\'yinchiga o\'tadi', after?.code === lr.room.code && after.hostId === S[1].id && after.players.length === 1);

    // ── 8. Jamoaviy 8 × 8 ─────────────────────────────────────────────────────
    console.log('\n8) Jamoaviy — 8 × 8 = 16');
    const big = await emit(c[10], 'room:create', { mode: 'team', contentType: 'text', isPrivate: true });
    check('jamoaviy xona 16 kishilik', big.ok && big.room.maxPlayers === 16, `${big.room?.maxPlayers}`);
    let bigState: any = big.room;
    for (let i = 11; i <= 25; i++) bigState = (await emit(c[i], 'room:join', { code: big.room.code })).room ?? bigState;
    const cntA = bigState.players.filter((p: any) => p.team === 'A').length;
    const cntB = bigState.players.filter((p: any) => p.team === 'B').length;
    check('16 o\'yinchi: A = 8, B = 8', bigState.players.length === 16 && cntA === 8 && cntB === 8, `A=${cntA} B=${cntB}`);
    const over = await emit(c[26], 'room:join', { code: big.room.code });
    check('17-o\'yinchi rad etiladi', !over.ok && over.error.includes('to\'la'), over.error);
    const aMember = bigState.players.find((p: any) => p.team === 'A').userId;
    const sw = await emit(c[S.findIndex((x) => x.id === aMember)], 'room:team', { team: 'B' });
    check('to\'la jamoaga o\'tib bo\'lmaydi (8 dan oshmaydi)', !sw.ok && sw.error.includes('to\'la'), sw.error);
    await emit(c[25], 'room:leave');
    const back = await emit(c[26], 'room:join', { code: big.room.code });
    check('joy bo\'shasa yana qo\'shiladi', back.ok && back.room.players.length === 16);

    // ── 9. Sinf musobaqasi ────────────────────────────────────────────────────
    console.log('\n9) Sinf musobaqasi (mentor)');
    const stuClass = await emit(c[0], 'room:create', { mode: 'class' });
    check('o\'quvchi sinf musobaqasini ocholmaydi', !stuClass.ok && stuClass.error.includes('mentor'), stuClass.error);
    const tDuel = await emit(tch, 'room:create', { mode: 'duel' });
    check('mentor oddiy xona ocholmaydi', !tDuel.ok, tDuel.error);
    const tJoin = await emit(tch, 'room:join', { code: big.room.code });
    check('mentor o\'yinchi bo\'lib qo\'shilmaydi', !tJoin.ok, tJoin.error);
    const cls = await emit(tch, 'room:create', { mode: 'class', title: '  3-guruh    bellashuvi ', contentType: 'text', variant: 'uz', size: 'short' });
    check('mentor musobaqa ochdi', cls.ok && cls.room.mode === 'class' && cls.room.maxPlayers === 200 && cls.room.isPrivate, cls.error);
    check('mentor o\'yinchilar ichida emas, nomi tozalangan', cls.room.players.length === 0 && cls.room.hostPlays === false && cls.room.title === '3-guruh bellashuvi' && cls.room.hostName === teacher.name);
    check('musobaqa ochiq ro\'yxatda ko\'rinmaydi', !(await emit(c[0], 'lobbies:watch')).rooms.some((r: any) => r.code === cls.room.code));
    const emptyStart = await emit(tch, 'room:start');
    check('hech kim kirmasa boshlab bo\'lmaydi', !emptyStart.ok && emptyStart.error.includes('hech kim'), emptyStart.error);

    let tstate: any = null;
    tch.on('room:state', (r: any) => (tstate = r));
    const CL = Array.from({ length: 20 }, (_, k) => k + 4); // S[4]…S[23] — 20 o'quvchi (jamoaviydan ko'p)
    let last: any = null;
    for (const i of CL) last = await emit(c[i], 'room:join', { code: cls.room.code.toLowerCase() });
    check('20 o\'quvchi kod bilan kirdi (oldingi xonalaridan avtomatik chiqib)', last.ok && last.room.players.length === 20, last.error);
    await sleep(100);
    check('mentor xona holatini oladi', tstate?.code === cls.room.code && tstate.players.length === 20);
    const kicked = new Promise<any>((r) => c[23].once('room:closed', r));
    const k1 = await emit(tch, 'room:kick', { userId: S[23].id });
    check('mentor o\'quvchini chiqara oladi', k1.ok && (await kicked).reason.includes('Mentor'));
    await emit(c[23], 'room:join', { code: cls.room.code });
    const stStart = await emit(c[4], 'room:start');
    check('o\'quvchi musobaqani boshlay olmaydi', !stStart.ok, stStart.error);
    const ratingsBefore = await prisma.typingRating.findMany({ where: { userId: { in: CL.map((i) => S[i].id) } } });

    const go = await emit(tch, 'room:start');
    check('mentor boshladi', go.ok, go.error);
    await sleep(3300);
    check('matn ochildi: mentor va o\'quvchida bir xil', !!tstate?.text && tstate.text === textOf(4) && tstate.status === 'running');
    const late = await emit(c[24], 'room:join', { code: cls.room.code });
    check('boshlangandan keyin kirib bo\'lmaydi', !late.ok && late.error.includes('boshlangan'), late.error);
    const early2 = await emit(c[4], 'room:finish');
    check('o\'quvchi yakunlay olmaydi', !early2.ok);

    const racers = CL.map((i, k) => race(i, k === 0 ? 22 : k === 1 ? 18 : k === 2 ? 15 : 2));
    await sleep(2500);
    stopRace.add(8);
    await emit(c[8], 'room:leave'); // bittasi o'rtada chiqib ketadi
    const clsLen = textOf(4).length;
    await sleep(Math.max(0, (clsLen / 15) * 1000 - 2500) + 1500); // 3 ta tezkor tugatsin
    const fin = await emit(tch, 'room:finish');
    check('mentor muddatidan oldin yakunladi', fin.ok, fin.error);
    await Promise.all(racers);
    for (let w = 0; w < 20 && !tstate?.results; w++) await sleep(250);
    const cr = tstate?.results;
    check('natija: 20 ishtirokchi', cr?.players?.length === 20, `${cr?.players?.length} ${cr?.error ?? ''}`);
    check('1-o\'rin — eng tez yozgan', cr?.players?.[0]?.userId === S[4].id && cr.players[0].outcome === 'finished', JSON.stringify(cr?.players?.slice(0, 3).map((p: any) => [p.fullName, p.place, p.wpm, p.outcome])));
    check('tugatganlar 1–3, qolganlar "vaqt tugadi"', cr?.players?.filter((p: any) => p.outcome === 'finished').length === 3 && cr.players.filter((p: any) => p.outcome === 'timeout').length === 16);
    check('chiqib ketgan oxirida', cr?.players?.[19]?.userId === S[8].id && cr.players[19].outcome === 'left');
    check('reytingsiz: hech kimda ELO o\'zgarmadi', cr?.rated === false && cr.players.every((p: any) => p.delta === 0));
    const ratingsAfter = await prisma.typingRating.findMany({ where: { userId: { in: CL.map((i) => S[i].id) } } });
    check('bazadagi jang reytingi o\'zgarmagan', JSON.stringify(ratingsBefore.map((r) => [r.userId, r.rating, r.matches]).sort()) === JSON.stringify(ratingsAfter.map((r) => [r.userId, r.rating, r.matches]).sort()));
    const dbc = await prisma.typingMatch.findFirst({ where: { code: cls.room.code }, include: { players: true } });
    check('bazada: mode=class, nomi, mentor host, 20 o\'yinchi', dbc?.mode === 'class' && dbc.title === '3-guruh bellashuvi' && dbc.hostId === teacher.id && dbc.players.length === 20);
    const resCnt = await prisma.typingResult.count({ where: { matchId: dbc?.id, mode: 'class' } });
    check('natijalar tarixga yozildi', resCnt >= 19, `${resCnt}`);

    // REST: tarix, tafsilot, Excel, egalik
    const cl = await api(teacher.token, 'GET', '/class/matches');
    const row = cl.json?.data?.items?.[0];
    check('mentor tarixi', row?.id === dbc?.id && row.participants === 20 && row.finishedCount === 3 && row.top[0].fullName === S[4].name, JSON.stringify(row?.top));
    const det = await api(teacher.token, 'GET', `/class/matches/${dbc?.id}`);
    check('tafsilot: guruh, xatolar, vaqt', det.json?.data?.players?.length === 20 && Array.isArray(det.json.data.players[0].groups) && det.json.data.players[0].timeSec > 0);
    const xr = await fetch(`${BASE}/api/typing/class/matches/${dbc?.id}/excel`, { headers: { Authorization: `Bearer ${teacher.token}` } });
    const xb = Buffer.from(await xr.arrayBuffer());
    check('Excel yuklanadi (xlsx)', xr.status === 200 && (xr.headers.get('content-type') ?? '').includes('spreadsheetml') && xb.subarray(0, 2).toString() === 'PK' && xb.length > 5000, `${xr.status} ${xb.length} B`);
    const other = await api(teacher2.token, 'GET', `/class/matches/${dbc?.id}`);
    check('boshqa mentor ko\'ra olmaydi', other.status === 404);
    const otherList = await api(teacher2.token, 'GET', '/class/matches');
    check('boshqa mentor ro\'yxati bo\'sh', otherList.json?.data?.total === 0);
    const adm = await api(admin.token, 'GET', `/class/matches/${dbc?.id}`);
    check('admin ko\'ra oladi', adm.status === 200);
    const stuDeny = await api(S[4].token, 'GET', '/class/matches');
    check('o\'quvchi mentor marshrutiga kira olmaydi', stuDeny.status === 403);
    const am2 = await api(admin.token, 'GET', '/admin/matches?mode=class');
    check('admin o\'yinlar ro\'yxatida sinf musobaqasi', am2.json?.data?.items?.some((m: any) => m.id === dbc?.id && m.title === '3-guruh bellashuvi'));

    // Mentor qayta ulansa — natija ekraniga qaytadi; yopgach yangisini ochadi
    tch.close();
    await sleep(200);
    // Tinglovchi ulanishdan OLDIN — server holatni darhol (CONNECT bilan birga) yuboradi
    const { tch2, back2 } = await new Promise<any>((r) => {
      const s = ioc(`${BASE}/typing`, { auth: { token: teacher.token }, transports: ['websocket'], reconnection: false });
      sockets.push(s);
      s.once('room:state', (st: any) => r({ tch2: s, back2: st }));
      setTimeout(() => r({ tch2: s, back2: null }), 2000);
    });
    check('mentor qayta ulandi → musobaqa natijasi qaytdi', back2?.code === cls.room.code && !!back2.results);
    const cl2 = await emit(tch2, 'room:create', { mode: 'class', contentType: 'code', variant: 'Python', size: 'long' });
    check('yangi musobaqa (uzun kod, vaqt chegarasi > 240 s)', cl2.ok && cl2.room.textLength >= 300 && cl2.room.timeLimitSec > 240, `${cl2.room?.textLength} belgi, ${cl2.room?.timeLimitSec} s`);
    await emit(c[24], 'room:join', { code: cl2.room.code });
    const closed = new Promise<any>((r) => { c[24].once('room:closed', r); setTimeout(() => r(null), 2000); });
    const cz = await emit(tch2, 'room:close');
    check('mentor lobby\'ni yopsa o\'quvchilarga xabar boradi', cz.ok && (await closed)?.reason?.includes('yopdi'));
  } finally {
    for (const s of sockets) s?.close?.();
    const ids = users.map((u) => u.id);
    await prisma.typingResult.deleteMany({ where: { userId: { in: ids } } });
    await prisma.typingMatch.deleteMany({ where: { players: { some: { userId: { in: ids } } } } });
    await prisma.typingMatch.deleteMany({ where: { hostId: { in: ids } } });
    await prisma.typingRating.deleteMany({ where: { userId: { in: ids } } });
    await prisma.groupStudent.deleteMany({ where: { groupId: group.id } });
    await prisma.group.delete({ where: { id: group.id } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`\nTozalash: qolgan fixture = ${await prisma.user.count({ where: { login: { startsWith: tag } } })}`);
    io.close();
    server.close();
    await prisma.$disconnect();
  }
  console.log(`\nNatija: ${pass} OK, ${failed} XATO`);
  process.exitCode = failed ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
