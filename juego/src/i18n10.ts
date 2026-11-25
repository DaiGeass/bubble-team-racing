import type { Lang, Dict } from "./i18n";

/** The internet-aesthetic circuits, the songs that come with the game and the rhythm grades. */
export const CORE_WORDS: Record<Lang, Dict> = {
  en: {
    trk_noclip: "Noclip: The Levels", trk_rarocore: "Glitch Eyes", trk_juguetes: "The Toy Box", trk_peluche: "Neon Plush", trk_frutigertour: "Frutiger Tour",
    rhythmSongbook: "Songs of the game", rhythmMaking: "Composing...", rhythmPreview: "Listen", rhythmStop: "Stop",
    rhythmBeatHelp: "Drift, land, pass and take notes on the beat: perfect moves give a boost and build a combo.",
    beatPerfect: "PERFECT", beatGood: "GOOD", beatOff: "OFF BEAT", beatCombo: "Combo", beatScore: "Rhythm", beatBest: "Best combo",
  },
  es: {
    trk_noclip: "Noclip: los Niveles", trk_rarocore: "Ojos del Glitch", trk_juguetes: "La Caja de Juguetes", trk_peluche: "Peluche de Neón", trk_frutigertour: "Gira Frutiger",
    rhythmSongbook: "Canciones del juego", rhythmMaking: "Componiendo...", rhythmPreview: "Escuchar", rhythmStop: "Parar",
    rhythmBeatHelp: "Derrapa, aterriza, adelanta y coge notas al compás: los movimientos perfectos dan turbo y suman combo.",
    beatPerfect: "¡PERFECTO!", beatGood: "BIEN", beatOff: "FUERA DE RITMO", beatCombo: "Combo", beatScore: "Ritmo", beatBest: "Mejor combo",
  },
  fr: {
    trk_noclip: "Noclip : les Niveaux", trk_rarocore: "Yeux du Glitch", trk_juguetes: "Le Coffre à Jouets", trk_peluche: "Peluche Néon", trk_frutigertour: "Tournée Frutiger",
    rhythmSongbook: "Chansons du jeu", rhythmMaking: "Composition...", rhythmPreview: "Écouter", rhythmStop: "Arrêter",
    rhythmBeatHelp: "Dérapez, atterrissez, doublez et prenez les notes en rythme : les gestes parfaits donnent un turbo et un combo.",
    beatPerfect: "PARFAIT", beatGood: "BIEN", beatOff: "HORS RYTHME", beatCombo: "Combo", beatScore: "Rythme", beatBest: "Meilleur combo",
  },
  ru: {
    trk_noclip: "Ноуклип: Уровни", trk_rarocore: "Глаза глитча", trk_juguetes: "Ящик с игрушками", trk_peluche: "Неоновый плюш", trk_frutigertour: "Тур Frutiger",
    rhythmSongbook: "Песни игры", rhythmMaking: "Сочиняем...", rhythmPreview: "Слушать", rhythmStop: "Стоп",
    rhythmBeatHelp: "Дрифт, приземление, обгон и ноты в такт: идеальные приёмы дают ускорение и комбо.",
    beatPerfect: "ИДЕАЛЬНО", beatGood: "ХОРОШО", beatOff: "НЕ В ТАКТ", beatCombo: "Комбо", beatScore: "Ритм", beatBest: "Лучшее комбо",
  },
  ja: {
    trk_noclip: "ノークリップ：レベル", trk_rarocore: "グリッチの目", trk_juguetes: "おもちゃ箱", trk_peluche: "ネオンぬいぐるみ", trk_frutigertour: "フルティガーツアー",
    rhythmSongbook: "ゲームの曲", rhythmMaking: "作曲中...", rhythmPreview: "試聴", rhythmStop: "停止",
    rhythmBeatHelp: "ビートに合わせてドリフト、着地、追い抜き、ノート取り：パーフェクトでブーストとコンボ。",
    beatPerfect: "パーフェクト", beatGood: "グッド", beatOff: "ズレ", beatCombo: "コンボ", beatScore: "リズム", beatBest: "最高コンボ",
  },
  zh: {
    trk_noclip: "穿墙：层级", trk_rarocore: "故障之眼", trk_juguetes: "玩具箱", trk_peluche: "霓虹毛绒", trk_frutigertour: "Frutiger 巡游",
    rhythmSongbook: "游戏歌曲", rhythmMaking: "作曲中...", rhythmPreview: "试听", rhythmStop: "停止",
    rhythmBeatHelp: "踩着节拍漂移、落地、超车和收集音符：完美动作带来加速和连击。",
    beatPerfect: "完美", beatGood: "不错", beatOff: "失拍", beatCombo: "连击", beatScore: "节奏", beatBest: "最高连击",
  },
  ar: {
    trk_noclip: "نوكليب: المستويات", trk_rarocore: "عيون الخلل", trk_juguetes: "صندوق الألعاب", trk_peluche: "دمية النيون", trk_frutigertour: "جولة فروتيغر",
    rhythmSongbook: "أغاني اللعبة", rhythmMaking: "جارٍ التلحين...", rhythmPreview: "استمع", rhythmStop: "إيقاف",
    rhythmBeatHelp: "انجرف واهبط وتجاوز والتقط النوتات على الإيقاع: الحركات المثالية تمنح دفعة وسلسلة.",
    beatPerfect: "مثالي", beatGood: "جيد", beatOff: "خارج الإيقاع", beatCombo: "سلسلة", beatScore: "الإيقاع", beatBest: "أفضل سلسلة",
  },
  he: {
    trk_noclip: "נוקליפ: הרמות", trk_rarocore: "עיני התקלה", trk_juguetes: "תיבת הצעצועים", trk_peluche: "בובת ניאון", trk_frutigertour: "סיור פרוטיגר",
    rhythmSongbook: "שירי המשחק", rhythmMaking: "מלחין...", rhythmPreview: "האזנה", rhythmStop: "עצירה",
    rhythmBeatHelp: "החליקו, נחתו, עקפו ואספו תווים בקצב: מהלכים מושלמים נותנים טורבו ושרשרת.",
    beatPerfect: "מושלם", beatGood: "טוב", beatOff: "מחוץ לקצב", beatCombo: "שרשרת", beatScore: "קצב", beatBest: "השרשרת הטובה",
  },
};
