import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { GifWriter } from 'omggif';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../generated');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const USERNAME = 'Rohitlahare379';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const headers = {
  'User-Agent': 'NodeJS-ASCII-GIF-Generator',
  Accept: 'application/vnd.github.v3+json',
};

if (GITHUB_TOKEN) {
  headers['Authorization'] = `token ${GITHUB_TOKEN}`;
}

async function fetchProfileData() {
  let user = {
    login: USERNAME,
    created_at: '2024-08-05T00:00:00Z',
    location: 'Bengaluru, Karnataka, India',
    public_repos: 22,
    followers: 1,
  };
  let repos = [];
  let events = [];

  try {
    const userRes = await fetch(`https://api.github.com/users/${USERNAME}`, { headers });
    if (userRes.ok) user = await userRes.json();
  } catch (e) {
    console.warn('Could not fetch user profile:', e.message);
  }

  try {
    const reposRes = await fetch(
      `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`,
      { headers }
    );
    if (reposRes.ok) repos = await reposRes.json();
  } catch (e) {
    console.warn('Could not fetch user repos:', e.message);
  }

  try {
    const eventsRes = await fetch(`https://api.github.com/users/${USERNAME}/events?per_page=100`, {
      headers,
    });
    if (eventsRes.ok) events = await eventsRes.json();
  } catch (e) {
    console.warn('Could not fetch user events:', e.message);
  }

  // Calculate Uptime dynamically from account creation date
  const createdDate = new Date(user.created_at || '2024-08-05T00:00:00Z');
  const now = new Date();
  const diffTime = Math.abs(now - createdDate);
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const remainingDays = totalDays % 365;

  const uptimeStr = years > 0 
    ? `${years} year${years > 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`
    : `${totalDays} day${totalDays !== 1 ? 's' : ''}`;

  // Location dynamically
  const locationStr = user.location || 'Bengaluru, Karnataka, India';

  // Stars count sum dynamically across repos
  const starsCount = repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);

  // Commits count dynamically (or fallback seed)
  let commitsCount = 35;
  if (Array.isArray(events)) {
    const pushEvents = events.filter((e) => e.type === 'PushEvent');
    const commitSum = pushEvents.reduce((acc, e) => acc + (e.payload?.commits?.length || 1), 0);
    if (commitSum > 0) commitsCount = Math.max(35, commitSum);
  }

  // Exact languages sorted by byte count dynamically
  const langByteMap = {};
  for (const repo of repos) {
    if (repo.fork) continue;
    if (repo.languages_url) {
      try {
        const lRes = await fetch(repo.languages_url, { headers });
        if (lRes.ok) {
          const bytesObj = await lRes.json();
          for (const [lang, bytes] of Object.entries(bytesObj)) {
            const normalizedLang = lang === 'PLpgSQL' ? 'PL/pgSQL' : lang;
            langByteMap[normalizedLang] = (langByteMap[normalizedLang] || 0) + bytes;
          }
        }
      } catch (e) {
        // silent fallback
      }
    }
  }

  const sortedLangs = Object.entries(langByteMap)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  const top5Langs = sortedLangs.length > 0
    ? sortedLangs.slice(0, 5).join(', ')
    : 'Python, JavaScript, TypeScript, Java, C';

  return {
    username: user.login,
    uptimeStr,
    locationStr,
    top5Langs,
    reposCount: user.public_repos || 22,
    starsCount,
    commitsCount,
    followersCount: user.followers || 1,
  };
}

