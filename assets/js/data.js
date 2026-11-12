/* Данные сайта. Всё, что здесь, взято из проектных материалов (ООО «Омега», письма №10 и №11, квартирография).
   Меняйте цифры и тексты здесь — страница соберётся сама. */
window.ALTA = {

  /* Сцены по порядку.
     img  — кадр сцены;
     via  — видео-пролёт ИЗ предыдущей сцены В эту (файл assets/video/<via>.mp4);
     rate — скорость воспроизведения пролёта: 1 для обработанных роликов (~1,9 с),
            2.5 — если положить «сырой» 5-секундный ролик из Seedance как есть;
     back — есть ли обратный ролик <via>-back.mp4 (для движения назад).
     Если файла нет, сайт сам сделает быстрый «пролёт» по фото. */
  scenes: [
    { id: 'top',        name: 'Главная',      img: 'assets/img/aerial.jpg',   loop: 'assets/video/hero-loop.mp4' },
    { id: 'kvartal',    name: 'Квартал',      img: 'assets/img/street.jpg',   via: 'aerial-to-street',    rate: 1,   back: true },
    { id: 'genplan',    name: 'Генплан',      img: 'assets/img/facade.jpg',   via: 'street-to-facade',    rate: 1,   back: true },
    { id: 'dvor',       name: 'Дворы',        img: 'assets/img/dvor.jpg',     via: 'facade-to-dvor',      rate: 1,   back: true },
    { id: 'kvartiry',   name: 'Квартиры',     img: 'assets/img/living.jpg',   via: 'dvor-to-living',      rate: 1,   back: true },
    { id: 'holl',       name: 'Холл',         img: 'assets/img/lobby.jpg',    via: 'living-to-lobby',     rate: 1,   back: true },
    { id: 'vid',        name: 'Вид',          img: 'assets/img/balcony.jpg',  via: 'lobby-to-balcony',    rate: 2.5, back: false },
    { id: 'kommerciya', name: 'Коммерция',    img: 'assets/img/pavilion.jpg', via: 'balcony-to-pavilion', rate: 2.5, back: false },
    { id: 'company',    name: 'Компания',     img: 'assets/img/stroyka.jpg',  via: 'pavilion-to-stroyka', rate: 2.5, back: false },
    { id: 'contacts',   name: 'Контакты',     img: 'assets/img/night.jpg',    via: 'stroyka-to-night',    rate: 2.5, back: false }
  ],


  /* Прогулка по квартире: комнаты по типам. img — кадр, video — необязательный ролик (assets/rooms/*.mp4) */
  tours: (function () {
    var r = function (name, img, text) { return { name: name, img: 'assets/rooms/' + img + '.jpg', text: text }; };
    var hall = r('Прихожая', 'hall', 'Встроенный шкаф, зеркало в рост, место для обуви и верхней одежды.');
    var bath = r('Санузел', 'bath', 'Душевая или ванна, подвесная сантехника, тёплый свет.');
    var loggia = r('Лоджия', 'loggia', 'Вид на малоэтажный город и степь до самого горизонта.');
    var kitchen = r('Кухня', 'kitchen', 'Отдельная кухня с окном и местом для обеденного стола.');
    var bedroom = r('Спальня', 'bedroom', 'Тихая комната с большим окном.');
    var kids = r('Детская', 'kids', 'Светлая комната для ребёнка: кровать, стол у окна, полки.');
    var lounge = r('Гостиная', 'lounge', 'Просторная комната для всей семьи.');
    return {
      '1С': [hall, r('Студия', 'studio', 'Одно пространство: зона отдыха, кухня и место для сна.'), bath, loggia],
      '1К': [hall, kitchen, r('Комната', 'bedroom', 'Отдельная жилая комната с большим окном.'), bath, loggia],
      '2Е': [hall, r('Кухня-гостиная', 'kitchen-living', 'Кухня объединена с гостиной в одно светлое пространство.'), bedroom, bath, loggia],
      '2К': [hall, lounge, kitchen, bedroom, bath, loggia],
      '3Е': [hall, r('Кухня-гостиная', 'dining', 'Большая кухня-гостиная с обеденной зоной на шестерых.'), bedroom, kids, bath, loggia],
      '3К': [hall, lounge, kitchen, bedroom, kids, bath, loggia]
    };
  })(),

  /* Контакты для кнопок «Позвонить» и «Написать» (нижняя панель на телефоне, карточка квартиры).
     Пустые поля не показываются. Пример: phone: '+7 959 000-00-00', telegram: 'gk_alta', whatsapp: '79590000000' */
  contacts: { email: 'gk.alta.2026@mail.ru', phone: null, telegram: null, whatsapp: null },

  /* Цены для каталога квартир. Пока null — в карточках «Цена по запросу».
     Чтобы показать цены, заполните, например:
     prices: { perM2: 85000,                         // цена за м² по умолчанию, ₽
               bySection: { 1: 82000, 2: 84000 },    // или своя цена за м² по секциям
               byType: { '1С': 90000 },              // или по типам квартир
               floorStep: 300 },                     // надбавка за каждый этаж выше второго, ₽/м²  */
  prices: null,

  /* Сроки сдачи по очередям для карточки квартиры, например { 1: 'IV квартал 2027', 2: 'II квартал 2028' } */
  handover: null,

  /* Форматы квартир: площадь с учётом лоджий и балконов, м² */
  flats: [
    { code: '1С', name: 'Студия',            hint: 'кухня-гостиная и санузел',            min: 28.99, max: 31.18, count: 225 },
    { code: '1К', name: 'Однокомнатная',     hint: 'отдельная кухня',                     min: 32.87, max: 37.01, count: 930 },
    { code: '2Е', name: 'Евродвушка',        hint: 'кухня-гостиная и спальня',            min: 40.45, max: 42.17, count: 225 },
    { code: '2К', name: 'Двухкомнатная',     hint: 'две комнаты и отдельная кухня',       min: 49.99, max: 50.09, count: 375 },
    { code: '3Е', name: 'Евротрёшка',        hint: 'кухня-гостиная и две спальни',        min: 57.78, max: 69.82, count: 195 },
    { code: '3К', name: 'Трёхкомнатная',     hint: 'три комнаты и отдельная кухня',       min: 71.91, max: 74.87, count: 105 }
  ],

  /* Типы секций и их планы */
  sectionTypes: [
    { id: 1, label: 'Тип 1', sections: '1, 5, 6',      perFloor: 13, mix: '5 однокомнатных, 2 студии, 1 евродвушка, 3 двухкомнатные, 2 трёхкомнатные' },
    { id: 2, label: 'Тип 2', sections: '7, 9, 10, 11', perFloor: 13, mix: '6 однокомнатных, 1 студия, 2 евродвушки, 2 двухкомнатные, 2 евротрёшки' },
    { id: 3, label: 'Тип 3', sections: '2',            perFloor: 13, mix: '5 однокомнатных, 2 студии, 1 евродвушка, 2 двухкомнатные, 2 евротрёшки, 1 трёхкомнатная' },
    { id: 4, label: 'Тип 4', sections: '3, 4, 8',      perFloor: 11, mix: '6 однокомнатных, 1 студия, 1 евродвушка, 2 двухкомнатные, 1 евротрёшка' }
  ],

  /* Секции и отдельные здания. parts: [центр X, центр Y, длина, ширина, поворот°] на схеме генплана (1987×1404). */
  buildings: [
    { id: 1,  kind: 'home', type: '1',   st: 1, phase: 1, flats: 195, perFloor: 13, living: 8584.5,  retail: 623.13, parts: [[610, 595, 90, 290, 0]] },
    { id: 2,  kind: 'home', type: '3',   st: 3, phase: 1, flats: 195, perFloor: 13, living: 8613,    retail: 626.4,  parts: [[612, 322, 95, 255, 0], [677, 229, 35, 68, 0]] },
    { id: 3,  kind: 'home', type: '4',   st: 4, phase: 1, flats: 165, perFloor: 11, living: 6836.85, retail: 469.4,  parts: [[810, 234, 230, 88, 0]] },
    { id: 4,  kind: 'home', type: '4.1', st: 4, phase: 1, flats: 165, perFloor: 11, living: 6836.85, retail: 469.4,  parts: [[1040, 236, 230, 83, 0]] },
    { id: 5,  kind: 'home', type: '1.1', st: 1, phase: 2, flats: 195, perFloor: 13, living: 8584.5,  retail: 623.13, parts: [[1002, 872, 290, 90, 24]] },
    { id: 6,  kind: 'home', type: '1',   st: 1, phase: 2, flats: 195, perFloor: 13, living: 8584.5,  retail: 623.13, parts: [[1270, 985, 290, 90, 24]] },
    { id: 7,  kind: 'home', type: '2.1', st: 2, phase: 3, flats: 195, perFloor: 13, living: 8531.55, retail: 622.7,  parts: [[1155, 492, 270, 100, 0]] },
    { id: 8,  kind: 'home', type: '4',   st: 4, phase: 3, flats: 165, perFloor: 11, living: 6836.85, retail: 469.4,  parts: [[1406, 496, 232, 88, 0]] },
    { id: 9,  kind: 'home', type: '2',   st: 2, phase: 3, flats: 195, perFloor: 13, living: 8531.55, retail: 622.7,  parts: [[1656, 497, 268, 100, 0]] },
    { id: 10, kind: 'home', type: '2.1', st: 2, phase: 4, flats: 195, perFloor: 13, living: 8531.55, retail: 622.7,  parts: [[1735, 775, 98, 270, 0]] },
    { id: 11, kind: 'home', type: '2',   st: 2, phase: 4, flats: 195, perFloor: 13, living: 8531.55, retail: 622.7,  parts: [[1730, 1045, 100, 270, 0]] },
    { id: 12, kind: 'shop', phase: 2, floors: 2, retail: 532,  parts: [[805, 775, 84, 94, 24]] },
    { id: 13, kind: 'shop', phase: 2, floors: 2, retail: 532,  parts: [[1467, 1050, 80, 92, 24]] },
    { id: 14, kind: 'shop', phase: 3, floors: 2, retail: 2400, parts: [[1655, 258, 290, 122, 0]] }
  ],

  /* Сводная таблица коммерческих помещений (письмо №11) */
  retail: [
    { name: 'Встроенные помещения в секциях 1–4',   phase: 'I',   floors: 1, area: 2186 },
    { name: 'Встроенные помещения в секциях 5–6',   phase: 'II',  floors: 1, area: 1246 },
    { name: 'Отдельное здание № 12',                phase: 'II',  floors: 2, area: 532 },
    { name: 'Отдельное здание № 13',                phase: 'II',  floors: 2, area: 532 },
    { name: 'Встроенные помещения в секциях 7–9',   phase: 'III', floors: 1, area: 1710 },
    { name: 'Отдельное здание № 14',                phase: 'III', floors: 2, area: 2400 },
    { name: 'Встроенные помещения в секциях 10–11', phase: 'IV',  floors: 1, area: 1244 }
  ],

  /* Компании группы. Добавьте остальные компании ГК Альта по образцу. */
  companies: [
    { name: 'ООО СЗ «АЛЬТА»', role: 'Застройщик', text: 'Специализированный застройщик жилого комплекса в Краснодоне. Луганск, квартал Еременко, 7.' }
  ]
};
