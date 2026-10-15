// Engine topics are available for every car. Stories remain gated until authored.
const makeProfile = (id, name, labTitle, presentation, sources) => ({
  id, name, capabilities: ['car', 'lab'], labTitle,
  labModule: './batch-lab.js', labExportName: 'BatchVehicleLab',
  labProfilesExport: 'batchLabProfiles', labPresentation: presentation, labMobileLift: 1.5,
  engineEntryPart: null, sources
});

export const batchProfiles = {
  mclaren720s: makeProfile('mclaren720s', '720S Spider', '敞篷机构观察', 'vehicle', [
    ['迈凯伦 · 720S Spider', 'https://www.mclaren.com/cars/gl_en/legacy/720s-spider']
  ]),
  porsche918: makeProfile('porsche918', '918 Spyder', '混合动力能量实验', 'stage', [
    ['保时捷 · 918 Spyder 混动系统', 'https://newsroom.porsche.eu/en/press-kits/Media-Drive-Cayenne-E-Performance/10-Jahre-Porsche-918-Spyder.html']
  ]),
  huayra: makeProfile('huayra', 'Huayra', '四襟翼机构观察', 'vehicle', [
    ['帕加尼 · Huayra', 'https://www.pagani.com/huayra/']
  ]),
  chiron: makeProfile('chiron', 'Chiron', '四涡轮接力实验', 'stage', [
    ['布加迪 · Chiron 原厂发布资料', 'https://newsroom.bugatti.com/press-releases/geneva-international-motor-show-2016']
  ]),
  jesko: makeProfile('jesko', 'Jesko Attack', '跨挡换挡实验', 'stage', [
    ['科尼赛克 · LST 与 UPOD', 'https://www.koenigsegg.com/lst'],
    ['科尼赛克 · Jesko Attack', 'https://www.koenigsegg.com/model/jesko-attack']
  ])
};

