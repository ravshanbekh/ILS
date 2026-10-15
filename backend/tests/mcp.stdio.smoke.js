/**
 * Lokal stdio MCP smoke: dist/mcp/main.js ni haqiqiy jarayon sifatida
 * ishga tushirib, amallar ro'yxati va bitta jonli o'qish so'rovini tekshiradi.
 * stdout'ga begona log tushsa protokol buziladi — bu test shuni ham ushlaydi.
 * Ishlatish: npm run build && npm run smoke:mcp
 */
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  const client = new Client({ name: 'itlive-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(__dirname, '../dist/mcp/main.js')],
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    if (!names.includes('ils_overview')) throw new Error(`ils_overview topilmadi: ${names.join(', ')}`);
    if (names.some((n) => n.startsWith('ils_create'))) throw new Error('stdio rejimida yozish amallari bo\'lmasligi kerak');

    const result = await client.callTool({ name: 'ils_overview', arguments: {} });
    if (result.isError) throw new Error(result.content[0]?.text || 'So\'rov bajarilmadi');
    const data = JSON.parse(result.content[0].text);
    if (typeof data.groups?.active !== 'number') throw new Error('Natija shakli noto\'g\'ri');
    console.log(`OK: ${names.length} ta amal, jonli so'rov ishladi (faol guruhlar: ${data.groups.active}).`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('XATO:', error.message);
  process.exitCode = 1;
});
