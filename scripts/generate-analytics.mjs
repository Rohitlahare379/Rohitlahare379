import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../generated');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const USERNAME = 'Rohitlahare379';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const headers = {
  'User-Agent': 'NodeJS-Analytics-Generator',
  Accept: 'application/vnd.github.v3+json',
};

if (GITHUB_TOKEN) {
  headers['Authorization'] = `token ${GITHUB_TOKEN}`;
}

// Language Colors Map
const LANGUAGE_COLORS = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Java: '#b07219',
  CSS: '#563d7c',
  Shell: '#89e051',
  PowerShell: '#012456',
  HTML: '#e34c26',
  C: '#555555',
  'C++': '#f34b7d',
  'PL/pgSQL': '#336791',
  Dockerfile: '#384d54',
  SQL: '#003B57',
};

async function fetchGitHubData() {
  let user = { login: USERNAME, public_repos: 22 };
  let repos = [];
  let events = [];
  let contributionDays = [];

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

  // Fetch Contribution HTML Graph
  try {
    const contribRes = await fetch(`https://github.com/users/${USERNAME}/contributions`);
    if (contribRes.ok) {
      const html = await contribRes.text();
      const rectRegex = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"[^>]*>(?:<tool-tip[^>]*>(\d+|No) contribution)?/g;
      let match;
      while ((match = rectRegex.exec(html)) !== null) {
        const dateStr = match[1];
        const level = parseInt(match[2], 10);
        let count = 0;
        if (match[3] && match[3] !== 'No') {
          count = parseInt(match[3], 10);
        } else if (level > 0) {
          count = level * 2;
        }
        contributionDays.push({ date: dateStr, count, level });
      }
    }
  } catch (e) {
    console.warn('Could not fetch contribution graph HTML:', e.message);
  }

  // Fetch EXACT language byte breakdown across all non-fork repositories
  const langByteMap = {};
  const repoCountMap = {};

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
            repoCountMap[normalizedLang] = (repoCountMap[normalizedLang] || 0) + 1;
          }
        }
      } catch (e) {
        console.warn(`Failed fetching languages for ${repo.name}:`, e.message);
      }
    }
  }

  const totalBytes = Object.values(langByteMap).reduce((a, b) => a + b, 0);
  const languages = Object.entries(langByteMap)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes > 0 ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0,
      repoCount: repoCountMap[name] || 1,
      color: LANGUAGE_COLORS[name] || '#10b981',
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return { user, repos, events, languages, contributionDays };
}

// Geometry helpers
function createRadarPoints(center, radius, values, maxVal = 100) {
  const count = values.length;
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / count);
    const valRatio = Math.min(1, Math.max(0.12, values[i] / maxVal));
    const r = radius * valRatio;
    const x = center.x + r * Math.cos(angle);
    const y = center.y + r * Math.sin(angle);
    points.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  }
  return points;
}

function createGridPolygons(center, radius, count, levels = 4) {
  const result = [];
  for (let l = 1; l <= levels; l++) {
    const levelRadius = (radius / levels) * l;
    const points = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + i * ((2 * Math.PI) / count);
      const x = center.x + levelRadius * Math.cos(angle);
      const y = center.y + levelRadius * Math.sin(angle);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    result.push(points.join(' '));
  }
  return result;
}

function createAxisLines(center, radius, count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / count);
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    lines.push({ x1: center.x, y1: center.y, x2: Number(x.toFixed(1)), y2: Number(y.toFixed(1)) });
  }
  return lines;
}

function createLabelCoords(center, radius, count) {
  const coords = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / count);
    const labelDistance = radius + 18;
    const x = center.x + labelDistance * Math.cos(angle);
    const y = center.y + labelDistance * Math.sin(angle) + 4;
    let anchor = 'middle';
    if (Math.cos(angle) > 0.3) anchor = 'start';
    if (Math.cos(angle) < -0.3) anchor = 'end';
    coords.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), anchor });
  }
  return coords;
}

