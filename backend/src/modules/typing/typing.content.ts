/**
 * "Tez yozish" kontenti — so'zlar va kod snippetlari.
 *
 * Manba: github.com/itxona40-rgb/codetyping (CodeType, js/app.js) — so'z
 * ro'yxatlari va snippetlar o'qiladigan ko'rinishga keltirib ko'chirildi.
 * Matnni SERVER beradi: natija server tomonida shu matn uzunligi va server
 * vaqti bilan hisoblanadi (mijoz o'zi matn tanlab, soxta tezlik yubora olmaydi).
 */
import crypto from 'crypto';

const EN = (
  'the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an ' +
  'will my one all would there their what so up out if about who get which go me when make can like time no just him know ' +
  'take people into year your good some could them see other than then now look only come its over think also back after ' +
  'use two how our work first well way even new want because any these give day most us'
).split(' ');

const UZ = (
  'men sen u biz siz ular kitob uy maktab dasturlash kompyuter klaviatura tez yozish yaxshi katta kichik ish vaqt kun ' +
  'kecha bugun ertaga suv non osh olma bola ona ota dost shahar yol mashina telefon dars oqish kod xato togri sinov natija ' +
  'daraja bilim fikr yangi eski chiroyli sekin kuchli tinch'
).split(' ');

const TECH = (
  "if else for while return const let var function class import print int void true false null => == != && || {} [] () ; : = " +
  "+ - * / < > i++ i<n arr[0] obj.key 'str' \"text\" #include len(a) self.x x=10 a+b a&&b !ok $id @app _tmp"
).split(' ');

export const TEXT_SOURCES = { en: EN, uz: UZ, tech: TECH } as const;
export type TextSource = keyof typeof TEXT_SOURCES;

export const CODE_SNIPPETS: Record<string, string[]> = {
  Python: [
    'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a',
    'class Stack:\n    def __init__(self):\n        self.items = []\n\n    def push(self, x):\n        self.items.append(x)\n\n    def pop(self):\n        return self.items.pop()',
    'for i in range(5):\n    if i % 2 == 0:\n        print(i)',
    'import random\n\nnum = random.randint(1, 10)\nguess = int(input("Son: "))\nif guess == num:\n    print("Topdingiz!")\nelse:\n    print("Xato")',
    'squares = [x ** 2 for x in range(10)]\nevens = list(filter(lambda x: x % 2 == 0, squares))\nprint(evens)',
  ],
  JavaScript: [
    'const sum = (arr) => {\n  return arr.reduce((a, b) => a + b, 0);\n};\nconsole.log(sum([1, 2, 3]));',
    "async function load(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error('xato');\n    return await res.json();\n  } catch (e) {\n    console.error(e.message);\n  }\n}",
    "let s = 'abc';\nconsole.log(s.length);",
    'const user = { name: "Ali", age: 20 };\nconst { name, age } = user;\nconsole.log(name + " " + age);',
    'document.querySelector("#btn").addEventListener("click", () => {\n  alert("Salom!");\n});',
  ],
  'C++': [
    'int gcd(int a, int b) {\n    while (b != 0) {\n        int t = b;\n        b = a % b;\n        a = t;\n    }\n    return a;\n}',
    '#include <iostream>\nusing namespace std;\n\nint main() {\n    for (int i = 0; i < 5; i++) {\n        cout << i << endl;\n    }\n    return 0;\n}',
    '#include <vector>\n#include <algorithm>\n\nint main() {\n    std::vector<int> v = {3, 1, 2};\n    std::sort(v.begin(), v.end());\n    return 0;\n}',
  ],
  Java: [
    'public class Counter {\n    private int count = 0;\n\n    public void inc() {\n        count++;\n    }\n\n    public int get() {\n        return count;\n    }\n}',
    'for (int i = 1; i <= 3; i++) {\n    System.out.println("Salom " + i);\n}',
    'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        List<String> list = new ArrayList<>();\n        list.add("Java");\n        System.out.println(list);\n    }\n}',
  ],
  HTML: [
    '<form action="/login" method="post">\n  <label for="u">Login</label>\n  <input id="u" type="text" required>\n  <button type="submit">Kirish</button>\n</form>',
    '<ul class="menu">\n  <li><a href="/">Bosh sahifa</a></li>\n  <li><a href="/about">Biz haqimizda</a></li>\n</ul>',
    '<button class="btn" onclick="go()">Bosish</button>\n<script>\n  function go() {\n    alert("Salom");\n  }\n</script>',
  ],
  SQL: [
    "SELECT u.name, COUNT(o.id) AS total\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE o.status = 'paid'\nGROUP BY u.name\nORDER BY total DESC;",
    "INSERT INTO users (name, age)\nVALUES ('Ali', 20);",
    'UPDATE users\nSET age = age + 1\nWHERE id = 3;',
    'CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(50) NOT NULL\n);',
  ],
  Go: [
    'package main\n\nimport "fmt"\n\nfunc main() {\n    for i := 0; i < 3; i++ {\n        fmt.Println("Salom", i)\n    }\n}',
    'func sum(nums []int) int {\n    total := 0\n    for _, n := range nums {\n        total += n\n    }\n    return total\n}',
  ],
  Rust: [
    'fn main() {\n    let mut v = Vec::new();\n    for i in 0..5 {\n        v.push(i * 2);\n    }\n    println!("{:?}", v);\n}',
    'struct Point {\n    x: i32,\n    y: i32,\n}\n\nimpl Point {\n    fn sum(&self) -> i32 {\n        self.x + self.y\n    }\n}',
  ],
  TypeScript: [
    'interface User {\n  name: string;\n  age: number;\n}\n\nconst greet = (u: User): string => {\n  return "Salom, " + u.name;\n};',
    'type Id = number | string;\nlet ids: Id[] = [1, "a", 3];\nids.forEach((x) => console.log(x));',
  ],
  PHP: [
    '<?php\n$names = ["Ali", "Vali"];\nforeach ($names as $n) {\n    echo "Salom, " . $n;\n}',
    'function add($a, $b) {\n    return $a + $b;\n}\necho add(2, 3);',
  ],
  'C#': [
    'using System;\n\nclass Program {\n    static void Main() {\n        for (int i = 0; i < 3; i++) {\n            Console.WriteLine(i);\n        }\n    }\n}',
    'public int Max(int[] a) {\n    int m = a[0];\n    foreach (var x in a) {\n        if (x > m) m = x;\n    }\n    return m;\n}',
  ],
  Kotlin: [
    'fun main() {\n    val names = listOf("Ali", "Vali")\n    for (n in names) {\n        println("Salom, " + n)\n    }\n}',
    'fun add(a: Int, b: Int): Int {\n    return a + b\n}',
  ],
  Bash: [
    '#!/bin/bash\nfor f in *.txt; do\n  echo "Fayl: " $f\ndone',
    'if [ -f "data.txt" ]; then\n  cat data.txt | grep "xato"\nfi',
  ],
  CSS: [
    '.card {\n  display: flex;\n  padding: 16px;\n  border-radius: 12px;\n  background: #1f7ae0;\n}',
    '@media (max-width: 600px) {\n  .menu {\n    display: none;\n  }\n}',
  ],
  React: [
    'function Counter() {\n  const [n, setN] = useState(0);\n  return (\n    <button onClick={() => setN(n + 1)}>\n      {n}\n    </button>\n  );\n}',
    'useEffect(() => {\n  document.title = "Salom";\n}, []);',
  ],
};

