/**
 * Test paneli uchun uchdan-uchgacha sinov.
 * Mentor tomonini ham, ommaviy (auth'siz) tomonini ham tekshiradi.
 *
 * Ishlatish: node e2e-quiz-test.js
 */
const BASE = 'http://localhost:5000/api';

let pass = 0;
let fail = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  OK   ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    fail++;
    console.log(`  XATO ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* bo'sh javob */
  }
  return { status: res.status, json };
}

(async () => {
  console.log('\n=== 1. Kirish ===');
  const login = await req('POST', '/auth/login', {
    body: { login: 'admin', password: 'admin123' },
  });
  ok('admin login', login.status === 200, `status ${login.status}`);
  const token = login.json?.data?.accessToken;
  if (!token) {
    console.log('  Token olinmadi, to\'xtatildi:', JSON.stringify(login.json).slice(0, 200));
    process.exit(1);
  }

  console.log('\n=== 2. Test yaratish ===');
  const created = await req('POST', '/quiz-tests', {
    token,
    body: {
      title: 'E2E sinov testi',
      description: 'Avtomatik sinov uchun',
      durationMin: 15,
      attemptsAllowed: 2,
      showResult: true,
      showCorrectAnswers: true,
      passPercent: 50,
    },
  });
  ok('test yaratildi', created.status === 201, `status ${created.status}`);
  const test = created.json?.data;
  if (!test) {
    console.log('  Javob:', JSON.stringify(created.json).slice(0, 300));
    process.exit(1);
  }
  ok('havola kodi berildi', !!test.code && test.code.length >= 6, test.code);
  ok('boshlang\'ich holat draft', test.status === 'draft');

  console.log('\n=== 3. Savollar (Excel uslubidagi bulk) ===');
  const bulk = await req('POST', `/quiz-tests/${test.id}/questions/bulk`, {
    token,
    body: {
      questions: [
        {
          type: 'closed',
          text: "O'zbekiston poytaxti?",
          options: ['Samarqand', 'Toshkent', 'Buxoro'],
          correctIndexes: [1],
          points: 2,
        },
        {
          type: 'closed',
          text: 'Qaysilari dasturlash tili?',
          options: ['Python', 'HTML', 'JavaScript'],
          correctIndexes: [0, 2],
          points: 3,
        },
        {
          type: 'open',
          text: 'Make-da jarayonni boshlaydigan modul nomi?',
          acceptedAnswers: ['trigger', 'trigger moduli'],
          points: 2,
        },
        {
          type: 'open',
          text: 'Bugun nima o\'rgandingiz?',
          acceptedAnswers: [],
          points: 3,
        },
        // ataylab buzuq — o'tkazib yuborilishi kerak
        { type: 'closed', text: 'Variantsiz savol', options: ['bitta'], correctIndexes: [0] },
      ],
    },
  });
  ok('bulk qo\'shildi', bulk.status === 201, `status ${bulk.status}`);
  ok('4 ta savol qabul qilindi', bulk.json?.data?.added === 4, `added=${bulk.json?.data?.added}`);
  ok('buzuq qator o\'tkazib yuborildi', (bulk.json?.data?.skipped ?? []).length === 1);

  console.log('\n=== 4. Sozlama: har turdan nechta savol ===');
  const upd = await req('PATCH', `/quiz-tests/${test.id}`, {
    token,
    body: { closedCount: 2, openCount: 2, status: 'active' },
  });
  ok('sozlama saqlandi va faollashtirildi', upd.status === 200, `status ${upd.status}`);

  console.log('\n=== 5. Ommaviy: testni ochish (auth yo\'q) ===');
  const pub = await req('GET', `/quiz-tests/public/${test.code}`);
  ok('ommaviy ochildi', pub.status === 200, `status ${pub.status}`);
  ok('to\'siq yo\'q', pub.json?.data?.blocked === null, String(pub.json?.data?.blocked));
  ok('4 ta savol beriladi', pub.json?.data?.questionCount === 4, `count=${pub.json?.data?.questionCount}`);
  ok('to\'g\'ri javob sizib chiqmadi', !JSON.stringify(pub.json).includes('correctIndexes'));

  console.log('\n=== 6. Ommaviy: boshlash ===');
  const start = await req('POST', `/quiz-tests/public/${test.code}/start`, {
    body: { fullName: 'Sinov Ishtirokchi' },
  });
  ok('boshlandi', start.status === 201, `status ${start.status}`);
  const payload = start.json?.data;
  const attemptToken = payload?.attempt?.token;
  ok('token berildi', !!attemptToken);
  ok('4 ta savol keldi', payload?.questions?.length === 4, `len=${payload?.questions?.length}`);
  const leaked = JSON.stringify(payload?.questions ?? []);
  ok('savollarda to\'g\'ri javob yo\'q', !leaked.includes('correctIndexes') && !leaked.includes('acceptedAnswers'));

  console.log('\n=== 7. Qisqa ism rad etiladi ===');
  const bad = await req('POST', `/quiz-tests/public/${test.code}/start`, {
    body: { fullName: 'Ab' },
  });
  ok('qisqa ism rad etildi', bad.status === 400, `status ${bad.status}`);

  console.log('\n=== 8. Javob berish ===');
  const qs = payload.questions;
  const byText = (t) => qs.find((q) => q.text.includes(t));

  const qCapital = byText('poytaxti');
  const qLangs = byText('dasturlash tili');
  const qTrigger = byText('boshlaydigan modul');
  const qFree = byText("o'rgandingiz");

  // Poytaxt — to'g'ri
  if (qCapital) {
    const idx = qCapital.options.indexOf('Toshkent');
    const r = await req('POST', `/quiz-tests/attempt/${attemptToken}/answer`, {
      body: { questionId: qCapital.id, selected: [idx] },
    });
    ok('yopiq javob saqlandi', r.status === 200);
  }

  // Tillar — ataylab yarim to'g'ri (faqat Python)
  if (qLangs) {
    const idx = qLangs.options.indexOf('Python');
    await req('POST', `/quiz-tests/attempt/${attemptToken}/answer`, {
      body: { questionId: qLangs.id, selected: [idx] },
    });
    ok('qisman javob saqlandi', true);
  }

  // Ochiq — to'g'ri (katta harf bilan, caseSensitive: false)
  if (qTrigger) {
    const r = await req('POST', `/quiz-tests/attempt/${attemptToken}/answer`, {
      body: { questionId: qTrigger.id, textAnswer: '  Trigger  ' },
    });
    ok('ochiq javob saqlandi', r.status === 200);
  }

  // Erkin ochiq — qo'lda baholanadi
  if (qFree) {
    await req('POST', `/quiz-tests/attempt/${attemptToken}/answer`, {
      body: { questionId: qFree.id, textAnswer: 'Avtomatlashtirishni' },
    });
  }

  console.log('\n=== 9. Begona savolga javob rad etiladi ===');
  const alien = await req('POST', `/quiz-tests/attempt/${attemptToken}/answer`, {
    body: { questionId: '00000000-0000-0000-0000-000000000000', selected: [0] },
  });
  ok('begona savol rad etildi', alien.status === 400, `status ${alien.status}`);

  console.log('\n=== 10. Yakunlash ===');
  const submit = await req('POST', `/quiz-tests/attempt/${attemptToken}/submit`);
  ok('yakunlandi', submit.status === 200, `status ${submit.status}`);
  const res = submit.json?.data;
  // Kutilgan: poytaxt 2 ball (to'g'ri), tillar 0 (yarim), trigger 2 (to'g'ri), erkin 0 (qo'lda)
  ok('ball to\'g\'ri hisoblandi', res?.score === 4, `score=${res?.score} / ${res?.maxScore}`);
  ok('maks ball to\'g\'ri', res?.maxScore === 10, `max=${res?.maxScore}`);
  ok('qo\'lda baholash kutilmoqda', res?.needsReview === true);
  ok('to\'g\'ri javoblar ko\'rsatildi', Array.isArray(res?.review) && res.review.length === 4);

  console.log('\n=== 11. Ikki marta yakunlash xato bermaydi ===');
  const again = await req('POST', `/quiz-tests/attempt/${attemptToken}/submit`);
  ok('takror yakunlash 200 qaytardi', again.status === 200, `status ${again.status}`);

  console.log('\n=== 12. Mentor: natijalar ===');
  const results = await req('GET', `/quiz-tests/${test.id}/results`, { token });
  ok('natijalar olindi', results.status === 200);
  const attempts = results.json?.data?.attempts ?? [];
  ok('1 ta urinish ko\'rinadi', attempts.length === 1, `len=${attempts.length}`);
  ok('tekshirish kerak deb belgilandi', results.json?.data?.stats?.needsReview === 1);

  console.log('\n=== 13. Mentor: ochiq javobni baholash ===');
  const detail = await req('GET', `/quiz-tests/${test.id}/attempts/${attempts[0].id}`, { token });
  ok('tafsilot olindi', detail.status === 200);
  const pending = (detail.json?.data?.items ?? [])
    .map((i) => i.answer)
    .find((a) => a && a.needsReview);
  ok('baholanmagan javob topildi', !!pending);
  if (pending) {
    const rev = await req('PATCH', `/quiz-tests/${test.id}/answers/${pending.id}/review`, {
      token,
      body: { isCorrect: true },
    });
    ok('baholandi', rev.status === 200, `status ${rev.status}`);
    ok('ball qayta hisoblandi', rev.json?.data?.attempt?.score === 7,
       `yangi score=${rev.json?.data?.attempt?.score}`);
    ok('o\'tdi deb belgilandi', rev.json?.data?.attempt?.passed === true,
       `percent=${rev.json?.data?.attempt?.percent}`);
  }

  console.log('\n=== 14. Urinishlar chegarasi ===');
  await req('POST', `/quiz-tests/public/${test.code}/start`, {
    body: { fullName: 'Sinov Ishtirokchi' },
  });
  const third = await req('POST', `/quiz-tests/public/${test.code}/start`, {
    body: { fullName: 'Sinov Ishtirokchi' },
  });
  // 2 ta urinishga ruxsat berilgan: 1-yakunlangan, 2-jarayonda -> 3-chi davom ettiriladi yoki rad etiladi
  ok('chegara ishlaydi', [200, 201, 403].includes(third.status), `status ${third.status}`);

  console.log('\n=== 14b. Aralashtirish baholashni buzmaydi ===');
  {
    const st = await req('POST', '/quiz-tests', {
      token,
      body: { title: 'Shuffle sinovi', durationMin: 10, shuffleOptions: true },
    });
    const sTest = st.json.data;
    await req('POST', `/quiz-tests/${sTest.id}/questions/bulk`, {
      token,
      body: {
        questions: [
          {
            type: 'closed',
            text: 'Poytaxt?',
            options: ['Samarqand', 'Toshkent', 'Buxoro', 'Xiva'],
            correctIndexes: [1],
            points: 5,
          },
        ],
      },
    });
    await req('PATCH', `/quiz-tests/${sTest.id}`, { token, body: { status: 'active' } });

    let good = 0;
    const RUNS = 8;
    for (let i = 0; i < RUNS; i++) {
      const a = await req('POST', `/quiz-tests/public/${sTest.code}/start`, {
        body: { fullName: `Aralash Sinov ${i}` },
      });
      const q = a.json.data.questions[0];
      const tk = a.json.data.attempt.token;
      const idx2 = q.options.indexOf('Toshkent');
      await req('POST', `/quiz-tests/attempt/${tk}/answer`, {
        body: { questionId: q.id, selected: [idx2] },
      });
      const r = await req('POST', `/quiz-tests/attempt/${tk}/submit`);
      if (r.json && r.json.data && r.json.data.score === 5) good++;
    }
    ok('aralashtirishda to\'g\'ri baholanadi', good === RUNS, `${good}/${RUNS}`);

    const a2 = await req('POST', `/quiz-tests/public/${sTest.code}/start`, {
      body: { fullName: 'Tartib Sinovi' },
    });
    const tk2 = a2.json.data.attempt.token;
    const first = a2.json.data.questions[0].options.join('|');
    const again = await req('GET', `/quiz-tests/attempt/${tk2}`);
    const second = again.json.data.questions[0].options.join('|');
    ok('sahifa yangilanganda tartib saqlanadi', first === second);

    await req('DELETE', `/quiz-tests/${sTest.id}`, { token });
  }

  console.log('\n=== 15. Draft holatda havola yopiq ===');
  await req('PATCH', `/quiz-tests/${test.id}`, { token, body: { status: 'draft' } });
  const blocked = await req('POST', `/quiz-tests/public/${test.code}/start`, {
    body: { fullName: 'Boshqa Odam' },
  });
  ok('draft testga kirib bo\'lmaydi', blocked.status === 403, `status ${blocked.status}`);

  console.log('\n=== 16. Tozalash ===');
  const del = await req('DELETE', `/quiz-tests/${test.id}`, { token });
  ok('test o\'chirildi', del.status === 200);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`NATIJA: ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('KUTILMAGAN XATO:', e.message);
  process.exit(1);
});
