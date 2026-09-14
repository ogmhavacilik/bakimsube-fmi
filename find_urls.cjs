const fs = require('fs');
const text = fs.readFileSync('index.html', 'utf8');
const lines = text.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('http://') || l.includes('https://') || l.includes('excel') || l.includes('sheet')) {
    if (!l.includes('cdn') && !l.includes('unpkg') && !l.includes('tailwindcss') && !l.includes('fonts.')) {
      console.log(idx + 1, l.trim().substring(0, 140));
    }
  }
});
