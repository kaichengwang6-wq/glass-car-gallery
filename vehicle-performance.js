/** Manufacturer figures for the exact display variants. PS is metric horsepower.
 * renderPerformance(id, HTMLElement): static, accessible six-metric card.
 * performanceSummaryHTML(id): compact four-metric HTML for a glass-case button.
 * Keep published figures separate from the teaching simulations and fuel options.
 */
const source = (title, url) => ({ title, url });
export const performanceSpecs = {
  f430: {
    version: 'F430 Berlinetta · 欧洲版', engine: '自然吸气 V8', acceleration: '4.0', displacement: 4308, litres: '4.308', powerKw: 360.3, powerPs: 490, powerRpm: '8,500 rpm', torqueNm: 465, torqueRpm: '5,250 rpm', topSpeed: '>315', drive: '后轮驱动', gearbox: '6 挡手动 / F1', weight: '干重 1,350 kg；整备质量 1,450 kg（欧洲版）',
    notes: ['零百采用原厂宣传册的 0–100 km/h 4.00 秒，非 Spider 或 430 Scuderia。F1 为电液操作的单离合变速箱。'],
    sources: [source('Ferrari 原厂宣传册（存档）', 'https://kurumacatalog.com/wp-content/uploads/2021/01/2005_Ferrari_F430_catalog.pdf'), source('Ferrari 技术参数（存档）', 'https://www.allcarcentral.com/Ferrari_pdf/Ferrari_f430-2009.pdf')]
  },
  svj: {
    version: 'Aventador SVJ · Coupé', engine: '自然吸气 V12', acceleration: '2.8', displacement: 6498, litres: '6.498', powerKw: 566, powerPs: 770, powerRpm: '8,500 rpm', torqueNm: 720, torqueRpm: '6,750 rpm', topSpeed: '>350', drive: '四轮驱动', gearbox: '7 挡 ISR 单离合', weight: '干重 1,525 kg（非 Roadster）',
    notes: ['此处为硬顶 SVJ；Roadster 的重量与加速数据不同。'],
    sources: [source('Lamborghini SVJ 原厂车型页', 'https://www.lamborghini.com/en-en/history/aventador-svj'), source('Lamborghini 2018 首发资料（存档）', 'https://www.motorshow.me/uploadImages/GalleryDocs/Doc7417.pdf')]
  },
  mclaren720s: {
    version: '720S Spider · 硬顶关闭', engine: '双涡轮 V8', acceleration: '2.9', displacement: 3994, litres: '3.994', powerKw: 530, powerPs: 720, powerRpm: '7,500 rpm', torqueNm: 770, torqueRpm: '5,500 rpm', topSpeed: '341', drive: '后轮驱动', gearbox: '7 挡 SSG 双离合', weight: '最低干重 1,332 kg；DIN 整备质量 1,468 kg',
    notes: ['341 km/h 为车顶关闭工况。最低干重含轻量化选装，不能直接与其他车型的整备质量比较。'],
    sources: [source('McLaren 720S Spider 原厂参数', 'https://www.mclaren.com/cars/gl_en/legacy/720s-spider'), source('McLaren 2021 原厂宣传册（存档）', 'https://manuals.plus/m/eee1f0c23e1b7defd4afe26fed86e65080939cb58a437301b602213b77f0e7fb')]
  },
  porsche918: {
    version: '918 Spyder · 标准版', engine: 'V8 + 前后双电机', acceleration: '2.6', displacement: 4593, litres: '4.593', powerKw: 652, powerPs: 887, powerRpm: '系统综合功率', powerLabel: '系统最大功率', torqueNm: '917–1,280', torqueRpm: '系统峰值 · 随挡位', torqueLabel: '系统峰值扭矩', topSpeed: '345', drive: '混合动力四驱', gearbox: '7 挡 PDK 双离合', weight: '标准版 DIN 整备质量 1,675 kg；EC 1,750 kg（含驾驶员与行李共 75 kg）',
    notes: ['V8 本体为 447 kW / 608 PS，652 kW / 887 PS 为系统综合功率，不能把各动力源峰值简单相加。', '系统峰值扭矩随挡位为 917–1,280 Nm；1,280 Nm 为第 7 挡的曲轴等效值，不是 V8 本体扭矩。零百采用量产定型后的 2.6 秒。'],
    sources: [source('Porsche Museum：918 Spyder', 'https://newsroom.porsche.com/en/press-kits/Porsche-Museum/Porsche-918-Spyder.html'), source('Porsche：混合动力历史与扭矩口径', 'https://newsroom.porsche.com/en_US/products/taycan/history-18563.html'), source('Porsche 2014 原厂宣传册（存档）', 'https://asset.moto.it/pricelist/auto/619826f9b8e7662dd999396a4a1dbb5a/listino_porsche_918_2014.pdf')]
  },
  huayra: {
    version: 'Huayra Coupé · 原厂参数页口径', engine: '双涡轮 V12', acceleration: null, displacement: 5980, litres: '5.980', powerKw: 544, powerPs: 740, powerConverted: true, powerRpm: '5,800 rpm', torqueNm: 1000, torqueRpm: '2,600–4,200 rpm', topSpeed: null, drive: '后轮驱动', gearbox: '7 挡 AMT 单离合', weight: '干重约 1,350 kg，原厂说明依配置变化',
    notes: ['采用原版 Coupé 当前原厂参数页的 544 kW / 730 hp 与 1,000 Nm；不混用早期发布资料或 BC、Roadster 版本。', '公制马力由 544 kW 换算约 740 PS；零百及最高车速未在所引原厂参数页公布，故不填入媒体测试数字。'],
    sources: [source('Pagani Huayra 原厂参数', 'https://www.pagani.com/huayra/')]
  },
  chiron: {
    version: 'Chiron · 标准版', engine: '四涡轮 W16', acceleration: '2.4', displacement: 7993, litres: '7.993', powerKw: 1103, powerPs: 1500, powerRpm: '6,700 rpm', torqueNm: 1600, torqueRpm: '2,000–6,000 rpm', topSpeed: '420', speedNote: 'Top Speed 模式 · 电子限速', drive: '全时四轮驱动', gearbox: '7 挡 DSG 双离合', weight: 'DIN 整备质量 1,995 kg',
    notes: ['使用标准版 Chiron；不套用 Chiron Super Sport 的功率或极速纪录。420 km/h 为 Top Speed 模式电子限速，常规行驶模式上限不同。'],
    sources: [source('Bugatti Chiron 原厂首发资料', 'https://newsroom.bugatti.com/press-releases/geneva-international-motor-show-2016'), source('Bugatti：动力与加速', 'https://newsroom.bugatti.com/press-releases/the-design-dna-of-the-bugatti-hyper-sports-cars'), source('Bugatti 技术参数（存档）', 'https://delen.s3.ap-southeast-1.amazonaws.com/1626097994_Bugatti_Chiron_6aec0f8b41.pdf')]
  },
  jesko: {
    version: 'Jesko Attack · 汽油 / E85 分列', engine: '双涡轮 V8', acceleration: null, displacement: null, litres: '5.0', displacementNote: '原厂标称 5.0 L', powerKw: 954.5, powerPs: 1298, powerConverted: true, powerRpm: '汽油 · 7,800 rpm', powerLabel: '汽油最大功率', torqueNm: 1500, torqueRpm: '最高输出 · 5,100 rpm', topSpeed: null, drive: '后轮驱动', gearbox: '9 挡 LST 多离合', weight: '干重 1,320 kg；整备质量 1,420 kg',
    alternativePower: { label: 'E85 燃料', kw: 1193.1, ps: 1622, original: '1,600 bhp' },
    notes: ['原厂历史页明确标注：汽油 1,280 bhp、E85 1,600 bhp；本卡分别换算为约 1,298 / 1,622 PS，不把 bhp 当成 PS。', '1,500 Nm 为原厂公布的最高输出扭矩；技术页未单列汽油峰值扭矩，不能认为两种燃料均有相同峰值。', '原厂仅列 5.0 L，未列精确 cm³，故不把四舍五入的升数当成精确排量。所引原厂资料未公布 Attack 的零百和极速；Absolut 的纪录不适用于本车。'],
    sources: [source('Koenigsegg Jesko Attack 技术参数', 'https://www.koenigsegg.com/technical-specifications-jesko-attack'), source('Koenigsegg 历史：2019 Jesko（bhp 口径）', 'https://www.koenigsegg.com/index.php/history')]
  },
  f40: {
    version: 'F40 · 欧洲公路版', engine: '双涡轮 V8', acceleration: '4.1', displacement: 2936.25, litres: '2.93625', powerKw: 351.5, powerPs: 478, powerRpm: '7,000 rpm', torqueNm: 577, torqueRpm: '欧洲公路版', topSpeed: '324', drive: '后轮驱动', gearbox: '5 挡手动', weight: '原厂历史页标称 1,100 kg，未注明测量口径',
    notes: ['采用欧洲公路版参数；不套用 F40 LM / Competizione 或美国版。', '原厂不同历史文章的重量数字有差异，本卡保留历史页标称及口径说明，不用其与 DIN 整备质量排名。'],
    sources: [source('Ferrari F40 原厂历史参数', 'https://www.ferrari.com/en-EC/history/garage/1987/f40'), source('Ferrari：Enzo’s Dream', 'https://www.ferrari.com/en-HU/history/moments/1987/enzos-dream/more'), source('Ferrari：F40 的 577 Nm 与技术传承', 'https://www.ferrari.com/fr-CD/magazine/articles/de-la-gto-a-la-f80-en-passant-par-la-piste?amp=true')]
  }
};

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value;
const missing = '未公布';
const metric = (key, label, value, unit, detail = '', compact = false) => `<div class="performance-metric${compact ? ' performance-metric--compact' : ''}" data-metric="${key}"><dt>${escapeHtml(label)}</dt><dd><b>${escapeHtml(number(value))}</b>${unit ? `<span>${escapeHtml(unit)}</span>` : ''}</dd>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</div>`;

