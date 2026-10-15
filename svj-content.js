// Vehicle facts are sourced from Lamborghini's own product pages and press releases.
// Internal geometry, teaching cylinder labels and timing are deliberately schematic.
const product = 'https://www.lamborghini.com/en-en/history/aventador-svj';
const launch = 'https://www.lamborghini.com/fr-en/nouvelles/aventador-svj-unveiled-monterey-car-week';
const specification = 'https://preview.thenewsmarket.com/Previews/lamb/DocumentAssets/540422.pdf';
const roadster = 'https://www.lamborghini.com/fr-en/nouvelles/meet-aventador-svj-roadster';
const familyEnd = 'https://www.lamborghini.com/es-en/noticias/end-of-an-era-with-the-last-lamborghini-aventador';
const doors = 'https://www.lamborghini.com/jp-en/tiyanniyusu/ad-personam-aventador-svj-unique-every-detail';

export const svjContent = {
  name: 'Aventador SVJ',
  eyebrow: 'THE SVJ STORY',
  chapters: [
    {
      label: '诞生背景', year: '2018', title: '为赛道写下的 J', view: 'hero', parts: ['driver_door'],
      copy: '2018年8月，SVJ在蒙特雷汽车周首发。SV意为超级速度，J延续Jota的赛道传统。它曾以6分44.97秒完成纽博格林北环20.6公里赛段，创造当时的量产车纪录。剪刀门向上升起，迎接驾驶者进入这台V12旗舰。',
      sources: [['原厂首发报道 · 2018', launch], ['原厂剪刀门与座舱介绍', doors]],
    },
    {
      label: '设计与技术', year: 'ALA 2.0', title: '让空气参与驾驶', view: 'rear',
      copy: 'SVJ的尾翼外形固定，内部气流却可以改变。ALA 2.0通过前分流器与后部的电控襟翼，在低阻力与高下压力之间调节；左右独立的尾翼气路还能辅助弯道表现。碳纤维结构、扩散器和四轮转向共同服务于整车动态。',
      sources: [['原厂 ALA 2.0 介绍', product], ['原厂新闻稿 · 气流矢量控制', specification]],
    },
    {
      label: '家族延展', year: '2011—2022', title: '一段 V12 家族的进化', view: 'side',
      copy: 'Aventador家族始于2011年的LP 700-4。SVJ将其性能推向赛道取向，2019年又延伸出敞篷版本。最终的Ultimae结合S与SVJ的特点，伴随2022年家族停产，为这段纯燃油V12篇章收尾；下方以文字呈现这些不同车型。',
      sources: [['原厂家族回顾 · 2022', familyEnd], ['原厂 Roadster 发布 · 2019', roadster]],
    },
  ],
  hotspots: [
    {
      id: 'intake', label: '进气系统', title: '让 V12 自由呼吸',
      copy: '空气经滤盒、管道和进气歧管分送两列气缸。SVJ采用自然吸气，原厂改进了进气道并使用钛合金进气门，以提升气流表现。这里保留现有模型的稳压腔、12条支管与两侧进气组件，帮助辨认气流路径。',
    },
    {
      id: 'block', label: '缸体', title: '两列六缸，夹角 60°',
      copy: '十二个气缸分成两列，共用一根曲轴。原厂给出的缸径为95 mm、行程为76.4 mm，总排量6,498 cm³。进入内部原理，可以观察活塞往复运动经连杆转换为曲轴旋转；外部铸件仅作形态示意。',
    },
    {
      id: 'covers', label: '气缸盖罩', title: '罩盖之下的配气节奏',
      copy: '两侧气缸盖罩保护上部配气机构。SVJ每缸有四个气门，并采用电子控制的可变气门正时。教学视图把四根凸轮轴和48个气门展开，让进气、排气与活塞相位同时可见；简化开闭规律并非原车标定。',
    },
    {
      id: 'ignition', label: '点火系统', title: '十二缸依次接力',
      copy: '线圈和火花塞负责点燃压缩后的混合气，原车LIE发动机管理系统还使用离子电流分析。点选任一教学气缸，可跟随其完成四个冲程。闪光与颜色只用于讲解，缸号、示例点火顺序和点火时刻均不代表原车标定。',
    },
  ],
  family: [
    { name: 'LP 700-4', caption: '2011 · 家族开端' },
    { name: 'Aventador SVJ', caption: '2018 · 当前展车', current: true },
    { name: 'LP 780-4 Ultimae', caption: '家族收官车型' },
  ],
  specs: '60° V12 · 6,498 cm³ · 自然吸气',
  learning: [
    '两列气缸各六个，夹角60°。缸径95 mm、行程76.4 mm来自原厂资料；曲轴转两圈，每缸完成一次进气、压缩、做功、排气循环。',
    '活塞销、连杆与曲柄销连接，活塞的往复运动由此转为曲轴旋转。本教学曲轴的六个曲拐分布在三个相差120°的方向；示例十二缸每隔60°开始一次做功。',
    '教学缸号为L1–L6、R1–R6。曲拐布置、连杆长度、缸距、点火顺序、气门升程与开闭时刻均为教学假设；未核实原车曲轴及配气细节，不用于维修、生产或性能计算。',
  ],
  engineSources: [
    ['原厂参数与技术说明（第7—8页）', specification],
    ['原厂 SVJ 产品介绍', product],
  ],
  aeroModes: {
    drag: {
      title: '低阻力 · 让气流通过',
      copy: '概念图用打开的气路表示ALA降低空气阻力的工作方向：前部导流通道与尾翼内部通道改变气流，使车辆更适合加速。箭头不代表实测速度或压力。',
    },
    downforce: {
      title: '下压力 · 让尾翼工作',
      copy: '概念图关闭旁通气路，让固定尾翼呈现传统翼面的作用。实际系统按动态条件调节，为制动和高速弯道提供下压力；此处不模拟控制阈值。',
    },
    corner: {
      title: '弯道 · 分配左右气流',
      copy: '尾翼的左右气路可以独立调节，形成不同的气动负载，帮助车辆过弯。图中单侧强调仅用于说明这一原理，不对应某个固定转向指令或真实载荷比例。',
    },
  },
};
