/* Static data: default wheel config, color themes, sound lists, gallery templates. */
(function () {
  'use strict';

  var DEFAULT_ENTRIES = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Khoa', 'Linh'];
  var DEFAULT_COLORS = ['#5DADE2', '#82E0AA', '#F7DC6F', '#AF7AC5'];
  var PALETTE_SLOTS = 6;
  var NO_COLOR = '#CCCCCC'; // used when every palette slot is unchecked

  // Same field names as the common .wheel format, so files can be exchanged with other wheel apps.
  function defaultConfig() {
    return {
      title: '',
      description: '',
      entries: DEFAULT_ENTRIES.map(function (t) { return { text: t }; }),
      colorSettings: colorSettingsFrom(DEFAULT_COLORS),
      spinTime: 10,
      slowSpin: false,
      maxNames: 1000,
      allowDuplicates: true,
      showTitle: true,
      isAdvanced: false,
      duringSpinSound: 'ticking-sound',
      duringSpinSoundVolume: 50,
      afterSpinSound: 'applause-sound-soft',
      afterSpinSoundVolume: 50,
      displayWinnerDialog: true,
      winnerMessage: '',
      displayRemoveButton: true,
      displayHideButton: true,
      autoRemoveWinner: false,
      launchConfetti: true,
      animateWinner: false,
      playClickWhenWinnerRemoved: false,
      type: 'color',              // color | image (wheel background image)
      hubSize: 'S',               // XS S M L XL XXL
      pictureType: 'none',        // none | gallery | uploaded | text (center image source)
      galleryPicture: '',
      customPictureName: '',
      customPictureDataUri: '',
      centerText: '',
      coverImageType: '',         // gallery | uploaded
      coverImageName: '',
      customCoverImageDataUri: '',
      drawOutlines: false,
      drawShadow: true,
      pointerChangesColor: true,
      hideEntryText: 'never',     // never | always | on-image
      pageBackgroundColor: '#FFFFFF',
      pageGradient: true,
      font: ''
    };
  }

  function colorSettingsFrom(colors) {
    var out = colors.slice(0, PALETTE_SLOTS).map(function (c) { return { color: c.toUpperCase(), enabled: true }; });
    while (out.length < PALETTE_SLOTS) out.push({ color: '#000000', enabled: false });
    return out;
  }

  var HUB_SIZES = { XS: 0.01, S: 0.2, M: 0.3, L: 0.4, XL: 0.5, XXL: 0.6 };

  var THEMES = [
    { group: "General", themes: [
      ["Default", DEFAULT_COLORS],
      ["Classic", ['#3369E8', '#D50F25', '#EEB211', '#009925']],
      ["The world stands with Ukraine", ['#0057B8', '#FFD700']]
    ] },
    { group: 'Bản sắc Việt', themes: [
      ['Xoay Vần', ['#D9432F', '#F4B23E', '#1F7A6A', '#F5E6C8', '#2E3A6E']],
      ['Sơn mài', ['#8E1B12', '#C8962E', '#1A1210', '#E8C77A', '#5B2A16']],
      ['Tết', ['#D7261E', '#F7C531', '#FDE9B5', '#B31217', '#F59E1B']],
      ['Hội An', ['#F2A33A', '#E2572C', '#F7D774', '#2F6E73', '#A63A2B', '#F5E3B8']],
      ['Hạ Long', ['#0E5E6F', '#3AA0A8', '#A8DADC', '#F1FAEE', '#457B9D']],
      ['Sen hồng', ['#F4A6B8', '#E86A8E', '#FBE3E8', '#7FB069', '#3E6B48']],
      ['Áo dài', ['#B5172F', '#F0E1C6', '#1F3B73', '#E9B44C', '#7A1C4B']],
      ['Cà phê sữa', ['#3B2416', '#6F4E37', '#A67B5B', '#D9BFA0', '#F3E5D0']],
      ['Lúa chín', ['#E8C547', '#C9A227', '#7FA043', '#4E7D32', '#F2E3A1']],
      ['Gốm Bát Tràng', ['#1E3F8A', '#F4F1E8', '#3E64B5', '#DCE3F0', '#16295C']],
      ['Trung thu', ['#F28C28', '#FFD166', '#C0392B', '#2C3E66', '#FFF1C1']],
      ['Tranh Đông Hồ', ['#C0392B', '#E8B04B', '#2E7D5B', '#1D3557', '#F1E4C9']]
    ] },
    { group: "Bright & Playful", themes: [
      ["Rainbow", ['#5E02E9', '#3C70EF', '#30D800', '#E7E200', '#FD8B00', '#F20800']],
      ["Unicorn", ['#891180', '#EA27A2', '#FB9390', '#F6C892', '#FFF5BD', '#FDFFDE']],
      ["Circus", ['#01A7EC', '#FFFF46', '#FFC94B', '#FE8F5D', '#FE47B3', '#80DA65']],
      ["Fruit Salad", ['#E9692C', '#ED9121', '#FFC324', '#FFF000', '#66B447', '#8EE53F']],
      ["Building Blocks", ['#3BAED5', '#5CC8E2', '#FDE683', '#E66C1E', '#D52210']],
      ["Splash", ['#0198F1', '#49C2FF', '#A9EEFF', '#0067D4', '#E999DE', '#7C62C4']],
      ["Retro Pop", ['#F1647A', '#F3F1DB', '#74CBCC', '#27ABB2', '#C1D765', '#80C544']],
      ["Playground", ['#3B9FF8', '#9CBF37', '#FFAF4D', '#FF5378']],
      ["Picnic", ['#F99825', '#F5C527', '#CFFA6B', '#9EEC1C', '#89DF42', '#75CB00']],
      ["Sugar Rush", ['#C75589', '#E369A4', '#F5CC22', '#F6EF2D', '#B2E792', '#82D07B']],
      ["Popsicle", ['#76A8E1', '#59DCA2', '#FEE151', '#FE7A63']]
    ] },
    { group: "Soft & Aesthetic", themes: [
      ["Cotton Candy", ['#BCDCEB', '#F7F296', '#B7EDBB', '#F6C2D8']],
      ["Marshmallow", ['#94DE8B', '#B19CD9', '#F4A8CF', '#F4C3D7', '#FDFD96', '#B6E7B9']],
      ["Lilac Dreams", ['#E0BBE4', '#957DAD', '#D291BC', '#FEC8D8', '#FFDFD3']],
      ["Blush & Peach", ['#C09BE3', '#F6E0C7', '#F0C589', '#EA9A5D', '#EA6D63', '#E33F64']],
      ["Seaside", ['#9FE2BF', '#FFE5C6', '#EFCDB4', '#4BC7CF', '#5CF5FF']],
      ["Soft Sage", ['#C3D4C1', '#FFFFE5', '#B4D2A4', '#95BC83', '#F6EAD3']],
      ["Rose Petal", ['#E25157', '#F5808F', '#FFACCC', '#FFCBDF', '#EBF0EA', '#93C64E']],
      ["Enchanted forest", ['#8D8DCC', '#ABDEDE', '#679980', '#D6B2D6']],
      ["Daydream", ['#F4D3C4', '#F2AEBB', '#D895DA', '#A091D6', '#696FC7', '#A7AAE1']],
      ["Mint Lemonade", ['#84A013', '#A8BB2E', '#D4DA5E', '#EBEF90', '#FBFDBC', '#FAC703']],
      ["Pajama Party", ['#278DF0', '#FFEF93', '#FF96E1', '#9B78FC']]
    ] },
    { group: "Professional & Clean", themes: [
      ["Office hours", ['#DE7373', '#F0DC9F', '#DEBB89', '#7787AE', '#43487B']],
      ["Information Blues", ['#90B0AB', '#CBCAC0', '#DEDAD6', '#5F729A']],
      ["Ice & Slate", ['#2377A4', '#50A3C6', '#79C0D7', '#F8F8F8', '#DDDFDF', '#C2C2C2']],
      ["Moon", ['#31302E', '#94908D', '#DAD9D7', '#F0F0F0', '#C3C2BE']],
      ["Modern Muted", ['#9DC3CA', '#B7D4C6', '#EFECE1', '#EDD5C8', '#F2C0C5']],
      ["Deep Dive", ['#010101', '#011926', '#003E5C', '#016293', '#007BB8']],
      ["Architect", ['#775E56', '#E4E1AF', '#FF9263', '#FF6455', '#7C687D']],
      ["Clean Aqua", ['#00FEEF', '#09EBEE', '#19CEEB', '#28ACEA', '#388EE9', '#3D76E0']]
    ] },
    { group: "Nature & Earth", themes: [
      ["Jungle", ['#135E46', '#478966', '#73A788', '#E3C6AD', '#D09D7B', '#B67B65']],
      ["Autumn Foliage", ['#BA4634', '#D85C4E', '#EAA250', '#F5DD8B', '#CEC218', '#5F7818']],
      ["Woodland", ['#A05A48', '#563633', '#6D463C', '#D6BD9D', '#D19E6D', '#C57D56']],
      ["Savanna", ['#F0ECE1', '#EDCF8F', '#C97F4E', '#6F4A38', '#977359']],
      ["Canyon", ['#99857A', '#C67B5C', '#E27B58', '#FF9D6F', '#663926', '#8E6A5A']],
      ["Succulent Garden", ['#85A18C', '#F6FDDF', '#FFECCD', '#F2B783']],
      ["Pond Life", ['#448036', '#5C9550', '#FBBA37', '#EE6BA4', '#F192B5', '#F4B0C7']],
      ["Koi fish", ['#F16323', '#F2F3F4', '#FFD021', '#E34427']],
      ["Rainforest", ['#01A8CA', '#32D1EC', '#F1F1F1', '#AFDFF3']],
      ["Oasis", ['#FAD381', '#D79F62', '#2E4647', '#518D6A', '#9BC692']],
      ["Deep Sea", ['#4F42B5', '#82E1E3', '#D4F1F9', '#E3FFFA', '#4CC395']],
      ["Moss & Fern", ['#529106', '#61A307', '#86B71B', '#B9BD00', '#8EA202', '#799203']]
    ] },
    { group: "Dark & Dramatic", themes: [
      ["Midnight", ['#001F38', '#526079', '#9A7E8E', '#E3757F', '#FD997F', '#FFD0AA']],
      ["Neon Nights", ['#FFBAFF', '#DE87FF', '#A455FF', '#681DFF', '#1000CA', '#000098']],
      ["Deep Forest", ['#383159', '#656DA6', '#C5E1F2', '#52734F']],
      ["Galactic", ['#b7b8f9', '#3a1f8a', '#2c1357', '#462867', '#593b6a']],
      ["Urban Ops", ['#7C7C7C', '#0E1317', '#ACDEF8', '#344A78', '#FDFAFC', '#D6D6D6']],
      ["Abyss", ['#3EA1B6', '#0E6B8C', '#133855', '#6B669E', '#BB90C8', '#EFD8EC']],
      ["Fire & Ice", ['#3C8BEC', '#7EBEF6', '#FED8B1', '#F88102', '#F95701']]
    ] },
    { group: "Warm & Sunny", themes: [
      ["Sunshine", ['#FFFFFF', '#FFE484', '#FFCC33', '#FC9601', '#D14009']],
      ["Heatwave", ['#BF221C', '#E8681F', '#FBC44F', '#FFE67F', '#FDFFD2', '#F9F500']],
      ["Solstice", ['#761000', '#C10900', '#E92100', '#FFDB53', '#FFA93D', '#FF7A29']],
      ["Golden Hour", ['#DC7C00', '#FF9705', '#FEB20A', '#FFCB00', '#FEDF05']],
      ["Sorbet", ['#3C47C6', '#656CDE', '#DE6CC8', '#F8A091', '#F7E392', '#F7A55D']]
    ] },
    { group: "Seasonal", themes: [
      ["Valentine's Day", ['#FF0000', '#FF69B4', '#FFFFFF', '#FFC0CB']],
      ["Saint Patrick's Day", ['#009A49', '#FFFFFF', '#FF8200', '#FFD700']],
      ["Easter", ['#FFB7B2', '#FFF2CC', '#B9F6CA', '#E6E6FA']],
      ["Earth Day", ['#0077BE', '#228B22', '#FFFFFF', '#8B4513']],
      ["Summer Vibes", ['#FFD700', '#40E0D0', '#FF00FF', '#FFA500']],
      ["Halloween", ['#FF7518', '#000000', '#800080', '#7FFF00']],
      ["Thanksgiving", ['#CC5500', '#8B4513', '#990000', '#DAA520']],
      ["Winter Wonderland", ['#001F3F', '#FFFFFF', '#A5F2F3', '#C0C0C0']],
      ["Christmas", ['#228B22', '#FF0000', '#FFD700', '#FFFFFF']],
      ["Hanukkah", ['#4169E1', '#FFFFFF', '#C0C0C0', '#ADD8E6']],
      ["New Year", ['#000000', '#F1C40F', '#ECF0F1']]
    ] },
    { group: "Pride", themes: [
      ["Classic Rainbow", ['#D12229', '#F68A1E', '#FDE01A', '#007940', '#24408E', '#732982']],
      ["Aromantic", ['#3BA740', '#A8D47A', '#FFFFFF', '#ABABAB', '#000000']],
      ["Asexual", ['#000000', '#A4A4A4', '#FFFFFF', '#810081']],
      ["Bisexual", ['#D60270', '#9B4F96', '#0038A8']],
      ["Demisexual", ['#000000', '#FFFFFF', '#6E0071', '#D3D3D3']],
      ["Gay", ['#078D70', '#98E8C1', '#FFFFFF', '#7BADE2', '#3D1A78']],
      ["Lesbian", ['#D62800', '#FF9B56', '#FFFFFF', '#D462A6', '#A40062']],
      ["Pansexual", ['#FF1C8D', '#FFD700', '#1AB3FF']],
      ["Agender", ['#000000', '#BABABA', '#FFFFFF', '#BAF484']],
      ["Genderfluid", ['#FE76A2', '#FFFFFF', '#BF12D7', '#000000', '#303CBE']],
      ["Genderqueer", ['#B57FDD', '#FFFFFF', '#49821E']],
      ["Intersex", ['#7902AA', '#FFD800']],
      ["Non-binary", ['#FcF431', '#FCFCFC', '#9D59D2', '#282828']],
      ["Transgender", ['#5BCFFB', '#F5ABB9', '#FFFFFF', '#F5ABB9']]
    ] }
  ];

  // During-spin sounds. Everything is synthesized in js/audio.js (no audio files).
  // value: [label, kind] — kind 'tick' plays per slice, 'loop' loops until the spin ends.
  var DURING_SOUNDS = [
    { group: 'Hiệu ứng âm thanh', items: [
      ['ticking-sound', 'Tiếng tích tắc'], ['random-music', 'Nhạc ngẫu nhiên'], ['drum-roll', 'Hồi trống'],
      ['microwave-oven', 'Lò vi sóng'], ['no-sound', 'Không có âm thanh']
    ] },
    { group: '8-Bit', items: [
      ['chip-adventure', 'Phiêu lưu'], ['chip-bounce', 'Nhảy nhót'], ['chip-race', 'Đường đua'], ['random: 8-Bit', 'Nhạc 8-bit ngẫu nhiên']
    ] },
    { group: 'Nhạc nhẹ', items: [
      ['music-box', 'Hộp nhạc'], ['easy-keys', 'Phím đàn thư thái'], ['random: Nhạc nhẹ', 'Nhạc nhẹ ngẫu nhiên']
    ] },
    { group: 'Nhạc điện ảnh', items: [
      ['suspense', 'Hồi hộp'], ['war-drums', 'Trống trận'], ['random: Nhạc điện ảnh', 'Nhạc điện ảnh ngẫu nhiên']
    ] }
  ];

  var AFTER_SOUNDS = [
    ['no-sound', 'Không có âm thanh'], ['random-sound', 'Âm thanh ngẫu nhiên'],
    ['applause-sound-soft', 'Tiếng vỗ tay nhỏ'], ['joke-punchline', 'Đoạn kết câu chuyện cười'],
    ['announcement-bell-sound', 'Chuông thông báo'], ['twinkling-star-sound', 'Tiếng sao lấp lánh'],
    ['correct-answer-ding-sound', 'Tiếng chuông trả lời đúng'], ['synth-bell-sound', 'Chuông Synth'],
    ['applause-sound', 'Tiếng vỗ tay vang dội'], ['fanfare-sound', 'Nhạc kèn khai hội'], ['bell-sound', 'Chuông reo'],
    ['cymbal-sound', 'Chũm chọe'], ['thunder', 'Sấm sét'], ['cash-register', 'Máy tính tiền'],
    ['microwave-ding-sound', 'Tiếng chuông lò vi sóng'], ['old-phone-sound', 'Chuông điện thoại cũ'],
    ['alarm-clock-sound', 'Đồng hồ báo thức'], ['fireworks-sound', 'Bắn pháo hoa'], ['game-win-ding', 'Tiếng chuông chiến thắng'],
    ['wrong-answer', 'Câu trả lời sai'], ['punch', 'Cú đấm'], ['sad-trombone', 'Kèn trombone buồn'],
    ['cinematic-drum-impact', 'Tiếng trống điện ảnh'], ['gong', 'Cồng chiêng'], ['doorbell', 'Chuông cửa'],
    ['church-bell', 'Chuông nhà thờ'], ['referee-whistle', 'Còi trọng tài'], ['boing', 'Boing'],
    ['angel-choir', 'Dàn hợp xướng thiên thần'], ['harp-strum', 'Tiếng gảy đàn hạc'],
    ['camera-shutter-flash', 'Màn trập máy ảnh & đèn flash'], ['lost-game', 'Thua cuộc'],
    ['read-winner-sound', 'Đọc to kết quả (Giọng 1)'], ['read-winner-sound-2', 'Đọc to kết quả (Giọng 2)']
  ];

  // Wheel fonts (Google Fonts, all with Vietnamese glyphs): [family, canvas weight, css2 query or null if preloaded].
  var WHEEL_FONTS = [
    ['', '400', null], ['Be Vietnam Pro', '600', null], ['Fraunces', '600', 'Fraunces:wght@600'], ['Baloo 2', '600', 'Baloo+2:wght@600'], ['Montserrat', '700', 'Montserrat:wght@700'],
    ['Comfortaa', '700', 'Comfortaa:wght@700'], ['Playfair Display', '700', 'Playfair+Display:wght@700'], ['Patrick Hand', '400', 'Patrick+Hand'],
    ['Pangolin', '400', 'Pangolin'], ['Itim', '400', 'Itim'], ['Dancing Script', '700', 'Dancing+Script:wght@700'],
    ['Lobster', '400', 'Lobster'], ['Pacifico', '400', 'Pacifico'], ['Bangers', '400', 'Bangers']
  ];

  var TEXT_DISPLAY = [['never', 'Luôn hiển thị văn bản trên bánh xe'], ['always', 'Luôn ẩn văn bản trên bánh xe'], ['on-image', 'Ẩn văn bản nếu có hình ảnh']];

  // Built-in wheel background pictures, drawn procedurally by js/app.js (no image files).
  var COVER_PICTURES = [
    ['cookie', 'Bánh quy sô-cô-la'], ['rainbow', 'Cầu vồng'], ['night-sky', 'Bầu trời đêm'], ['wood', 'Gỗ'],
    ['marble', 'Đá cẩm thạch'], ['citrus', 'Lát cam'], ['pool', 'Nước hồ bơi'], ['candy', 'Kẹo xoắn']
  ];

  // "Bộ sưu tập": built-in example wheels.
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(String(i)); return r; }
  var GALLERY = [
    { id: 'lixi', title: 'Lì xì đầu năm', desc: 'Bốc lì xì may mắn ngày Tết', entries: ['10.000đ', '20.000đ', '50.000đ', '100.000đ', '200.000đ', '500.000đ', 'Lời chúc', 'Thêm lượt'], theme: 'Tết' },
    { id: 'icebreak', title: 'Câu hỏi làm quen', desc: 'Khởi động buổi họp hoặc lớp học', entries: ['Món ăn yêu thích', 'Nơi muốn đến', 'Phim gần đây', 'Sở thích bí mật', 'Kỷ niệm đáng nhớ', 'Siêu năng lực', 'Bài hát ruột', 'Ước mơ hồi nhỏ'], theme: 'Hội An' },
    { id: 'punish', title: 'Hình phạt vui', desc: 'Dành cho người thua trò chơi', entries: ['Hát một bài', 'Nhảy 30 giây', 'Kể chuyện cười', 'Chống đẩy 10 cái', 'Gọi điện cho mẹ', 'Bắt chước con vật', 'Khen từng người', 'Được miễn!'], theme: 'Circus' },
    { id: 'subjects', title: 'Môn học', desc: 'Hôm nay ôn môn nào trước?', entries: ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý'], theme: 'Gốm Bát Tràng' },
    { id: 'weekend', title: 'Cuối tuần đi đâu?', desc: 'Kế hoạch cho hai ngày nghỉ', entries: ['Cà phê sách', 'Leo núi', 'Xem phim', 'Đi biển', 'Về quê', 'Nấu ăn ở nhà', 'Đi chợ đêm', 'Ngủ nướng'], theme: 'Hạ Long' },
    { id: 'yes-no', title: 'Có hay không?', desc: 'Câu trả lời nhanh cho mọi câu hỏi', entries: ['Có', 'Không'], theme: 'Classic' },
    { id: 'coin', title: 'Tung đồng xu', desc: 'Sấp hay ngửa', entries: ['Sấp', 'Ngửa'], colors: ['#F7DC6F', '#AAB7B8'] },
    { id: 'dice', title: 'Xúc xắc', desc: 'Gieo một con xúc xắc 6 mặt', entries: range(1, 6), theme: 'Playground' },
    { id: 'num-10', title: 'Số từ 1 đến 10', desc: 'Chọn một số ngẫu nhiên', entries: range(1, 10) },
    { id: 'num-100', title: 'Số từ 1 đến 100', desc: 'Quay số ngẫu nhiên từ 1 đến 100', entries: range(1, 100), theme: 'Rainbow' },
    { id: 'letters', title: 'Chữ cái A–Z', desc: 'Chọn một chữ cái', entries: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
    { id: 'food', title: 'Hôm nay ăn gì?', desc: 'Các món Việt quen thuộc', entries: ['Phở', 'Bánh mì', 'Bún chả', 'Cơm tấm', 'Bún bò Huế', 'Gỏi cuốn', 'Bánh xèo', 'Hủ tiếu', 'Mì Quảng', 'Cao lầu', 'Bún riêu', 'Xôi'], theme: 'Fruit Salad' },
    { id: 'drinks', title: 'Uống gì đây?', desc: 'Cà phê, trà sữa hay nước ép', entries: ['Cà phê sữa đá', 'Trà sữa', 'Nước ép cam', 'Sinh tố bơ', 'Trà đào', 'Nước dừa', 'Bạc xỉu', 'Trà chanh'], theme: 'Sorbet' },
    { id: 'truth-dare', title: 'Thật hay Thách', desc: 'Trò chơi cho buổi tụ tập', entries: ['Thật', 'Thách'], colors: ['#5DADE2', '#EC7063'] },
    { id: 'rps', title: 'Oẳn tù tì', desc: 'Búa, bao hay kéo', entries: ['Búa', 'Bao', 'Kéo'] },
    { id: 'zodiac', title: '12 con giáp', desc: 'Tý, Sửu, Dần, Mão…', entries: ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'], theme: 'Golden Hour' },
    { id: 'signs', title: 'Cung hoàng đạo', desc: 'Bạch Dương đến Song Ngư', entries: ['Bạch Dương', 'Kim Ngưu', 'Song Tử', 'Cự Giải', 'Sư Tử', 'Xử Nữ', 'Thiên Bình', 'Bọ Cạp', 'Nhân Mã', 'Ma Kết', 'Bảo Bình', 'Song Ngư'], theme: 'Galactic' },
    { id: 'days', title: 'Ngày trong tuần', desc: 'Thứ Hai đến Chủ Nhật', entries: ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'] },
    { id: 'months', title: 'Các tháng trong năm', desc: 'Tháng 1 đến tháng 12', entries: range(1, 12).map(function (n) { return 'Tháng ' + n; }), theme: 'Autumn Foliage' },
    { id: 'prizes', title: 'Vòng quay giải thưởng', desc: 'Dùng cho minigame, khuyến mãi', entries: ['Giảm 10%', 'Giảm 20%', 'Miễn phí vận chuyển', 'Chúc may mắn lần sau', 'Thẻ quà tặng', 'Tặng 1 món', 'Giảm 5%', 'Quà bí ẩn'], theme: 'Circus' },
    { id: 'chores', title: 'Việc nhà', desc: 'Ai làm việc gì hôm nay?', entries: ['Rửa bát', 'Giặt đồ', 'Hút bụi', 'Đổ rác', 'Tưới cây', 'Nấu cơm'], theme: 'Soft Sage' },
    { id: 'movies', title: 'Xem phim gì?', desc: 'Chọn thể loại phim', entries: ['Hành động', 'Hài', 'Kinh dị', 'Lãng mạn', 'Khoa học viễn tưởng', 'Hoạt hình', 'Tài liệu', 'Giật gân'], theme: 'Neon Nights' },
    { id: 'teams', title: 'Chia đội', desc: 'Bốn đội màu', entries: ['Đội Đỏ', 'Đội Xanh', 'Đội Vàng', 'Đội Lục'], colors: ['#E74C3C', '#3498DB', '#F4D03F', '#2ECC71'] },
    { id: 'workout', title: 'Bài tập hôm nay', desc: 'Thử thách thể dục', entries: ['20 cái chống đẩy', '30 cái squat', 'Plank 1 phút', '40 cái bật nhảy', '20 cái lunge', '15 cái burpee', 'Nghỉ', '50 lần nâng cao đùi'], theme: 'Heatwave' },
    { id: 'colors', title: 'Màu sắc', desc: 'Bảy màu cầu vồng', entries: ['Đỏ', 'Cam', 'Vàng', 'Lục', 'Lam', 'Chàm', 'Tím'], colors: ['#E74C3C', '#F39C12', '#F4D03F', '#2ECC71', '#3498DB', '#3F51B5', '#9B59B6'] },
    { id: 'directions', title: 'Đi hướng nào?', desc: 'Bắc, Nam, Đông, Tây', entries: ['Bắc', 'Đông', 'Nam', 'Tây'] },
    { id: 'asean', title: 'Quốc gia Đông Nam Á', desc: '11 quốc gia ASEAN và Đông Timor', entries: ['Việt Nam', 'Lào', 'Campuchia', 'Thái Lan', 'Myanmar', 'Malaysia', 'Singapore', 'Indonesia', 'Philippines', 'Brunei', 'Đông Timor'], theme: 'Jungle' }
  ];

  window.DATA = {
    DEFAULT_ENTRIES: DEFAULT_ENTRIES,
    DEFAULT_COLORS: DEFAULT_COLORS,
    PALETTE_SLOTS: PALETTE_SLOTS,
    NO_COLOR: NO_COLOR,
    HUB_SIZES: HUB_SIZES,
    MAX_WHEELS: 10,
    defaultConfig: defaultConfig,
    colorSettingsFrom: colorSettingsFrom,
    THEMES: THEMES,
    DURING_SOUNDS: DURING_SOUNDS,
    AFTER_SOUNDS: AFTER_SOUNDS,
    TEXT_DISPLAY: TEXT_DISPLAY,
    WHEEL_FONTS: WHEEL_FONTS,
    COVER_PICTURES: COVER_PICTURES,
    GALLERY: GALLERY
  };
})();
