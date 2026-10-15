const archive = 'https://www.ferrari.com/en-EC/history/garage/1987/f40';
const story = 'https://www.ferrari.com/en-HU/history/moments/1987/enzos-dream/more';
const retrospective = 'https://www.ferrari.com/ko-KR/magazine/articles/the-ferrari-f40-revisited';
const competition = 'https://www.ferrari.com/en-GQ/history/garage/1989/f40-competizione';
const manual = 'https://manualzz.com/doc/5834907/ferrari-f40-sports-car-technical-manual';

export const f40Content = {
  id: 'f40', name: 'F40', capabilities: ['car', 'history', 'engine', 'lab'],
  eyebrow: 'THE F40 STORY / 1987', engineEntryPart: 'engine_cover',
  labTitle: '整车结构拆解', labModule: './f40-lab.js', labExportName: 'F40StructureLab',
  labProfilesExport: 'f40LabProfiles', labPresentation: 'vehicle', labMobileLift: 1.5,
  chapters: [
    { label: '诞生背景', year: '1987 / FORTY YEARS', title: '为四十周年，留下鲜明的轮廓。', view: 'hero', copy: '1987 年，法拉利用 F40 纪念品牌成立四十周年。这辆公路超跑从 GTO Evoluzione 的技术探索中走来，把赛车经验变成鲜明的楔形车身、宽阔尾翼和中置双涡轮动力。它也是恩佐·法拉利生前见证的最后一辆法拉利超级跑车。', sources: [['Ferrari · F40 的诞生', story]] },
    { label: '设计与技术', year: 'LIGHTNESS / TURBO V8', title: '打开外壳，看见轻量化的骨架。', view: 'engine', parts: ['engine_cover'], copy: 'F40 将钢管车架与复合材料结合，车身外壳、承力结构和动力总成各有任务。后舱内的 90° V8 配有两颗涡轮与中冷器；宽大的尾罩打开后，机械布局直接呈现。进入结构拆解，可逐层观察这些部件的位置关系，再把整车装回。', sources: [['Ferrari · 结构与双涡轮', story], ['Ferrari · F40 技术回顾', retrospective]] },
    { label: '家族延展', year: 'GTO / F40 / COMPETIZIONE', title: '从研发原型，走向公路与赛场。', view: 'rear', copy: 'GTO Evoluzione 为 F40 的造型与技术提供探索基础，F40 Competizione 又将这一思路推向赛道。公路版与竞赛版的动力、气动套件和用途不同。下方用文字说明传承，眼前保留的始终是 F40 公路版。', sources: [['Ferrari · 研发传承', story], ['Ferrari · F40 Competizione 档案', competition]] },
  ],
  family: [{ name: 'GTO Evoluzione', caption: '研发与技术先声' }, { name: 'F40', caption: '当前公路版车模', current: true }, { name: 'F40 Competizione', caption: '竞赛延展' }],
  specs: '90° V8 · 2,936.25 cm³ · 双涡轮 · 32 气门',
  cylinderCount: 8, engineName: 'V8', module: './engine-batch.js', exportName: 'F40Engine',
  exteriorScale: 2.05, internalScale: 4.5, internalHeight: .92, assemblyHeight: .57,
  engineCamera: {
    exterior: { position: [-4.9, 3.5, 6.6], target: [0, 1.18, 1.8] },
    internal: { position: [-4.5, 3.3, 6.2], target: [0, 1.45, 1.8] },
    assembly: { position: [-6.1, 4.8, 9.2], target: [0, 1.55, 1.8] },
  },
  hotspots: [
    { id: 'intake', label: '进气与中冷器', title: '两路增压，交叉通向另一列气缸。', copy: '原厂手册描述两路交叉供气：左压气机经中冷器供给右列，右压气机供给左列。银色双进气腔、八条支管和两侧中冷器分别建模；跨列关系参考 1992 美规技术手册，管线尺度与弯曲路径为示意。' },
    { id: 'block', label: '缸体与正时端', title: '小排量 V8 的机械骨架。', copy: '公路版 F40 使用纵向布置的 90° V8，排量 2,936.25 cm³。铝合金外壳内，八组活塞与连杆共用一根曲轴。独立外观保留前端正时区域与附件，内部原理用 82 mm 缸径、69.5 mm 行程作教学采用值。' },
    { id: 'covers', label: '红色气缸盖罩', title: '红色盖罩下，四根凸轮轴控制呼吸。', copy: '两列气缸各有进气和排气侧的配气机构，F40 每缸四气门，共 32 只。切换内部原理可看见凸轮轴以曲轴一半的转速旋转；气门升程、从动件形状与开闭曲线为简化教学示意。' },
    { id: 'ignition', label: '点火与高压线', title: '八次点火，连接一个完整循环。', copy: '模型用高压线、接头和火花塞位置表达点火路径。选中 L1–L4 或 R1–R4 任一教学气缸，可查看当前的进气、压缩、做功或排气阶段。示例点火顺序不代表原车缸号与标定。' },
    { id: 'turbo', label: '双涡轮与排气', title: '废气与新鲜空气，走两条独立通道。', copy: 'F40 的两颗 IHI 涡轮由排气驱动；同轴压气机将新鲜空气压入进气系统。金属热端、银色压气端和各自管道分开显示，便于追踪连接关系。这里展示组成，不计算真实增压值和涡轮响应。' },
  ],
  learning: [
    '原厂资料确认纵向 90° V8、2,936.25 cm³、双涡轮与每缸四气门。八组活塞、连杆和 32 只气门由同一个曲轴角驱动；凸轮轴转速为曲轴的一半。',
    '82 mm 缸径、69.5 mm 行程及四凸轮双正时齿带参考 1992 美规 F40 原厂技术手册 B4–B5 页；它只用于机构参考，整车性能仍按欧洲公路版资料。平面曲拐、L1–L4 / R1–R4 缸号及每隔 90° 的示例点火顺序为教学设定。',
    '拆装台把同一外观模型中的进气、双中冷器和双涡轮与四组内部机构组合为七个模块。未公开的壳体尺寸、管路、连杆长度、缸距、曲拐分配和配气采用示意；拆装台说明总成关系，不是维修操作流程。',
  ],
  engineSources: [['Ferrari · F40 原厂档案', archive], ['Ferrari · 双涡轮与中冷器', story], ['Ferrari · 90° V8 与四气门', retrospective], ['原厂技术手册归档 · 1992 美规机构参考', manual]],
  sources: [['Ferrari · F40', archive], ['Ferrari · F40 结构', story]],
};
