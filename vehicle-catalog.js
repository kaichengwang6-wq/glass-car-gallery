/** Display metadata; model and topic modules are loaded only when visited. */
export const catalog = {
  f430: { name: 'F430', brand: 'FERRARI', subtitle: '流动的曲面，藏着机械的秩序。', engine: 'V8', length: '4,512', opening: '侧开车门', paint: 'red', colors: [['经典红', '#b90919'], ['金属银', '#aab1b9'], ['明黄', '#e3ac05']] },
  svj: { name: 'Aventador SVJ', brand: 'LAMBORGHINI', subtitle: '剪刀门、碳纤维，与棱角分明的机械美学。', engine: 'V12', length: '4,943', opening: '剪刀车门', paint: 'paint', colors: [['青柠绿', '#64a819'], ['石墨灰', '#90999c'], ['日落橙', '#ee740a']] },
  mclaren720s: { name: '720S Spider', brand: 'McLAREN', subtitle: '打开硬顶，让光落进碳纤维座舱。', engine: '双涡轮 V8', length: '4,543', opening: '上掀式车门', paint: 'paint', colors: [['木瓜橙', '#ed780f'], ['冰川白', '#dce0dc'], ['深海蓝', '#286d8c']], hint: '打开上掀车门，或进入专属玩法观察敞篷机构' },
  porsche918: { name: '918 Spyder', brand: 'PORSCHE', subtitle: '一台 V8，两台电机，三种能量情景。', engine: 'V8 + 双电机', length: '4,643', opening: '侧开车门', paint: 'paint', colors: [['铂银', '#aeb7b9'], ['竞技黄', '#dfc626'], ['宝石蓝', '#1a4774']], hint: '进入专属玩法，追踪油、电与制动回收的能量流向' },
  huayra: { name: 'Huayra', brand: 'PAGANI', subtitle: '四片襟翼，在曲面之间缓缓舒展。', engine: '双涡轮 V12', length: '4,605', opening: '鸥翼车门', paint: 'paint', colors: [['香槟银', '#a89d86'], ['深红', '#711b24'], ['冰蓝', '#75a6bb']], hint: '打开鸥翼门，或点选四片活动襟翼' },
  chiron: { name: 'Chiron', brand: 'BUGATTI', subtitle: 'W16 与四颗涡轮，共同构筑动力。', engine: '四涡轮 W16', length: '4,544', opening: '侧开车门', paint: 'paint', colors: [['法兰西蓝', '#216aa7'], ['珍珠白', '#d6d4c7'], ['深酒红', '#6e2430']], hint: '进入专属玩法，观察第二对涡轮如何接入' },
  jesko: { name: 'Jesko Attack', brand: 'KOENIGSEGG', subtitle: '九个挡位，让动力选择更直接。', engine: '双涡轮 V8', length: '4,626', opening: '旋翼车门', paint: 'paint', colors: [['陶瓷白', '#d4d8d0'], ['日光黄', '#dfbd34'], ['极光绿', '#397c69']], hint: '打开旋翼门，再体验 7 → 4 跨挡换挡' },
  f40: { name: 'F40', brand: 'FERRARI', subtitle: '掀开经典的轮廓，读懂轻量化的骨架。', engine: '双涡轮 V8', length: '4,358', opening: '侧开车门', paint: 'paint', colors: [['经典红', '#c91b20'], ['赛车黄', '#e5b524'], ['墨黑', '#23272a']], hint: '打开舱盖，或进入结构拆解观察车身与机械的关系' }
};
export const vehicleIds = Object.keys(catalog);
const rowSize = Math.ceil(vehicleIds.length / 2);
export const galleryRows = [vehicleIds.slice(0, rowSize), vehicleIds.slice(rowSize)];
export const galleryLayout = Object.fromEntries(galleryRows.flatMap((row, index) => row.map((id, column) => [id, {
  x: (column - (row.length - 1) / 2) * 4.2,
  y: index === 0 ? 4.7 : 0,
  z: index === 0 ? -.12 : 0,
  row: index
}])));
