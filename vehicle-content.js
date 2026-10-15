import { svjContent } from './svj-content.js';
import { batchProfiles } from './batch-content.js';

const brochure = 'https://kurumacatalog.com/wp-content/uploads/2021/01/2005_Ferrari_F430_catalog.pdf';
const archive = 'https://www.ferrari.com/en-MG/history/garage/2004/f430';
const chapters = [
  { label: '诞生背景', year: '2004 / A NEW CHAPTER', title: '从赛道，驶入新的时代。', view: 'hero', copy: '2004 年，F430 接续 360 Modena，开启法拉利中置 V8 跑车的新篇章。它把来自赛车的技术带到公路：电子差速器 E-Diff 与方向盘上的 manettino 旋钮，让驾驶者能按路况调整车辆响应。优雅的曲面之下，性能与控制方式一起迈进。', sources: [['法拉利历史档案', archive], ['原厂宣传册', brochure]] },
  { label: '设计与技术', year: 'DESIGN / ENGINEERING', title: '每一道线，都有所来。', view: 'engine', copy: '宾尼法利纳为 F430 塑造外形，椭圆前进气口呼应 1961 年的 156 F1 赛车，尾灯则带有 Enzo 的设计线索。透明后盖下是一台 4.3 升自然吸气 V8，采用平面曲轴。造型的记忆与机械的革新，在这辆车上同时可见。', sources: [['原厂宣传册 · 设计与发动机', brochure]] },
  { label: '家族延展', year: 'ONE FAMILY / MANY CHARACTERS', title: '同一血统，不同表达。', view: 'rear', copy: 'F430 的故事也延伸到不同驾驶体验：Spider 把敞篷体验带入家族，430 Scuderia 则进一步强调轻量化与赛道取向。这里以文字关系展示它们的联系，眼前保留的始终是 F430 双门硬顶车模。观察同一家族如何变化，也是收藏的乐趣。', sources: [['F430 与 Spider 原厂宣传册', brochure], ['法拉利 · 特别系列 V8', 'https://www.ferrari.com/en-GR/magazine/articles/bloodlines-special-series-V8s?amp=true']] }
];
const hotspots = [
  { id: 'intake', label: '进气系统', title: '把空气，分送给八个气缸。', copy: '空气经过滤清器与进气管进入进气系统，再由支管分配至各气缸。自然吸气发动机依靠活塞运动形成的压差吸入空气；这里可以辨认中央进气组件与成列的支管。' },
  { id: 'block', label: '缸体', title: '两列气缸，一副骨架。', copy: '缸体承载气缸与曲轴等机构。F430 的八个气缸分成两列，每列四个，夹角为 90°。切到工作原理，可以看到活塞、连杆与曲轴如何连接；外观模型仅表现壳体轮廓。' },
  { id: 'covers', label: '气缸盖罩', title: '红色盖罩之下，控制呼吸。', copy: '标志性的红色盖罩覆盖气缸盖上部。其下的配气机构控制进、排气门，让气缸在合适时刻吸入新鲜混合气、排出废气。工作原理视图将盖罩移去，以简化机构展示这个过程。' },
  { id: 'ignition', label: '点火系统', title: '一个火花，开始一次做功。', copy: '点火线圈为火花塞提供高电压，火花点燃压缩后的混合气，膨胀气体推动活塞。本模型保留线圈与线束外观；教学视图中的闪光和颜色仅说明点火与冲程，不表示真实燃烧测量。' }
];

export const vehicleProfiles = {
  f430: {
    id: 'f430', name: 'F430', capabilities: ['car', 'history', 'engine', 'lab'], engineEntryPart: 'engine_lid', eyebrow: 'THE F430 STORY', chapters, hotspots,
    family: [{ name: 'Spider', caption: '敞篷体验' }, { name: 'F430', caption: '当前硬顶车模', current: true, fromPrevious: '←' }, { name: '430 Scuderia', caption: '赛道取向' }],
    specs: '90° V8 · 4,308 cm³ · 自然吸气',
    learning: ['两列气缸各四个，夹角为 90°。活塞的往复运动经连杆传给曲轴；平面曲轴的曲拐位于同一平面。曲轴转两圈，每个气缸完成一次四冲程，凸轮轴转一圈。', '92 mm 缸径、81 mm 行程取自车型资料。连杆长度、气缸编号与点火顺序采用教学设定；配气使用简化理想时序，颜色表示工作过程。'],
    engineSources: [['参数来源', 'https://www.allcarcentral.com/Ferrari_pdf/Ferrari_f430-2009.pdf'], ['技术资料', brochure]],
    cylinderCount: 8, engineName: 'V8', module: './engine-v8.js', exportName: 'V8Engine', exteriorScale: 2.2, internalScale: 4.5, internalHeight: .92
  },
  svj: {
    ...svjContent, id: 'svj', capabilities: ['car', 'history', 'engine', 'lab'], engineEntryPart: 'engine_lid', cylinderCount: 12, engineName: 'V12', module: './engine-v12.js', exportName: 'V12Engine', exteriorScale: 2.2, internalScale: 3.6, internalHeight: .92
  },
  ...batchProfiles
};
vehicleProfiles.f430.chapters[1].parts = ['engine_lid'];