export const CODE_LANGS = Object.keys(CODE_SNIPPETS);

const rnd = (n: number) => crypto.randomInt(0, n);
const pick = <T>(a: T[]): T => a[rnd(a.length)];

/** Matn rejimi uchun so'zlar ketma-ketligi (CodeType gen() bilan bir xil qoidalar) */
export function generateText(src: TextSource, words: number, opts: { punctuation?: boolean; numbers?: boolean } = {}) {
  const pool = TEXT_SOURCES[src];
  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    let w = pick(pool);
    if (src !== 'tech') {
      if (opts.punctuation && rnd(100) < 20) w = w[0].toUpperCase() + w.slice(1);
      if (opts.numbers && rnd(100) < 12) w = String(10 + rnd(990));
      if (opts.punctuation && rnd(100) < 18) w += pick([',', '.', '?', '!', ';']);
    }
    out.push(w);
  }
  return out.join(' ');
}

/** Kod snippeti; "Tasodifiy" — istalgan tildan */
export function pickCode(lang: string): { lang: string; text: string } {
  const l = lang === 'Tasodifiy' || !CODE_SNIPPETS[lang] ? pick(CODE_LANGS) : lang;
  return { lang: l, text: pick(CODE_SNIPPETS[l]) };
}

/**
 * Bellashuv matni: barcha o'yinchilar AYNI matnni yozadi.
 * Matn — taxminan 35–45 so'z (≈ 30–60 soniyalik poyga), kod — 1–2 snippet.
 */
export function raceText(contentType: 'text' | 'code', variant: string) {
  if (contentType === 'code') {
    const a = pickCode(variant);
    // Qisqa snippet bo'lsa shu tildan BOSHQA snippetlarni qo'shamiz — poyga
    // 140 belgidan qisqa bo'lmasin (ilgari ikkinchisi tasodifan birinchisi
    // bilan bir xil chiqsa qo'shilmay, 37 belgilik "poyga" bo'lib qolardi)
    const pool = CODE_SNIPPETS[a.lang].filter((s) => s !== a.text);
    const parts = [a.text];
    while (parts.join('\n\n').length < 140 && pool.length) {
      parts.push(pool.splice(rnd(pool.length), 1)[0]);
    }
    return { variant: a.lang, text: parts.join('\n\n') };
  }
  const src = (['en', 'uz', 'tech'].includes(variant) ? variant : 'en') as TextSource;
  return { variant: src, text: generateText(src, src === 'tech' ? 30 : 40) };
}
