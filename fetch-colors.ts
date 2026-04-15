import https from 'https';

https.get('https://www.consuldata.com.br/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const cssLinks = data.match(/href="([^"]+\.css[^"]*)"/g);
    if (cssLinks) {
      console.log('Found CSS links:', cssLinks.slice(0, 5));
      cssLinks.forEach(linkMatch => {
        const url = linkMatch.replace('href="', '').replace('"', '');
        if (url.startsWith('http')) {
          https.get(url, (cssRes) => {
            let cssData = '';
            cssRes.on('data', (chunk) => { cssData += chunk; });
            cssRes.on('end', () => {
              const hexRegex = /#[0-9a-fA-F]{6}\b/g;
              const matches = cssData.match(hexRegex);
              if (matches) {
                const counts: Record<string, number> = {};
                matches.forEach(m => {
                  const lower = m.toLowerCase();
                  counts[lower] = (counts[lower] || 0) + 1;
                });
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                console.log(`Colors in ${url}:`, sorted);
              }
            });
          }).on('error', () => {});
        }
      });
    }
  });
}).on('error', (err) => {
  console.error(err);
});
