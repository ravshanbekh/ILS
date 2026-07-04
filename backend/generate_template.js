const XLSX = require('xlsx');
const ws = XLSX.utils.aoa_to_sheet([
  ['Savol', 'A varianti', 'B varianti', 'C varianti', 'D varianti', 'Togri javob (0-3)'],
  ['O\'zbekiston poytaxti qayer?', 'Samarqand', 'Buxoro', 'Toshkent', 'Navoiy', 2],
  ['2+2 nechiga teng?', '3', '4', '5', '6', 1],
  ['Dasturlash tili emas?', 'Python', 'Java', 'HTML', 'C++', 2]
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
XLSX.writeFile(wb, '../frontend/public/exam_template.xlsx');
console.log('Done');