function generateToolboxRadarSVG(languages, username) {
  const skillSubjects = [
    { name: 'Python', val: 95 },
    { name: 'TypeScript', val: 92 },
    { name: 'JavaScript', val: 88 },
    { name: 'React', val: 85 },
    { name: 'Node/API', val: 82 },
    { name: 'Java', val: 78 },
    { name: 'DSA', val: 90 },
  ];

  const displayLangs =
    languages.length > 0
      ? languages.slice(0, 6)
      : [
          { name: 'Python', percentage: 48.0, repoCount: 6, bytes: 1275644, color: '#3572A5' },
          { name: 'TypeScript', percentage: 38.5, repoCount: 6, bytes: 1021931, color: '#3178c6' },
          { name: 'JavaScript', percentage: 6.0, repoCount: 12, bytes: 159774, color: '#f1e05a' },
          { name: 'Java', percentage: 2.3, repoCount: 2, bytes: 61672, color: '#b07219' },
          { name: 'CSS', percentage: 1.8, repoCount: 11, bytes: 48744, color: '#563d7c' },
          { name: 'Shell', percentage: 1.2, repoCount: 4, bytes: 32338, color: '#89e051' },
        ];

  const maxPct = Math.max(...displayLangs.map((l) => l.percentage), 1);
  const langRadarSubjects = displayLangs.map((l) => {
    const ratioScore = Math.min(100, Math.max(18, Math.round((l.percentage / maxPct) * 82 + 18)));
    return { name: l.name, val: ratioScore };
  });

  while (langRadarSubjects.length < 6) {
    const fallbackNames = ['HTML', 'SQL', 'C'];
    const name = fallbackNames[langRadarSubjects.length % fallbackNames.length];
    langRadarSubjects.push({ name, val: 20 });
  }

  const c1 = { x: 235, y: 240 };
  const c2 = { x: 675, y: 240 };
  const r = 85;

  const skillGrid = createGridPolygons(c1, r, skillSubjects.length);
  const langGrid = createGridPolygons(c2, r, langRadarSubjects.length);

  const skillAxes = createAxisLines(c1, r, skillSubjects.length);
  const langAxes = createAxisLines(c2, r, langRadarSubjects.length);

  const skillLabels = createLabelCoords(c1, r, skillSubjects.length);
  const langLabels = createLabelCoords(c2, r, langRadarSubjects.length);

  const skillPoints = createRadarPoints(c1, r, skillSubjects.map((s) => s.val));
  const langPoints = createRadarPoints(c2, r, langRadarSubjects.map((s) => s.val));

  const skillPolyStr = skillPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const langPolyStr = langPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const techBadges = [
    { label: 'Python', bg: '#1e1b4b', color: '#818cf8' },
    { label: 'TS', bg: '#1e3a8a', color: '#3178c6' },
    { label: 'JS', bg: '#422006', color: '#f1e05a' },
    { label: 'React', bg: '#083344', color: '#61dafb' },
    { label: 'Node', bg: '#064e3b', color: '#10b981' },
    { label: 'Java', bg: '#361805', color: '#f97316' },
    { label: 'C++', bg: '#1e293b', color: '#f34b7d' },
    { label: 'HTML', bg: '#431407', color: '#fb923c' },
    { label: 'CSS', bg: '#3b0764', color: '#c084fc' },
    { label: 'Git', bg: '#450a0a', color: '#f87171' },
    { label: 'SQL', bg: '#0c4a6e', color: '#38bdf8' },
  ];

  let badgeX = 30;
  const badgeSvg = techBadges
    .map((b) => {
      const width = b.label.length * 9 + 32;
      const res = `
      <g transform="translate(${badgeX}, 52)">
        <rect x="0" y="0" width="${width}" height="28" rx="8" fill="${b.bg}" stroke="rgba(16,185,129,0.25)" stroke-width="1"/>
        <text x="${width / 2}" y="18" fill="${b.color}" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${b.label}</text>
      </g>`;
      badgeX += width + 10;
      return res;
    })
    .join('');

  const langCardsSvg = displayLangs
    .map((l, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 30 + col * 296;
      const y = 390 + row * 65;
      const barW = Math.max(8, Math.round((l.percentage / 100) * 256));

      return `
      <g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="280" height="54" rx="8" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
        <circle cx="16" cy="18" r="4" fill="${l.color || '#10b981'}"/>
        <text x="28" y="22" fill="#e2e8f0" font-family="monospace" font-size="12" font-weight="bold">${l.name}</text>
        <text x="264" y="22" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold" text-anchor="end">${l.percentage}%</text>
        <rect x="12" y="32" width="256" height="4" rx="2" fill="#1e293b"/>
        <rect x="12" y="32" width="${barW}" height="4" rx="2" fill="${l.color || '#10b981'}"/>
      </g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="540" viewBox="0 0 920 540" role="img" aria-label="Toolbox Skill and Language Radar Analytics">
  <defs>
    <linearGradient id="skillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#059669" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="langGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#16a34a" stop-opacity="0.15"/>
    </linearGradient>
  </defs>

  <rect width="920" height="540" rx="14" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>

  <circle cx="30" cy="24" r="5" fill="#f87171"/>
  <circle cx="46" cy="24" r="5" fill="#fbbf24"/>
  <circle cx="62" cy="24" r="5" fill="#34d399"/>
  <text x="80" y="28" fill="#94a3b8" font-family="monospace" font-size="13" font-weight="bold">&gt;_ ~/</text>
  <text x="120" y="28" fill="#10b981" font-family="monospace" font-size="13" font-weight="bold">toolbox</text>
  <text x="890" y="28" fill="#64748b" font-family="monospace" font-size="11" font-weight="bold" text-anchor="end">SKILL &amp; LANGUAGE RADAR ANALYTICS</text>
  <line x1="20" y1="40" x2="900" y2="40" stroke="#21262d" stroke-width="1"/>

  ${badgeSvg}

  <rect x="30" y="95" width="410" height="260" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="48" y="118" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">&lt;/&gt; SKILL RADAR</text>
  <text x="422" y="118" fill="#64748b" font-family="monospace" font-size="10" text-anchor="end">Core Proficiencies</text>
  
  ${skillGrid.map((p) => `<polygon points="${p}" fill="none" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  ${skillAxes.map((a) => `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  <polygon points="${skillPolyStr}" fill="url(#skillGrad)" stroke="#10b981" stroke-width="2"/>
  ${skillPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#34d399" stroke="#090d16" stroke-width="1.5"/>`).join('')}
  ${skillSubjects.map((s, i) => `<text x="${skillLabels[i].x}" y="${skillLabels[i].y}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="${skillLabels[i].anchor}">${s.name}</text>`).join('')}

  <rect x="470" y="95" width="420" height="260" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="488" y="118" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">${username} - LANGUAGE MIX</text>
  <text x="872" y="118" fill="#64748b" font-family="monospace" font-size="10" text-anchor="end">Repository Code Ratio</text>
  
  ${langGrid.map((p) => `<polygon points="${p}" fill="none" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  ${langAxes.map((a) => `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  <polygon points="${langPolyStr}" fill="url(#langGrad)" stroke="#22c55e" stroke-width="2"/>
  ${langPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#4ade80" stroke="#090d16" stroke-width="1.5"/>`).join('')}
  ${langRadarSubjects.map((s, i) => `<text x="${langLabels[i].x}" y="${langLabels[i].y}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="${langLabels[i].anchor}">${s.name}</text>`).join('')}

  <text x="30" y="376" fill="#64748b" font-family="monospace" font-size="11" font-weight="bold">LANGUAGE DISTRIBUTION ACROSS REPOSITORIES</text>

  ${langCardsSvg}
</svg>`;
}

function generateActivityAnalyticsSVG(contributionDays, events) {
  // Monthly Trends (Contribution History Over Time)
  const monthNames = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const today = new Date();
  const monthlyData = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthLabel = monthNames[d.getMonth()];
    const yearMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData.push({ month: monthLabel, yearMonthStr, count: 0 });
  }

  if (contributionDays && contributionDays.length > 0) {
    contributionDays.forEach((day) => {
      if (day.date) {
        const datePrefix = day.date.substring(0, 7);
        const target = monthlyData.find((m) => m.yearMonthStr === datePrefix);
        if (target) {
          target.count += day.count;
        }
      }
    });
  }

  const months = monthlyData.map((m) => m.month);
  const trendVals = monthlyData.map((m) => m.count);
  const maxTrendVal = Math.max(...trendVals, 10);

  // Productive Days of the Week (Mon - Sun)
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  if (contributionDays && contributionDays.length > 0) {
    contributionDays.forEach((day) => {
      const dt = new Date(day.date);
      if (!isNaN(dt.getTime())) {
        dowCounts[dt.getDay()] += day.count;
      }
    });
  }

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayVals = [
    dowCounts[1],
    dowCounts[2],
    dowCounts[3],
    dowCounts[4],
    dowCounts[5],
    dowCounts[6],
    dowCounts[0],
  ];
  const maxDayVal = Math.max(...dayVals, 10);

  // Peak Coding Hours (IST)
  const hourBuckets = new Array(8).fill(0);
  const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
  const maxHourVal = 200;

  if (Array.isArray(events) && events.length > 0) {
    events.forEach((ev) => {
      if (ev.created_at) {
        const dt = new Date(ev.created_at);
        const istHour = (dt.getUTCHours() + 5 + Math.floor((dt.getUTCMinutes() + 30) / 60)) % 24;
        const bucket = Math.floor(istHour / 3);
        hourBuckets[bucket] += 1;
      }
    });
  } else {
    hourBuckets[0] = 12; hourBuckets[1] = 4; hourBuckets[2] = 8; hourBuckets[3] = 45;
    hourBuckets[4] = 62; hourBuckets[5] = 188; hourBuckets[6] = 94; hourBuckets[7] = 72;
  }

  // Area Curve Path Construction
  const chartX = 50;
  const chartY = 240;
  const chartW = 830;
  const chartH = 150;
  const stepX = chartW / (trendVals.length - 1);

  const points = trendVals.map((v, i) => {
    const x = chartX + i * stepX;
    const y = chartY - (v / maxTrendVal) * chartH;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  let lineD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cx1 = p1.x + stepX / 2;
    const cy1 = p1.y;
    const cx2 = p2.x - stepX / 2;
    const cy2 = p2.y;
    lineD += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${p2.x} ${p2.y}`;
  }

  const areaD = `${lineD} L ${points[points.length - 1].x} ${chartY} L ${points[0].x} ${chartY} Z`;

  const areaLabelsSvg = months
    .map((m, i) => {
      const x = chartX + i * stepX;
      return `<text x="${x}" y="${chartY + 18}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${m}</text>`;
    })
    .join('');

  // Weekly Bars
  const wBarWidth = 32;
  const wStepX = 54;
  const wStartX = 65;
  const wBaseY = 460;
  const wMaxH = 100;

  const weeklyBarsSvg = dayVals
    .map((v, i) => {
      const x = wStartX + i * wStepX;
      const barH = (v / maxDayVal) * wMaxH;
      const y = wBaseY - barH;
      return `
      <rect x="${x}" y="${y}" width="${wBarWidth}" height="${barH}" rx="4" fill="#10b981"/>
      <text x="${x + wBarWidth / 2}" y="${wBaseY + 16}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${daysOfWeek[i]}</text>`;
    })
    .join('');

  // Hourly Bars
  const hBarWidth = 32;
  const hStepX = 48;
  const hStartX = 500;
  const hBaseY = 460;
  const hMaxH = 100;

  const hourlyBarsSvg = hourBuckets
    .map((v, i) => {
      const x = hStartX + i * hStepX;
      const barH = (v / maxHourVal) * hMaxH;
      const y = hBaseY - barH;
      return `
      <rect x="${x}" y="${y}" width="${hBarWidth}" height="${barH}" rx="4" fill="#22c55e"/>
      <text x="${x + hBarWidth / 2}" y="${hBaseY + 16}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${hours[i]}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="520" viewBox="0 0 920 520" role="img" aria-label="Activity Analytics and Trends">
  <defs>
    <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <!-- Main Background Container -->
  <rect width="920" height="520" rx="14" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>

  <!-- Terminal Header -->
  <circle cx="30" cy="24" r="5" fill="#f87171"/>
  <circle cx="46" cy="24" r="5" fill="#fbbf24"/>
  <circle cx="62" cy="24" r="5" fill="#34d399"/>
  <text x="80" y="28" fill="#94a3b8" font-family="monospace" font-size="13" font-weight="bold">&gt;_ ~/</text>
  <text x="120" y="28" fill="#10b981" font-family="monospace" font-size="13" font-weight="bold">activity analytics</text>
  <text x="890" y="28" fill="#64748b" font-family="monospace" font-size="11" font-weight="bold" text-anchor="end">CONTRIBUTION TRENDS &amp; PEAK CODING HOURS</text>
  <line x1="20" y1="42" x2="900" y2="42" stroke="#21262d" stroke-width="1"/>

  <!-- Top Area Chart Container: Contribution History Over Time -->
  <rect x="30" y="60" width="860" height="210" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="48" y="84" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">📈 CONTRIBUTION HISTORY OVER TIME</text>
  <rect x="760" y="68" width="116" height="22" rx="6" fill="#064e3b" stroke="#10b981" stroke-width="0.8"/>
  <text x="818" y="83" fill="#34d399" font-family="monospace" font-size="10" text-anchor="middle">Monthly Aggregated</text>

  <line x1="50" y1="128" x2="880" y2="128" stroke="#1e293b" stroke-dasharray="3 3"/>
  <line x1="50" y1="166" x2="880" y2="166" stroke="#1e293b" stroke-dasharray="3 3"/>
  <line x1="50" y1="204" x2="880" y2="204" stroke="#1e293b" stroke-dasharray="3 3"/>
  <line x1="50" y1="240" x2="880" y2="240" stroke="#1e293b"/>

  <path d="${areaD}" fill="url(#areaGrad)"/>
  <path d="${lineD}" fill="none" stroke="#10b981" stroke-width="2.5"/>
  ${areaLabelsSvg}

  <!-- Bottom Left Card: Productive Days -->
  <rect x="30" y="290" width="420" height="205" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="48" y="314" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">📅 PRODUCTIVE DAYS OF THE WEEK</text>
  <line x1="50" y1="460" x2="430" y2="460" stroke="#1e293b"/>
  ${weeklyBarsSvg}

  <!-- Bottom Right Card: Peak Coding Hours -->
  <rect x="470" y="290" width="420" height="205" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="488" y="314" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">🕒 PEAK CODING HOURS (IST)</text>
  <line x1="490" y1="460" x2="870" y2="460" stroke="#1e293b"/>
  ${hourlyBarsSvg}
</svg>`;
}

function generateActivityOverviewSVG(events, repos) {
  let commits = 0;
  let prs = 0;
  let issues = 0;
  let reviews = 0;
  const reposContributedSet = new Set();

  if (Array.isArray(events)) {
    events.forEach((e) => {
      if (e.repo && e.repo.name) reposContributedSet.add(e.repo.name);
      if (e.type === 'PushEvent') {
        commits += e.payload?.commits?.length || 1;
      } else if (e.type === 'PullRequestEvent') {
        prs += 1;
      } else if (e.type === 'IssuesEvent') {
        issues += 1;
      } else if (e.type === 'PullRequestReviewEvent' || e.type === 'PullRequestReviewCommentEvent') {
        reviews += 1;
      }
    });
  }

  const totalTypes = commits + prs + issues + reviews || 1;
  const pctCommits = Math.round((commits / totalTypes) * 100) || 100;
  const pctPRs = Math.round((prs / totalTypes) * 100) || 0;
  const pctIssues = Math.round((issues / totalTypes) * 100) || 0;
  const pctReviews = Math.round((reviews / totalTypes) * 100) || 0;

  const repoList = Array.from(reposContributedSet);
  if (repoList.length === 0 && Array.isArray(repos)) {
    repos.slice(0, 3).forEach((r) => repoList.push(r.full_name || `${USERNAME}/${r.name}`));
  }

  const displayRepoList = repoList.slice(0, 3);
  const otherCount = Math.max(0, (repos.length || 22) - displayRepoList.length);

  const repoListSvg = displayRepoList
    .map((r, i) => {
      const y = 100 + i * 24;
      return `<text x="50" y="${y}" fill="#58a6ff" font-family="monospace" font-size="12" font-weight="bold">${r}</text>`;
    })
    .join('');

  const otherRepoTextY = 100 + displayRepoList.length * 24;

  const cx = 650;
  const cy = 120;
  const rMax = 65;

  const pTop = { x: cx, y: cy - Math.max(8, (pctReviews / 100) * rMax) };
  const pRight = { x: cx + Math.max(8, (pctIssues / 100) * rMax), y: cy };
  const pBottom = { x: cx, y: cy + Math.max(8, (pctPRs / 100) * rMax) };
  const pLeft = { x: cx - Math.max(8, (pctCommits / 100) * rMax), y: cy };

  const crossPolyStr = `${pTop.x.toFixed(1)},${pTop.y.toFixed(1)} ${pRight.x.toFixed(1)},${pRight.y.toFixed(1)} ${pBottom.x.toFixed(1)},${pBottom.y.toFixed(1)} ${pLeft.x.toFixed(1)},${pLeft.y.toFixed(1)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="240" viewBox="0 0 920 240" role="img" aria-label="GitHub Activity Overview">
  <defs>
    <linearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#39d353" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.2"/>
    </linearGradient>
  </defs>

  <rect width="920" height="240" rx="12" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>

  <!-- Left Side: Contributed Repositories -->
  <text x="30" y="38" fill="#e2e8f0" font-family="monospace" font-size="14" font-weight="bold">Activity overview</text>
  <text x="30" y="68" fill="#94a3b8" font-family="monospace" font-size="12">📖 Contributed to</text>

  ${repoListSvg}
  <text x="50" y="${otherRepoTextY}" fill="#94a3b8" font-family="monospace" font-size="11">and ${otherCount} other repositories</text>

  <!-- Divider Line -->
  <line x1="440" y1="20" x2="440" y2="220" stroke="#21262d" stroke-width="1.5"/>

  <!-- Right Side: 4-Axis Cross Activity Chart -->
  <line x1="${cx - rMax}" y1="${cy}" x2="${cx + rMax}" y2="${cy}" stroke="#22c55e" stroke-width="1.5"/>
  <line x1="${cx}" y1="${cy - rMax}" x2="${cx}" y2="${cy + rMax}" stroke="#22c55e" stroke-width="1.5"/>

  <text x="${cx}" y="${cy - rMax - 10}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">Code review</text>
  <text x="${cx + rMax + 12}" y="${cy + 4}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="start">Issues</text>
  <text x="${cx}" y="${cy + rMax + 24}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">${pctPRs}% Pull requests</text>
  <text x="${cx - rMax - 12}" y="${cy + 4}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="end">${pctCommits}% Commits</text>

  <polygon points="${crossPolyStr}" fill="url(#crossGrad)" stroke="#39d353" stroke-width="2"/>
  <circle cx="${pLeft.x}" cy="${pLeft.y}" r="4" fill="#39d353" stroke="#090d16" stroke-width="1.5"/>
  <circle cx="${pTop.x}" cy="${pTop.y}" r="4" fill="#39d353" stroke="#090d16" stroke-width="1.5"/>
  <circle cx="${pRight.x}" cy="${pRight.y}" r="4" fill="#39d353" stroke="#090d16" stroke-width="1.5"/>
  <circle cx="${pBottom.x}" cy="${pBottom.y}" r="4" fill="#39d353" stroke="#090d16" stroke-width="1.5"/>
</svg>`;
}

async function run() {
  console.log('Fetching GitHub profile data for analytics generation...');
  const { user, repos, languages, contributionDays, events } = await fetchGitHubData();

  const toolboxSvg = generateToolboxRadarSVG(languages, USERNAME);
  const activitySvg = generateActivityAnalyticsSVG(contributionDays, events);
  const overviewSvg = generateActivityOverviewSVG(events, repos);

  const toolboxPath = path.join(OUTPUT_DIR, 'toolbox_radar.svg');
  const activityPath = path.join(OUTPUT_DIR, 'activity_analytics.svg');
  const overviewPath = path.join(OUTPUT_DIR, 'activity_overview.svg');

  fs.writeFileSync(toolboxPath, toolboxSvg, 'utf8');
  fs.writeFileSync(activityPath, activitySvg, 'utf8');
  fs.writeFileSync(overviewPath, overviewSvg, 'utf8');

  console.log(`Generated: ${toolboxPath}`);
  console.log(`Generated: ${activityPath}`);
  console.log(`Generated: ${overviewPath}`);
}

run().catch((err) => {
  console.error('Error generating SVG analytics:', err);
  process.exit(1);
});
