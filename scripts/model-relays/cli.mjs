import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { FAMILIES, listRouteProviders, selectFamilyProvider } from './providers.mjs';

const zh = !String(process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '').toLowerCase().startsWith('en');
const [family, providerId, ...extra] = process.argv.slice(2);

function safeLabel(value) { return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, ''); }

try {
  if (!FAMILIES.includes(family) || extra.length) {
    console.log('cc-switch route <deepseek|grok> [provider-id|--list]');
    console.log(zh ? '供应商在 cc-switch -a open-code 中添加和编辑。' : 'Add and edit suppliers with cc-switch -a open-code.');
    process.exitCode = family && !['--help', '-h'].includes(family) ? 2 : 0;
  } else {
    const rows = listRouteProviders(family);
    console.log(`${family === 'grok' ? 'Grok' : 'DeepSeek'} ${zh ? '供应商' : 'suppliers'}`);
    for (const [index, row] of rows.entries())
      console.log(`${row.selected ? '*' : ' '} ${index + 1}. ${safeLabel(row.name)} [${safeLabel(row.id)}]`);
    let selected = providerId;
    if (!selected && stdin.isTTY) {
      const prompt = createInterface({ input: stdin, output: stdout });
      try {
        const value = (await prompt.question(zh ? '选择编号，回车取消：' : 'Choose a number, or Enter to cancel: ')).trim();
        if (value) {
          selected = rows[Number(value) - 1]?.id;
          if (!selected) throw new Error(zh ? '编号无效' : 'Invalid selection');
        }
      } finally { prompt.close(); }
    }
    if (selected && selected !== '--list') {
      const result = await selectFamilyProvider(family, selected);
      console.log(`${zh ? '已切换' : 'Selected'}: ${safeLabel(result.name)} (${result.models.length} ${zh ? '个模型' : 'models'})`);
      console.log(zh ? '新请求立即生效。' : 'New requests use this supplier immediately.');
    }
  }
} catch (error) {
  console.error(safeLabel(error.message));
  process.exitCode = 1;
}
