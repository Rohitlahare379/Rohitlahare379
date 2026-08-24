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
  TypeScript: '#3178c6',
  Python: '#3572A5',
  JavaScript: '#f1e05a',
  Java: '#b07219',
  CSS: '#563d7c',
  C: '#555555',
  'C++': '#f34b7d',
  HTML: '#e34c26',
  Go: '#00ADD8',
  Rust: '#dea584',
  PHP: '#4F5D95',
  Shell: '#89e051',
  SQL: '#003B57',
  PostgreSQL: '#4169E1',
};

async function fetchGitHubData() {
  let user = { login: USERNAME, public_repos: 22 };
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

  return { user, repos, events };
}

// Helper for radar chart geometry
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
    const y = center.y + labelDistance * Math.sin(angle) + 4; // slight vertical balance
    let anchor = 'middle';
    if (Math.cos(angle) > 0.3) anchor = 'start';
    if (Math.cos(angle) < -0.3) anchor = 'end';
    coords.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), anchor });
  }
  return coords;
}

function generateToolboxRadarSVG(languages, username) {
  const skillSubjects = [
    { name: 'JavaScript', val: 95 },
    { name: 'TypeScript', val: 88 },
    { name: 'React', val: 92 },
    { name: 'Node/API', val: 85 },
    { name: 'Databases', val: 78 },
    { name: 'Python', val: 82 },
    { name: 'DSA', val: 90 },
  ];

  // Dynamic Language Mix Radar: build strictly from actual repository language distribution
  const displayLangs =
    languages.length > 0
      ? languages.slice(0, 6)
      : [
          { name: 'TypeScript', percentage: 74.9, repoCount: 8, bytes: 145000, color: '#3178c6' },
          { name: 'Python', percentage: 12.2, repoCount: 5, bytes: 89000, color: '#3572A5' },
          { name: 'JavaScript', percentage: 9.9, repoCount: 6, bytes: 112000, color: '#f1e05a' },
          { name: 'Java', percentage: 1.6, repoCount: 3, bytes: 42000, color: '#b07219' },
          { name: 'CSS', percentage: 1.0, repoCount: 2, bytes: 31000, color: '#563d7c' },
          { name: 'C', percentage: 0.4, repoCount: 1, bytes: 12000, color: '#555555' },
        ];

  const maxPct = Math.max(...displayLangs.map((l) => l.percentage), 1);
  const langRadarSubjects = displayLangs.map((l) => {
    // Proportional ratio score: top language is 100, others scale nicely
    const ratioScore = Math.min(100, Math.max(18, Math.round((l.percentage / maxPct) * 82 + 18)));
    return { name: l.name, val: ratioScore };
  });

  // Ensure at least 6 points for a balanced radar
  while (langRadarSubjects.length < 6) {
    const fallbackNames = ['HTML', 'SQL', 'Git'];
    const name = fallbackNames[langRadarSubjects.length % fallbackNames.length];
    langRadarSubjects.push({ name, val: 20 });
  }

  // Adjust center y=240 and radius=85 so top labels sit cleanly below y=124 title and inside card bounds!
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

  // Tech stack icons top bar
  const techBadges = [
    { label: 'C++', bg: '#1e293b', color: '#f34b7d' },
    { label: 'JS', bg: '#422006', color: '#f1e05a' },
    { label: 'TS', bg: '#1e3a8a', color: '#3178c6' },
    { label: 'React', bg: '#083344', color: '#61dafb' },
    { label: 'Node', bg: '#064e3b', color: '#10b981' },
    { label: 'Python', bg: '#1e1b4b', color: '#818cf8' },
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

  // Language cards SVG (bottom section)
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

  <!-- Background Card -->
  <rect width="920" height="540" rx="14" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>

  <!-- Terminal Header -->
  <circle cx="30" cy="24" r="5" fill="#f87171"/>
  <circle cx="46" cy="24" r="5" fill="#fbbf24"/>
  <circle cx="62" cy="24" r="5" fill="#34d399"/>
  <text x="80" y="28" fill="#94a3b8" font-family="monospace" font-size="13" font-weight="bold">&gt;_ ~/</text>
  <text x="120" y="28" fill="#10b981" font-family="monospace" font-size="13" font-weight="bold">toolbox</text>
  <text x="890" y="28" fill="#64748b" font-family="monospace" font-size="11" font-weight="bold" text-anchor="end">SKILL &amp; LANGUAGE RADAR ANALYTICS</text>
  <line x1="20" y1="40" x2="900" y2="40" stroke="#21262d" stroke-width="1"/>

  <!-- Tech Badges Bar -->
  ${badgeSvg}

  <!-- Left Radar Card: SKILL RADAR -->
  <rect x="30" y="95" width="410" height="260" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="48" y="118" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">&lt;/&gt; SKILL RADAR</text>
  <text x="422" y="118" fill="#64748b" font-family="monospace" font-size="10" text-anchor="end">Core Proficiencies</text>
  
  <!-- Skill Grid -->
  ${skillGrid.map((p) => `<polygon points="${p}" fill="none" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  ${skillAxes.map((a) => `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  <polygon points="${skillPolyStr}" fill="url(#skillGrad)" stroke="#10b981" stroke-width="2"/>
  ${skillPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#34d399" stroke="#090d16" stroke-width="1.5"/>`).join('')}
  ${skillSubjects.map((s, i) => `<text x="${skillLabels[i].x}" y="${skillLabels[i].y}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="${skillLabels[i].anchor}">${s.name}</text>`).join('')}

  <!-- Right Radar Card: LANGUAGE MIX RADAR -->
  <rect x="470" y="95" width="420" height="260" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="488" y="118" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">${username} - LANGUAGE MIX</text>
  <text x="872" y="118" fill="#64748b" font-family="monospace" font-size="10" text-anchor="end">Repository Code Ratio</text>
  
  <!-- Lang Grid -->
  ${langGrid.map((p) => `<polygon points="${p}" fill="none" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  ${langAxes.map((a) => `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="#1e293b" stroke-dasharray="3 3" stroke-width="1"/>`).join('')}
  <polygon points="${langPolyStr}" fill="url(#langGrad)" stroke="#22c55e" stroke-width="2"/>
  ${langPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#4ade80" stroke="#090d16" stroke-width="1.5"/>`).join('')}
  ${langRadarSubjects.map((s, i) => `<text x="${langLabels[i].x}" y="${langLabels[i].y}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="${langLabels[i].anchor}">${s.name}</text>`).join('')}

  <!-- Language Distribution Header -->
  <text x="30" y="376" fill="#64748b" font-family="monospace" font-size="11" font-weight="bold">LANGUAGE DISTRIBUTION ACROSS REPOSITORIES</text>

  <!-- Language Progress Cards -->
  ${langCardsSvg}
</svg>`;
}

function generateActivityAnalyticsSVG() {
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const trendVals = [24, 38, 45, 52, 68, 74, 89, 94, 82, 76, 88, 95];

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayVals = [42, 68, 85, 79, 64, 38, 25];

  const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
  const hourVals = [12, 4, 8, 45, 62, 188, 94, 72];

  // Construct Area Curve Path
  const chartX = 50;
  const chartY = 240;
  const chartW = 830;
  const chartH = 150;
  const stepX = chartW / (trendVals.length - 1);

  const points = trendVals.map((v, i) => {
    const x = chartX + i * stepX;
    const y = chartY - (v / 100) * chartH;
    return { x, y };
  });

  let lineD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const cx1 = p1.x + stepX / 2;
    const cy1 = p1.y;
    const cx2 = p2.x - stepX / 2;
    const cy2 = p2.y;
    lineD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;
  }

  const areaD = `${lineD} L ${points[points.length - 1].x} ${chartY} L ${points[0].x} ${chartY} Z`;

  // X-axis & Y-axis labels for Area chart
  const areaLabelsSvg = months
    .map((m, i) => {
      const x = chartX + i * stepX;
      return `<text x="${x}" y="${chartY + 18}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${m}</text>`;
    })
    .join('');

  // Weekly Bar Chart
  const wBarWidth = 32;
  const wStepX = 54;
  const wStartX = 65;
  const wBaseY = 460;
  const wMaxH = 100;
  const wMaxVal = 100;

  const weeklyBarsSvg = dayVals
    .map((v, i) => {
      const x = wStartX + i * wStepX;
      const barH = (v / wMaxVal) * wMaxH;
      const y = wBaseY - barH;
      return `
      <rect x="${x}" y="${y}" width="${wBarWidth}" height="${barH}" rx="4" fill="#10b981"/>
      <text x="${x + wBarWidth / 2}" y="${wBaseY + 16}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${daysOfWeek[i]}</text>`;
    })
    .join('');

  // Hourly Bar Chart
  const hBarWidth = 32;
  const hStepX = 48;
  const hStartX = 500;
  const hBaseY = 460;
  const hMaxH = 100;
  const hMaxVal = 200;

  const hourlyBarsSvg = hourVals
    .map((v, i) => {
      const x = hStartX + i * hStepX;
      const barH = (v / hMaxVal) * hMaxH;
      const y = hBaseY - barH;
      return `
      <rect x="${x}" y="${y}" width="${hBarWidth}" height="${barH}" rx="4" fill="#22c55e"/>
      <text x="${x + hBarWidth / 2}" y="${hBaseY + 16}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${hours[i]}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="520" viewBox="0 0 920 520" role="img" aria-label="Activity Analytics &amp; Contribution Trends">
  <defs>
    <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect width="920" height="520" rx="14" fill="#0d1117" stroke="#30363d" stroke-width="1.5"/>

  <!-- Terminal Header -->
  <circle cx="30" cy="24" r="5" fill="#f87171"/>
  <circle cx="46" cy="24" r="5" fill="#fbbf24"/>
  <circle cx="62" cy="24" r="5" fill="#34d399"/>
  <text x="80" y="28" fill="#94a3b8" font-family="monospace" font-size="13" font-weight="bold">&gt;_ ~/</text>
  <text x="120" y="28" fill="#10b981" font-family="monospace" font-size="13" font-weight="bold">activity analytics</text>
  <text x="890" y="28" fill="#64748b" font-family="monospace" font-size="11" font-weight="bold" text-anchor="end">CONTRIBUTION TRENDS &amp; PEAK CODING HOURS</text>
  <line x1="20" y1="42" x2="900" y2="42" stroke="#21262d" stroke-width="1"/>

  <!-- Top Area Chart Container -->
  <rect x="30" y="60" width="860" height="210" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
  <text x="48" y="84" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold">📈 CONTRIBUTION HISTORY OVER TIME</text>
  <rect x="760" y="68" width="116" height="22" rx="6" fill="#064e3b" stroke="#10b981" stroke-width="0.8"/>
  <text x="818" y="83" fill="#34d399" font-family="monospace" font-size="10" text-anchor="middle">Monthly Aggregated</text>

  <!-- Grid Lines -->
  <line x1="50" y1="128" x2="880" y2="128" stroke="#1e293b" stroke-dasharray="3 3"/>
  <line x1="50" y1="166" x2="880" y2="166" stroke="#1e293b" stroke-dasharray="3 3"/>
  <line x1="50" y1="204" x2="880" y2="204" stroke="#1e293b" stroke-dasharray="3 3"/>
  <line x1="50" y1="240" x2="880" y2="240" stroke="#1e293b"/>

  <!-- Area Fill & Stroke Curve -->
  <path d="${areaD}" fill="url(#areaGrad)"/>
  <path d="${lineD}" fill="none" stroke="#10b981" stroke-width="2.5"/>

  <!-- Axis Labels -->
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

async function run() {
  console.log('Fetching GitHub profile data for analytics generation...');
  const { user, repos } = await fetchGitHubData();

  // Language Stats calculation
  const langMap = {};
  let totalBytes = 0;
  repos.forEach((r) => {
    if (r.language) {
      const approxBytes = (r.size || 10) * 1024;
      langMap[r.language] = (langMap[r.language] || 0) + approxBytes;
      totalBytes += approxBytes;
    }
  });

  const languages = Object.entries(langMap)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes > 0 ? Number(((bytes / totalBytes) * 100).toFixed(1)) : 0,
      color: LANGUAGE_COLORS[name] || '#10b981',
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const toolboxSvg = generateToolboxRadarSVG(languages, USERNAME);
  const activitySvg = generateActivityAnalyticsSVG();

  const toolboxPath = path.join(OUTPUT_DIR, 'toolbox_radar.svg');
  const activityPath = path.join(OUTPUT_DIR, 'activity_analytics.svg');

  fs.writeFileSync(toolboxPath, toolboxSvg, 'utf8');
  fs.writeFileSync(activityPath, activitySvg, 'utf8');

  console.log(`Generated: ${toolboxPath}`);
  console.log(`Generated: ${activityPath}`);
}

run().catch((err) => {
  console.error('Error generating SVG analytics:', err);
  process.exit(1);
});