export function performanceSummaryHTML(id) {
  const p = performanceSpecs[id];
  if (!p) return '';
  const powerPrefix = p.powerConverted ? '≈' : '';
  return `<span class="performance-summary" aria-label="机械参数概览"><span><small>0–100 km/h</small><b>${escapeHtml(p.acceleration || missing)}${p.acceleration ? '<i> s</i>' : ''}</b></span><span><small>发动机排量</small><b>${escapeHtml(p.displacement ? (p.displacement / 1000).toFixed(2) : p.litres)}<i> L</i></b></span><span><small>${p.powerLabel === '汽油最大功率' ? '汽油功率' : p.powerLabel === '系统最大功率' ? '系统功率' : '最大功率'}</small><b>${powerPrefix}${number(p.powerPs)}<i> PS</i></b></span><span><small>${p.torqueLabel ? '系统扭矩' : id === 'jesko' ? '最高输出扭矩' : '峰值扭矩'}</small><b>${escapeHtml(number(p.torqueNm))}<i> Nm</i></b></span></span>`;
}

export function performanceHTML(id) {
  const p = performanceSpecs[id];
  if (!p) return '';
  const power = `${p.powerConverted ? '≈' : ''}${number(p.powerPs)}`;
  return `<div class="performance-card" data-performance-id="${escapeHtml(id)}"><header><strong>机械档案</strong><span>${escapeHtml(p.version)}</span></header><dl class="performance-grid">${metric('acceleration', '0–100 km/h', p.acceleration || missing, p.acceleration ? 's' : '', p.acceleration ? '原厂公布' : '所引原厂资料未列', !p.acceleration)}${metric('displacement', '发动机排量', p.displacement ? (p.displacement / 1000).toFixed(2) : p.litres, 'L', p.displacement ? `${number(p.displacement)} cm³ · ${p.engine}` : p.displacementNote)}${metric('power', p.powerLabel || '最大功率', power, 'PS', `${number(p.powerKw)} kW · ${p.powerRpm}`)}${metric('torque', p.torqueLabel || '峰值扭矩', p.torqueNm, 'Nm', p.torqueRpm, typeof p.torqueNm === 'string')}${metric('speed', '最高车速', p.topSpeed || missing, p.topSpeed ? 'km/h' : '', p.speedNote || (p.topSpeed ? '原厂公布' : '所引原厂资料未列'), !p.topSpeed)}${metric('drivetrain', '动力传递', p.drive, '', p.gearbox, true)}</dl>${p.alternativePower ? `<p class="performance-fuel">${escapeHtml(p.alternativePower.label)}：<b>≈${number(p.alternativePower.ps)} PS</b> / ${number(p.alternativePower.kw)} kW</p>` : ''}<details class="performance-notes"><summary>数据口径与原厂资料<span aria-hidden="true">＋</span></summary><div class="performance-notes-body"><p>${escapeHtml(p.weight)}</p>${p.notes.map(note => `<p>${escapeHtml(note)}</p>`).join('')}<p>PS / CV 为公制马力；1 PS = 0.73549875 kW。原厂已给出的配对值保留其四舍五入。干重与整备质量口径不同。</p><ul>${p.sources.map(s => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)} ↗</a></li>`).join('')}</ul><small>资料核对：2026-10-15 · 数据卡不随教学动画改变</small></div></details></div>`;
}

export function renderPerformance(id, target) {
  if (!target) return () => {};
  target.classList.add('vehicle-performance');
  target.innerHTML = performanceHTML(id);
  target.hidden = !performanceSpecs[id];
  return () => { target.replaceChildren(); };
}