const mclarenSpec = 'https://kurumacatalog.com/wp-content/uploads/2021/01/2019_McLaren_720S_Spider_catalog.pdf';
const mclarenPress = 'https://www.scribd.com/document/932033192/13914-McLaren720SSpidermediainformationv22CLEAN';
const porscheTech = 'https://www.scribd.com/doc/247128024/Tech-Specs-2015-Porsche-918-Spyder';
const porscheV8 = 'https://newsroom.porsche.com/en/company/porsche-eight-cylinder-engines-history-12690.html';
const porscheHybrid = 'https://newsroom.porsche.com/en/press-kits/Media-Drive-Cayenne-E-Performance/10-Jahre-Porsche-918-Spyder.html';
const paganiArchive = 'https://www.pagani.com/app/uploads/2023/06/Pagani-25%C2%B0-Anniversario_Evento_Approndimenti_ITA.pdf';
const bugattiEngine = 'https://newsroom.bugatti.com/press-releases/bugatti-w16-engine-the-last-of-its-kind';
const bugattiLayout = 'https://newsroom.bugatti.com/en/press-releases/15-years-of-bugatti-veyron-how-it-all-began';
const jeskoSpec = 'https://www.koenigsegg.com/technical-specifications-jesko-attack';
const caution = '外观为按动力总成特征独立制作的教学模型；壳体尺寸、管线走向、连杆长度、缸距、缸号、曲拐分配和示例点火顺序均作示意，配气采用简化时序。拆装台讲解组成关系，不作为维修步骤。';
const ignition = (count, extra = '') => ({ id: 'ignition', label: '点火系统', title: `${count} 缸的点火接力`, copy: `火花塞点燃压缩后的混合气，推动活塞做功。线圈与线束在外观中独立分件；进入内部原理可点选气缸，跟随进气、压缩、做功和排气。颜色与闪光是过程提示，教学缸号和示例点火次序不代表原车标定。${extra}` });
const engineTopics = {
  mclaren720s: {
    cylinderCount: 8, engineName: 'V8', exportName: 'McLaren720SEngine',
    specs: 'M840T · 3,994 cm³ · 双涡轮 V8', exteriorScale: 2.15, internalScale: 4.2,
    hotspots: [
      { id: 'intake', label: '进气系统', title: '压低的铸铝进气腔', copy: 'M840T 通过降低进气稳压腔高度，让动力总成更低矮。两侧压气机送来的空气经冷却后进入进气腔，再分送八个气缸。本展台用低矮的银色腔体和八条支管表现这一关系；管线位置为教学示意。' },
      { id: 'block', label: '缸体', title: '紧凑的双涡轮 V8', copy: '720S Spider 使用 3,994 cm³ 的 M840T。八个气缸共用一根曲轴，活塞经连杆将往复运动变成旋转。内部模型采用 90° V8 布局；基础资料未逐项核实的尺寸会单独标为教学采用值。' },
      { id: 'covers', label: '气缸盖罩', title: '两列气缸之上的盖罩', copy: '两侧盖罩覆盖上部配气机构，外侧保留线圈和接线位置。切到内部原理，可观察简化的凸轮、气门与活塞如何按同一曲轴角运行；外部曲面和螺栓位置没有采用原厂工程 CAD。' },
      ignition(8),
      { id: 'turbo', label: '双涡轮', title: '废气推动进气增压', copy: '原厂采用两颗低惯量双涡管涡轮。排气推动涡轮侧叶轮，同轴压气机压缩新鲜空气；两种气体在各自通道内流动。展台将深色热端和银色压气端分开，便于辨认，不模拟真实增压控制。' },
    ],
    learning: ['教学气缸分为 L1–L4、R1–R4；平面曲轴特点依据 720S Spider 原厂媒体资料。曲轴每转两圈，每缸做功一次，八缸示例间隔 90°。', '本模型采用 93 mm 缸径、73.5 mm 行程和 90° 夹角作教学尺寸；这些尺寸未在本页所引的原厂资料中逐项核实，不作为厂家精确参数。', caution],
    engineSources: [['720S Spider 原厂手册归档 · 排量与双涡轮', mclarenSpec], ['原厂媒体资料归档 · 平面曲轴与进气腔', mclarenPress]],
  },
  porsche918: {
    cylinderCount: 8, engineName: 'V8', exportName: 'Porsche918Engine',
    specs: '90° V8 · 4,593 cm³ · 自然吸气 + 双电机', exteriorScale: 1.9, internalScale: 4.2,
    hotspots: [
      { id: 'intake', label: '进气与热侧', title: '进气在外，排气在 V 内', copy: '918 的自然吸气 V8 将排气侧置于 V 形夹角内部，缩短通向顶置尾管的高温路径；进气位于两侧。展台可分别辨认外侧进气腔和中央排气汇流管。它没有涡轮，银色顶管不是增压器。' },
      { id: 'block', label: '缸体', title: '来自赛车思路的 V8', copy: '两列气缸以 90° 夹角排列，采用平面曲轴。原厂技术资料给出 4,593 cm³ 排量、95 mm 缸径和 81 mm 行程。内部原理只演示这台燃油发动机；双电机的能量分配可在专属玩法中观察。' },
      { id: 'covers', label: '气缸盖罩', title: '热侧两旁的配气机构', copy: '盖罩、气缸盖与中央隔热排气组件分开建模。配气机构让进、排气门随循环开闭；内部原理中的气门升程与时刻采用简化教学曲线，并非原车可变正时控制。' },
      ignition(8),
      { id: 'hybrid', label: '混动连接', title: 'V8 后方的电机接口', copy: '后部混动模块由电机和分离离合器等组成，与 V8、变速器构成后桥动力单元。另一台电机独立驱动前桥，并不装在 V8 内部。外观展台展示后混动模块和橙色高压接口；专属玩法显示两台电机、电池与 V8 的能量关系。' },
    ],
    learning: ['原厂资料确认：90° V8、平面曲轴、95 mm 缸径、81 mm 行程，排量 4,593 cm³。教学缸号为 L1–L4、R1–R4，示例每隔 90° 开始一次做功。', '本视图展示燃油 V8 的四冲程；后桥电机与它可共同输出动力，前桥电机机械上独立。电机没有活塞，也不经历四冲程。', caution],
    engineSources: [['Porsche 原厂技术表归档 · 缸径与行程', porscheTech], ['Porsche · 918 V8 的布局与平面曲轴', porscheV8], ['Porsche · 双电机和后混动模块', porscheHybrid]],
  },
  huayra: {
    cylinderCount: 12, engineName: 'V12', exportName: 'HuayraEngine',
    specs: 'M158 · 5,980 cm³ · 双涡轮 V12 · 36 气门', exteriorScale: 1.95, internalScale: 3.4,
    hotspots: [
      { id: 'intake', label: '进气系统', title: '两组进气，通向十二缸', copy: 'Mercedes-AMG 为 Huayra 制作 M158 双涡轮 V12。外观用纵向进气腔、十二条分支和两侧增压管道表现其长形布局；可旋转展台追踪压气机到进气腔的连接。未公开管线尺度为教学示意。' },
      { id: 'block', label: '缸体', title: '更长的十二缸骨架', copy: '原版 Huayra Coupé 使用 5,980 cm³ V12。两列各六个气缸共用曲轴，相比八缸可清楚看到增加的纵向气缸位置。这里的铸件、附件支架与油底壳采用可辨认的独立分件。' },
      { id: 'covers', label: '气缸盖罩', title: '36 个气门的呼吸节奏', copy: 'Pagani 的原版 Coupé 回顾资料明确记载 M158 共 36 个气门。教学机构因此采用每缸两只进气门、一只排气门，共 36 只，并以每列一根简化凸轮轴表现配气；从动件结构与凸轮轮廓不代表原车细部。' },
      ignition(12, '火花塞数量与线圈接线位置在外观中采用简化表达。'),
      { id: 'turbo', label: '双涡轮', title: '十二缸的两颗增压器', copy: '原厂为 Huayra 选择双涡轮 V12，并强调平顺的动力响应。两侧排气汇流后推动各自热端，压气端再向进气系统供气。静态展台展示构成关系，实际响应和控制策略不在本模型中计算。' },
    ],
    learning: ['原厂确认 M158、5,980 cm³、V12 双涡轮和 36 气门。教学气缸为 L1–L6、R1–R6，共用曲轴，每缸每 720° 做功一次，示例间隔 60°。', '教学采用 60° 布局、82.6 mm 缸径和 93 mm 行程；这些尺寸未在所引原版 Coupé 资料中逐项核实。曲轴采用相差 120° 的三方向曲拐示意，不将其称为平面曲轴。', caution],
    engineSources: [['Pagani · 原版 Huayra 参数', 'https://www.pagani.com/huayra/'], ['Pagani 原厂回顾 · 2011 Coupé 与 36 气门（第4页）', paganiArchive]],
  },
  chiron: {
    cylinderCount: 16, engineName: 'W16', exportName: 'ChironEngine',
    cylinderGroups: ['A', 'B', 'C', 'D'].map(id => ({ id, label: `${id} 列`, cylinders: [1, 2, 3, 4].map(i => `${id}${i}`) })),
    specs: 'W16 · 7,993 cm³ · 四涡轮 · 四列气缸', exteriorScale: 1.75, internalScale: 3.4,
    hotspots: [
      { id: 'intake', label: '进气系统', title: '两侧大进气腔，服务十六缸', copy: '大型进气组件和支管向 W16 供气。原厂 Chiron 使用四颗涡轮，进气系统需配合增压和冷却；本模型保留两侧上部进气罩及分支，管线尺度与附件位置用作辨认示意。' },
      { id: 'block', label: 'W16 缸体', title: '四列气缸，一根曲轴', copy: 'W16 将两组窄角 V8 组合起来，组内夹角 15°、两组之间 90°，共用一根曲轴。内部原理采用 A、B、C、D 四列各四缸的教学编号；这不是将两台完整 V8 发动机并排独立运转。' },
      { id: 'covers', label: '气缸盖罩', title: '紧凑排列之上的盖罩', copy: '两侧气缸盖区域各覆盖两列错开的气缸。切入内部原理可以看到四列活塞与共用曲轴，配气机构以简化凸轮和气门展示；原厂 Chiron 每缸四气门，模型共显示 64 只。' },
      ignition(16),
      { id: 'turbo', label: '四涡轮', title: '两颗先工作，另两颗接入', copy: '标准版 Chiron 的四颗同尺寸涡轮分成两对，第二对在约 3,800 rpm 加入。这里可点选四颗外观组件；专属玩法单独展示“两颗到四颗”的接力过程。并非四颗依次接入，也不是空气串联压缩四次。' },
    ],
    learning: ['四列各四缸共用一根曲轴；15° 窄角分组和 90° 组合布局依据 Bugatti 的 W16 介绍。教学编号 A1–A4、B1–B4、C1–C4、D1–D4，每 720° 每缸做功一次，示例间隔 45°。', '教学采用 86 mm 缸径、86 mm 行程；尺寸未在所引 Chiron 原厂资料中逐项核实。曲柄销分配、四列连杆偏置及凸轮从动件布局均作教学示意。', caution],
    engineSources: [['Bugatti · W16 的结构与 45° 点火间隔', bugattiEngine], ['Bugatti · W16 的 15° / 90° 组合布局', bugattiLayout], ['Bugatti · 标准 Chiron 原厂参数', 'https://bugatti-newsroom.imgix.net/66703700d9bf8f4b7ce9211c/211122_BU_Chiron%20ENG.pdf']],
  },
  jesko: {
    cylinderCount: 8, engineName: 'V8', exportName: 'JeskoEngine',
    specs: '5.0 L V8 · 双涡轮 · 平面曲轴', exteriorScale: 2.0, internalScale: 4.2,
    hotspots: [
      { id: 'intake', label: '碳纤维进气', title: '交错的进气支管', copy: '原厂 Jesko 采用碳纤维进气歧管，并优化进气道。展台将拱形支管、上部进气腔与两侧管路独立建模，让八缸的供气关系可见；曲率和尺度是展示用近似。' },
      { id: 'block', label: '缸体', title: '长行程的 5.0 L V8', copy: 'Jesko Attack 的原厂参数给出 92 mm 缸径、95.25 mm 行程，采用铝制双涡轮 V8。内部原理可以观察较长行程和连杆运动；教学模型的连杆长度、缸距及附件安装尺寸不代表制造尺寸。' },
      { id: 'covers', label: '气缸盖罩', title: '四根凸轮轴，32 只气门', copy: 'Jesko 使用双顶置凸轮轴，每缸四气门。外部盖罩保护配气机构，内部视图将四根凸轮轴与 32 只气门展开；转动速比为曲轴每转两圈、凸轮轴转一圈，开闭曲线作教学简化。' },
      ignition(8),
      { id: 'turbo', label: '双涡轮', title: '热端、压气端各司其职', copy: '原厂列出两颗陶瓷滚珠轴承涡轮及 Inconel 排气歧管。模型用热端金属、银色压气壳和碳纤维进气分别表现不同部位；不把其他车型的 Hot-V 布局套到这台 Jesko 上。' },
    ],
    learning: ['原厂明确采用 92 mm 缸径、95.25 mm 行程及 180° 平面曲轴。八缸教学编号为 L1–L4、R1–R4；每缸每两圈完成一次四冲程，示例做功间隔 90°。', 'V8 教学布置采用 90° 夹角；本页所引 Jesko Attack 参数未单列该角度。运动由同一曲轴角驱动，凸轮轴以一半转速转动；这与专属玩法的 LST 跨挡演示相互独立。', caution],
    engineSources: [['Koenigsegg · Jesko Attack 原厂发动机参数', jeskoSpec], ['Koenigsegg · Jesko 的平面曲轴', 'https://www.koenigsegg.com/engines']],
  },
};
for (const [id, engine] of Object.entries(engineTopics)) Object.assign(batchProfiles[id], {
  ...engine, capabilities: ['car', 'engine', 'lab'], module: './engine-batch.js',
  internalHeight: .92, assemblyHeight: engine.cylinderCount === 8 ? .57 : .42,
  engineCamera: {
    exterior: { position: [-4.9, 3.4, 6.5], target: [0, 1.18, 1.8] },
    internal: { position: [-4.5, 3.3, 6.2], target: [0, 1.45, 1.8] },
    assembly: { position: [-5.4, 3.9, 7.6], target: [0, 1.55, 1.8] },
  },
});