async function generateAnimatedAsciiGif() {
  console.log('Fetching live profile stats for ASCII GIF generation...');
  const stats = await fetchProfileData();

  const svgTemplatePath = path.join(__dirname, '../dark_mode.svg');
  let svgTemplate = fs.readFileSync(svgTemplatePath, 'utf8');

  // Dynamically update right panel text elements in template
  const rawLines = svgTemplate.split('\n').map((l) => l.trim()).filter(Boolean);
  const header = rawLines[0] + '\n' + rawLines[1];
  const footer = rawLines[rawLines.length - 1]; // </svg>
  let textLines = rawLines.slice(2, rawLines.length - 1);

  // Update dynamic values in text lines
  textLines = textLines.map((line) => {
    if (line.includes('. Uptime:')) {
      return `<text x="540" y="193" font-family="'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace" xml:space="preserve" font-size="16"><tspan fill="#ffa657">. Uptime: </tspan><tspan fill="#484f58">...............................</tspan><tspan fill="#c9d1d9"> ${stats.uptimeStr}</tspan></text>`;
    }
    if (line.includes('. Location:')) {
      return `<text x="540" y="213" font-family="'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace" xml:space="preserve" font-size="16"><tspan fill="#ffa657">. Location: </tspan><tspan fill="#484f58">.................</tspan><tspan fill="#c9d1d9"> ${stats.locationStr}</tspan></text>`;
    }
    if (line.includes('. Languages:')) {
      return `<text x="540" y="233" font-family="'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace" xml:space="preserve" font-size="16"><tspan fill="#ffa657">. Languages: </tspan><tspan fill="#484f58">....</tspan><tspan fill="#c9d1d9"> ${stats.top5Langs}</tspan></text>`;
    }
    if (line.includes('. Repos:')) {
      return `<text x="540" y="353" font-family="'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace" xml:space="preserve" font-size="16"><tspan fill="#ffa657">. Repos: </tspan><tspan fill="#484f58">..............</tspan><tspan fill="#79c0ff"> ${stats.reposCount}</tspan><tspan fill="#3d444d"> | </tspan><tspan fill="#ffa657">. Stars: </tspan><tspan fill="#484f58">...............</tspan><tspan fill="#79c0ff"> ${stats.starsCount}</tspan></text>`;
    }
    if (line.includes('. Commits:')) {
      return `<text x="540" y="373" font-family="'Consolas', 'Menlo', 'DejaVu Sans Mono', monospace" xml:space="preserve" font-size="16"><tspan fill="#ffa657">. Commits: </tspan><tspan fill="#484f58">............</tspan><tspan fill="#79c0ff"> ${stats.commitsCount}</tspan><tspan fill="#3d444d"> | </tspan><tspan fill="#ffa657">. Followers: </tspan><tspan fill="#484f58">...........</tspan><tspan fill="#79c0ff"> ${stats.followersCount}</tspan></text>`;
    }
    return line;
  });

  const width = 1125;
  const height = 536;
  const frameBufs = [];

  // Generate 22 progressive reveal frames for bootup animation
  const totalFrames = 22;
  for (let f = 1; f <= totalFrames; f++) {
    const showCount = Math.max(1, Math.round((f / totalFrames) * textLines.length));
    const currentLines = [...textLines.slice(0, showCount)];

    // Add glowing green terminal cursor `▋` to current line if still revealing
    if (f < totalFrames && currentLines.length > 0) {
      const lastLineIdx = currentLines.length - 1;
      const lineStr = currentLines[lastLineIdx];
      currentLines[lastLineIdx] = lineStr.replace('</text>', '<tspan fill="#34d399"> ▋</tspan></text>');
    }

    const frameSvg = `${header}\n${currentLines.join('\n')}\n${footer}`;

    const rawRgba = await sharp(Buffer.from(frameSvg))
      .resize(width, height)
      .ensureAlpha()
      .raw()
      .toBuffer();

    frameBufs.push({
      data: rawRgba,
      // 12 = 120ms per frame during reveal (~2.6s total reveal sequence)
      // 600 = 6.0s hold time on full completed card before looping
      delay: f === totalFrames ? 600 : 12,
    });
  }

  // Quantize & Encode GIF using omggif
  const gifBuf = Buffer.alloc(width * height * totalFrames * 4 + 4096);
  const gifWriter = new GifWriter(gifBuf, width, height, { loop: 0 });

  for (const frame of frameBufs) {
    const palette = [];
    const indexedPixels = new Uint8Array(width * height);
    const colorMap = new Map();

    for (let i = 0; i < frame.data.length; i += 4) {
      const r = frame.data[i];
      const g = frame.data[i + 1];
      const b = frame.data[i + 2];

      const qr = r >> 3;
      const qg = g >> 3;
      const qb = b >> 3;
      const key = (qr << 10) | (qg << 5) | qb;

      let idx = colorMap.get(key);
      if (idx === undefined) {
        idx = palette.length;
        if (palette.length < 256) {
          const hexColor = (r << 16) | (g << 8) | b;
          palette.push(hexColor);
          colorMap.set(key, idx);
        } else {
          idx = 0;
        }
      }
      indexedPixels[i / 4] = idx;
    }

    while (palette.length < 256) {
      palette.push(0);
    }

    gifWriter.addFrame(0, 0, width, height, indexedPixels, {
      palette: palette,
      delay: frame.delay,
    });
  }

  const finalGif = gifBuf.subarray(0, gifWriter.end());
  const outputPath = path.join(OUTPUT_DIR, 'animated_ascii.gif');
  fs.writeFileSync(outputPath, finalGif);

  console.log(`Generated dynamic animated GIF: ${outputPath} (${(finalGif.length / 1024).toFixed(1)} KB)`);
  console.log('Dynamic Stats Used:', JSON.stringify(stats, null, 2));
}

generateAnimatedAsciiGif().catch((err) => {
  console.error('Error generating animated ASCII GIF:', err);
  process.exit(1);
});
