// Pixel art for every object on the belt and every container under it. Each
// sprite is a grid of palette letters, drawn once at boot into a canvas and
// scaled with nearest-neighbour, so the whole game's art is this one file and
// no request leaves the page for it.
//
// A sprite never gives away what the object's label decides: a deposit can and
// a deposit-free can share one picture, because telling them apart is what
// examining is for (R4). Variants get their own picture only where the eye is
// the honest cue — the colour of glass, a torn shirt.

export const PALETTE = {
  k: '#1a1c2c', K: '#333c57', g: '#566c86', G: '#94b0c2', w: '#f4f4f4', W: '#d6dde4',
  r: '#b13e53', R: '#e8574a', o: '#ef7d57', y: '#ffcd75', Y: '#f4c20d', l: '#a7f070',
  e: '#38b764', E: '#257179', b: '#3b5dc9', B: '#29366f', c: '#41a6f6', C: '#73eff7',
  n: '#9a6038', N: '#5d3a24', t: '#d09a5c', T: '#f0d2a2', p: '#5d275d', P: '#e86a92',
  s: '#f6b98c', a: '#c46b2a', m: '#b8c4cf', d: '#2b2f3a',
};

// Shapes shared by several objects, filled in by palette swaps below.
const BOTTLE = [
  '......kkkk......',
  '......kGGk......',
  '......kXHk......',
  '......kXXk......',
  '.....kXHXXk.....',
  '....kXHXXXXk....',
  '...kXHXXXXXXk...',
  '...kXHXXXXXXk...',
  '...kXHwwwwwXk...',
  '...kXHwLLLwXk...',
  '...kXHwwwwwXk...',
  '...kXHXXXXXXk...',
  '...kXHXXXXXXk...',
  '...kXXXXXXXXk...',
  '....kkkkkkkk....',
  '................',
];

const S = {
  // ------------------------------------------------------------- tier 1
  backpapier: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kTwwwwwwwwwwTk.',
    '.kTwWwWwWwWwwTk.',
    '.kkkkkkkkkkkkkk.',
    '.kTWwwwwwwwwwWk.',
    '.kTWwwwwwwwwwWk.',
    '.kTWWWWWWWWWWWk.',
    '.kkkkkkkkkkkkkk.',
    '..kwwwwwwwk.....',
    '...kwWwWwwwk....',
    '....kwwwWwwwk...',
    '.....kkkkkkkk...',
    '................',
    '................',
  ],
  bananenschalen: [
    '................',
    '..........kk....',
    '.........kNNk...',
    '........kYYk....',
    '.......kYYYk....',
    '......kYyYYk....',
    '.....kYyYYk.....',
    '....kYyYnYk.....',
    '...kYyYYYk......',
    '..kYyYYYYkkk....',
    '.kYYYnYYYYYYk...',
    'kYyk.kYYnYYYYk..',
    'kYk...kkYYYYYYk.',
    '.k.......kkYYk..',
    '...........kk...',
    '................',
  ],
  brot: [
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '..kkttttttttkk..',
    '.ktTtnTtnTtnttk.',
    'ktTTtnTTnTTnTTtk',
    'ktTTTTTTTTTTTTtk',
    'kttTTTTTTTTTTttk',
    'kntttttttttttttk',
    'knnttttttttttnnk',
    '.knnnnnnnnnnnnk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  coffeebecher: [
    '................',
    '...kkkkkkkkkk...',
    '..kgGGGGGGGGgk..',
    '..kkkkkkkkkkkk..',
    '...kwwwwwwwWk...',
    '...kwwwwwwwWk...',
    '...knnnnnnnNk...',
    '...kntttttnNk...',
    '...kntNNNtnNk...',
    '...knnnnnnnNk...',
    '....kwwwwwWk....',
    '....kwwwwwWk....',
    '....kwwwwwWk....',
    '....kwwwwwWk....',
    '.....kkkkkk.....',
    '................',
  ],
  eierkarton: [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kGGGGGGGGGGGGk.',
    '.kGgGGgGGgGGgGk.',
    '.kkkkkkkkkkkkkk.',
    'kGGkGGkGGkGGkGGk',
    'kGWGGWGGWGGWGGGk',
    'kGWGGWGGWGGWGGGk',
    'kgGGgGGgGGgGGGgk',
    '.kggkggkggkggkk.',
    '..kk.kk.kk.kk...',
    '................',
    '................',
    '................',
  ],
  eierschalen: [
    '................',
    '................',
    '................',
    '................',
    '..k.k.k...k.k...',
    '.kTkTkTk.kTkTk..',
    '.kTTTTTk.kTTTTk.',
    '.kTyTTTk.kTTyTk.',
    '.kwTTTTk.kTTTwk.',
    '.kwwTTTk.kTTwwk.',
    '..kwwwk...kwwk..',
    '...kkk.....kk...',
    '................',
    '................',
    '................',
    '................',
  ],
  kaffeefilter: [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kTNNNNNNNNNNTk.',
    '.kTNnNNnNNNnNTk.',
    '..kTNNNnNNNNTk..',
    '..kTTNNNNNNTTk..',
    '...kTTTTTTTTk...',
    '...kTtTTtTTTk...',
    '....kTTTTTTk....',
    '....kTtTTTTk....',
    '.....kTTTTk.....',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
  ],
  papiertaschentuch: [
    '................',
    '................',
    '.....kkk.kk.....',
    '...kkwwwkwwk....',
    '..kwwWwwwwwWk...',
    '.kwwWWwwwwWwwk..',
    '.kwwwwwWwwwwwk..',
    'kwWwwwwWWwwwWwk.',
    'kwwWwwwwwwwWwwk.',
    '.kwwwWwwwWwwwwk.',
    '.kwwwwWwwwwwWk..',
    '..kwWwwwwWwwk...',
    '...kkwwwwwkk....',
    '.....kkkkk......',
    '................',
    '................',
  ],
  papiertuete: [
    '................',
    '....k......k....',
    '...k.k....k.k...',
    '...k..k..k..k...',
    '..kkkkkkkkkkkk..',
    '..ktttttttttnk..',
    '..ktnTtttttTnk..',
    '..kttttttttTnk..',
    '..ktTttttttTnk..',
    '..ktttttttttnk..',
    '..ktttttttttnk..',
    '..ktTttttttttnk.',
    '..kttttttttttnk.',
    '..knnnnnnnnnnnk.',
    '..kkkkkkkkkkkkk.',
    '................',
  ],
  thermosflasche: [
    '.....kkkkkk.....',
    '.....kKKKKk.....',
    '.....kkkkkk.....',
    '....kGGmmGgk....',
    '....kGwmmmgk....',
    '....kGwmmmgk....',
    '....kGwmmmgk....',
    '....kGwmmmgk....',
    '....kGwmmmgk....',
    '....kKKKKKKk....',
    '....kGwmmmgk....',
    '....kGwmmmgk....',
    '....kGwmmmgk....',
    '....kGGmmmgk....',
    '.....kkkkkk.....',
    '................',
  ],
  windeln: [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'kcwwwwwwwwwwwwck',
    'kcwwwwwwwwwwwwck',
    '.kWwwPwwwwPwwWk.',
    '..kWwwwwwwwwWk..',
    '...kWwwwwwwWk...',
    '....kWwwwwWk....',
    '.....kWwwWk.....',
    '......kkkk......',
    '................',
    '................',
    '................',
    '................',
  ],
  zahnbuerste: [
    '................',
    '...........kk...',
    '..........kwWk..',
    '.........kwwWk..',
    '.........kkkk...',
    '........kck.....',
    '.......kck......',
    '......kck.......',
    '.....kck........',
    '....kck.........',
    '...kcbk.........',
    '..kcbk..........',
    '..kbk...........',
    '..kk............',
    '................',
    '................',
  ],
  zeitung: [
    '................',
    '................',
    '.kkkkkkkkkkkkk..',
    '.kwwwwwwwwwwWk..',
    '.kwkkkkkkkkwWk..',
    '.kwwwwwwwwwwWk..',
    '.kwGGGw.GGGGWk..',
    '.kwGGGw.wwwwWk..',
    '.kwGGGw.GGGGWk..',
    '.kwwwww.wwwwWkk.',
    '.kwGGGG.GGGGWWk.',
    '.kwwwww.wwwwWWk.',
    '.kwGGGG.GGGGWWk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  zigarettenschachtel: [
    '................',
    '................',
    '....kkkkkkkk....',
    '....kwwwwwwk....',
    '....kkkkkkkk....',
    '....kRRRRRRk....',
    '....kRwwwwRk....',
    '....kRwrrwRk....',
    '....kRwwwwRk....',
    '....kwwwwwwk....',
    '....kwGGGGwk....',
    '....kwwwwwwk....',
    '....kwwwwwwk....',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  // ------------------------------------------------------------- tier 2
  batterien: [
    '................',
    '................',
    '...kk.....kk....',
    '..kGGk...kGGk...',
    '.kkkkkk.kkkkkk..',
    '.kYYYYk.kYYYYk..',
    '.kYwYYk.kYwYYk..',
    '.kYYYYk.kYYYYk..',
    '.kkkkkk.kkkkkk..',
    '.kkgkkk.kkgkkk..',
    '.kkgkkk.kkgkkk..',
    '.kkkkkk.kkkkkk..',
    '.kGGGGk.kGGGGk..',
    '.kkkkkk.kkkkkk..',
    '................',
    '................',
  ],
  akkus: [
    '................',
    '................',
    '...kk.....kk....',
    '..kGGk...kGGk...',
    '.kkkkkk.kkkkkk..',
    '.keeeek.keeeek..',
    '.kelleek.kleeek.',
    '.keeeek.keeeek..',
    '.kElllk.kElllk..',
    '.keeeek.keeeek..',
    '.kEEEEk.kEEEEk..',
    '.keeeek.keeeek..',
    '.kGGGGk.kGGGGk..',
    '.kkkkkk.kkkkkk..',
    '................',
    '................',
  ],
  ladekabel: [
    '................',
    '.....kkkk.......',
    '.....kwwk.......',
    '....kkwwkk......',
    '....kwwwwk......',
    '....kkkkkk......',
    '......kk........',
    '......kk..kkkk..',
    '.....kk..kk..kk.',
    '....kk..kk....k.',
    '...kk..kk...kkk.',
    '...k..kk..kkk...',
    '...kkkk..kk.....',
    '........kGGk....',
    '........kGGk....',
    '.........kk.....',
  ],
  handy: [
    '................',
    '.....kkkkkk.....',
    '....kKKKKKKk....',
    '....kKkkkkKk....',
    '....kKcCCcKk....',
    '....kKcCccKk....',
    '....kKCccCKk....',
    '....kKccCcKk....',
    '....kKcccCKk....',
    '....kKcCccKk....',
    '....kKkkkkKk....',
    '....kKKggKKk....',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
  ],
  elektrozahnbuerste: [
    '.......kk.......',
    '......kwWk......',
    '......kwWk......',
    '......kkkk......',
    '.......kk.......',
    '......kwwk......',
    '......kwWk......',
    '......kwWk......',
    '.....kwwwWk.....',
    '.....kwbbWk.....',
    '.....kwbbWk.....',
    '.....kwwwWk.....',
    '.....kwwwWk.....',
    '...kkkkkkkkkk...',
    '...kGGGGGGGGk...',
    '....kkkkkkkk....',
  ],
  led_lampe: [
    '................',
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '...kwwwwwwWWk...',
    '...kwwYYYYwWk...',
    '...kwwwwwwwWk...',
    '...kwwwwwwwWk...',
    '....kwwwwwWk....',
    '.....kWWWWk.....',
    '.....kkkkkk.....',
    '.....kGgGgk.....',
    '.....kgGgGk.....',
    '.....kGgGgk.....',
    '......kggk......',
    '.......kk.......',
    '................',
  ],
  gluehlampe: [
    '................',
    '.....kkkkkk.....',
    '....kCCCCCCk....',
    '...kCwCCCCCCk...',
    '...kCwCkCkCCk...',
    '...kCCCkCkCCk...',
    '...kCCCCkCCCk...',
    '....kCCCkCCk....',
    '.....kCCCCk.....',
    '.....kkkkkk.....',
    '.....kGgGgk.....',
    '.....kgGgGk.....',
    '.....kGgGgk.....',
    '......kggk......',
    '.......kk.......',
    '................',
  ],
  pfandflasche_einweg: [
    '......kkkk......',
    '......kbbk......',
    '......kkkk......',
    '......kCck......',
    '.....kCwcck.....',
    '....kCwcccck....',
    '....kCwcccck....',
    '....kkkkkkkk....',
    '....kwRRRRwk....',
    '....kwRwwRwk....',
    '....kkkkkkkk....',
    '....kCwcccck....',
    '....kCcccCck....',
    '....kCwcccck....',
    '.....kkkkkk.....',
    '................',
  ],
  pfandflasche_mehrweg: BOTTLE,
  fernbedienung: [
    '................',
    '.....kkkkkk.....',
    '....kKKKKKKk....',
    '....kKkRRkKk....',
    '....kKKKKKKk....',
    '....kKGkGkKk....',
    '....kKKKKKKk....',
    '....kKGkGkKk....',
    '....kKKKKKKk....',
    '....kKGkGkKk....',
    '....kKKKKKKk....',
    '....kKkkkkKk....',
    '....kKKKKKKk....',
    '.....kkkkkk.....',
    '................',
    '................',
  ],
  // ------------------------------------------------------------- tier 3
  aludose: [
    '................',
    '.....kkkkkk.....',
    '....kGwGGGGk....',
    '....kkkkkkkk....',
    '....krRRRRrk....',
    '....kRwRRRRk....',
    '....kRwwwRRk....',
    '....kRwRRwRk....',
    '....kRwRRwRk....',
    '....kRwRRRRk....',
    '....kRwRRRRk....',
    '....krRRRRrk....',
    '....kkkkkkkk....',
    '....kGwGGGGk....',
    '.....kkkkkk.....',
    '................',
  ],
  glasflasche: BOTTLE,
  opalglas: [
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '...kGGGGGGGGk...',
    '...kkkkkkkkkk...',
    '..kwwwwwwwwwWk..',
    '..kwWwwwwwwwWk..',
    '..kwWwwPPwwwWk..',
    '..kwWwPwwPwwWk..',
    '..kwWwwPPwwwWk..',
    '..kwwwwwwwwwWk..',
    '..kWWWWWWWWWWk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  kristallglas: [
    '................',
    '...kkkkkkkkkk...',
    '...kCwCCCwCCk...',
    '...kCwCwCCwCk...',
    '...kCCwCCwCCk...',
    '....kCwCCwCk....',
    '.....kCCCCk.....',
    '......kCCk......',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
    '.....kkkkkk.....',
    '....kCwCCCCk....',
    '....kkkkkkkk....',
    '................',
  ],
  spiegel: [
    '................',
    '...kkkkkkkkkk...',
    '..knnnnnnnnnNk..',
    '..knkkkkkkkknk..',
    '..knkCwCCCCknk..',
    '..knkwCCCCCknk..',
    '..knkCCCCwCknk..',
    '..knkCCCwCCknk..',
    '..knkCCwCCCknk..',
    '..knkCwCCCCknk..',
    '..knkCCCCCCknk..',
    '..knkkkkkkkknk..',
    '..kNnnnnnnnnNk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
  ],
  joghurtbecher: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kmGmGmGmGmGk..',
    '..kkkkkkkkkkkk..',
    '...kwwwwwwwWk...',
    '...kwPPPPPwWk...',
    '...kwPwwwPwWk...',
    '...kwPPPPPwWk...',
    '....kwwwwwWk....',
    '....kwbbbbWk....',
    '....kwwwwwWk....',
    '.....kwwwWk.....',
    '.....kkkkkk.....',
    '................',
    '................',
  ],
  getraenkekarton: [
    '................',
    '.......kk.......',
    '......kwWk......',
    '.....kwwWWk.....',
    '....kkkkkkkk....',
    '....kYYYYYYk....',
    '....kYwYYYYk....',
    '....kYYYoYYk....',
    '....kYYooYYk....',
    '....kYYYoYYk....',
    '....kwwwwwwk....',
    '....kweeeeWk....',
    '....kwwwwwWk....',
    '....kWWWWWWk....',
    '....kkkkkkkk....',
    '................',
  ],
  konservendose: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kGwGGGGGgk...',
    '...kkkkkkkkkk...',
    '...kGwGGGGGgk...',
    '...kkkkkkkkkk...',
    '...koyoooooRk...',
    '...koeeeoooRk...',
    '...koeeeyyoRk...',
    '...kooooyyoRk...',
    '...kkkkkkkkkk...',
    '...kGwGGGGGgk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  deospray: [
    '......kkk.......',
    '.....kKKKk......',
    '.....kKKKkk.....',
    '....kkkkkkkk....',
    '....kGwGGGgk....',
    '....kkkkkkkk....',
    '....kbwbbbBk....',
    '....kbwbbbBk....',
    '....kbwCCbBk....',
    '....kbwCCbBk....',
    '....kbwbbbBk....',
    '....kbwbbbBk....',
    '....kbwbbbBk....',
    '....kGwGGGgk....',
    '.....kkkkkk.....',
    '................',
  ],
  kronkorken: [
    '................',
    '................',
    '.....k.kk.k.....',
    '....kRkRRkRk....',
    '...kRRRRRRRRk...',
    '..kkRRwwRRRRkk..',
    '..kRRwRRRRRRRk..',
    '...kRRRYYRRRk...',
    '..kRRRYrrYRRRk..',
    '..kRRRYYYYRRRk..',
    '...kRRRRRRRRk...',
    '..kkRRRRRRRrkk..',
    '...kRrRRRRrRk...',
    '....kRkrrkRk....',
    '.....k.kk.k.....',
    '................',
  ],
  shampooflasche: [
    '................',
    '......kkkk......',
    '......kPPk......',
    '.....kkkkkk.....',
    '....kPPPPPPk....',
    '...kPwPPPPPPk...',
    '...kPwPPPPPPk...',
    '...kPwwwwwwPk...',
    '...kPwPPPPwPk...',
    '...kPwwwwwwPk...',
    '...kPwPPPPPPk...',
    '...kPwPPPPPPk...',
    '...kPPPPPPPPk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  plastiktuete: [
    '................',
    '...kkk....kkk...',
    '..kw.wk..kw.wk..',
    '..kw.wk..kw.wk..',
    '..kwwwkkkkwwwk..',
    '.kwwwwwwwwwwwWk.',
    '.kwWwwwwwwwwwWk.',
    '.kwwwwwwwwwWwWk.',
    '.kwwwRRRRwwwwWk.',
    '.kwwwRwwRwwwwWk.',
    '.kwWwRRRRwwwwWk.',
    '.kwwwwwwwwwWwWk.',
    '.kwwwwwwwwwwwWk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  styropor: [
    '................',
    '................',
    '................',
    '.....kkkkkkkkkk.',
    '....kwwwwwwwwWk.',
    '...kwWwWwwWwWWk.',
    '..kkkkkkkkkkWWk.',
    '..kwwWwwWwwkWWk.',
    '..kwWwwwwWwkWWk.',
    '..kwwwWwwwwkWWk.',
    '..kwWwwWwWwkWk..',
    '..kwwwwwwwwkk...',
    '..kkkkkkkkkk....',
    '................',
    '................',
    '................',
  ],
  kaffeekapsel: [
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kGwGGGGGGGgk..',
    '..kkkkkkkkkkkk..',
    '...kpPppppppk...',
    '...kpPppppppk...',
    '....kpPpppk.....',
    '....kpPpppk.....',
    '.....kpppk......',
    '......kkk.......',
    '................',
    '................',
    '................',
    '................',
  ],
  tshirt: [
    '................',
    '................',
    '...kkkk..kkkk...',
    '..kbbbbkkbbbbk..',
    '.kbbbbbbbbbbbbk.',
    'kbbbbbbbbbbbbbbk',
    'kbbkbbbbbbbbkbbk',
    '.kk.kbbbbbbk.kk.',
    '....kbbbbbbk....',
    '....kbcbbbbk....',
    '....kbbbbbbk....',
    '....kbbbbbbk....',
    '....kbbbbbbk....',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  'tshirt.kaputt': [
    '................',
    '................',
    '...kkkk..kkkk...',
    '..kggggkkggggk..',
    '.kggggggggnggk..',
    'kggnggggggggggk.',
    'kggkggggggggkggk',
    '.kk.kggk.ggk.kk.',
    '....kgg.kggk....',
    '....kggggnngk...',
    '....kgnnggggk...',
    '....kgggg.ggk...',
    '....kgggk.kggk..',
    '....kkkk...kkk..',
    '................',
    '................',
  ],
  bettwaesche: [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwWk.',
    '.kwcwwcwwcwwwWk.',
    '.kkkkkkkkkkkkkk.',
    '.kccccccccccccCk',
    '.kcwccwccwcccCk.',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwWk.',
    '.kwcwwcwwcwwwWk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
  ],
  gummistiefel: [
    '................',
    '....kkkkkk......',
    '....keeeeEk.....',
    '....kellleEk....',
    '....keleeeEk....',
    '....keleeeEk....',
    '....keleeeEk....',
    '....keleeeEk....',
    '....keleeeEk....',
    '....keleeeEkk...',
    '....keleeeeeEk..',
    '...keleeeeeeeEk.',
    '...keeeeeeeeeEk.',
    '...kKKKKKKKKKKk.',
    '...kkkkkkkkkkkk.',
    '................',
  ],
  teelicht: [
    '................',
    '................',
    '................',
    '.......kk.......',
    '......kYYk......',
    '......kyok......',
    '.......kk.......',
    '.......kk.......',
    '..kkkkkkkkkkkk..',
    '.kGwwwwwwwwwwGk.',
    '.kgkkkkkkkkkkgk.',
    '.kGmGmGmGmGmGgk.',
    '.kgGmGmGmGmGmgk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  // ------------------------------------------------------------- tier 4
  toaster: [
    '................',
    '................',
    '....kk....kk....',
    '...kttk..kttk...',
    '..kkkkkkkkkkkk..',
    '.kGwwGkkkGwwGgk.',
    '.kGwkkGGGkkGGgk.',
    '.kGGGGGGGGGGGgk.',
    '.kGwGGGGGGGGGgkk',
    '.kGGGGGGGGGGGgKk',
    '.kGGGGGGGGGGGgk.',
    '.kggggggggggggk.',
    '..kkkkkkkkkkkk..',
    '..kk........kk..',
    '................',
    '................',
  ],
  wasserkocher: [
    '................',
    '.....kkkkkk.....',
    '....kKKKKKKk....',
    '...kkkkkkkkkk...',
    'kk.kGwGGGGGgkkk.',
    'kGkkGwGGGGGgkKk.',
    '.kGkGwGGCGGgkKk.',
    '..kkGwGGCGGgkKk.',
    '...kGwGGCGGgkKk.',
    '...kGwGGGGGgkKk.',
    '...kGwGGGGGgkk..',
    '...kGGGGGGGgk...',
    '..kkkkkkkkkkkk..',
    '..kKKKKKKKKKKk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  laptop: [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '...kKKKKKKKKk...',
    '...kKccCcccKk...',
    '...kKcCcccCKk...',
    '...kKccccCcKk...',
    '...kKcccCccKk...',
    '...kKKKKKKKKk...',
    '..kkkkkkkkkkkk..',
    '.kGGGGGGGGGGGGk.',
    '.kGkGkGkGkGkGGk.',
    'kGGGGGkkkkGGGGGk',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
  ],
  fernseher: [
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'kKKKKKKKKKKKKKKk',
    'kKbbbbbbbbbbbcKk',
    'kKbbbbbbbbbbcbKk',
    'kKbbbbbbbbbcbbKk',
    'kKbbbbbbbbcbbbKk',
    'kKbbbbbbbcbbbbKk',
    'kKbbbbbbbbbbbbKk',
    'kKKKKKKKKKKKKKKk',
    'kkkkkkkkkkkkkkkk',
    '......kKKk......',
    '....kkkkkkkk....',
    '....kKKKKKKk....',
    '....kkkkkkkk....',
  ],
  kuehlschrank: [
    '...kkkkkkkkkk...',
    '...kwwwwwwwWk...',
    '...kwwwwwwkWk...',
    '...kwwwwwwkWk...',
    '...kwwwwwwwWk...',
    '...kkkkkkkkkk...',
    '...kwwwwwwwWk...',
    '...kwwwwwwkWk...',
    '...kwwwwwwkWk...',
    '...kwwwwwwkWk...',
    '...kwwwwwwwWk...',
    '...kwwwwwwwWk...',
    '...kwwwwwwwWk...',
    '...kWWWWWWWWk...',
    '...kkkkkkkkkk...',
    '...kk......kk...',
  ],
  matratze: [
    '................',
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwWk',
    'kwcwwcwwcwwcwwWk',
    'kwwwwwwwwwwwwWWk',
    'kwcwwcwwcwwcwWWk',
    'kwwwwwwwwwwwwWk.',
    'kccccccccccccCk.',
    'kkkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
    '................',
  ],
  sofa: [
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kRRRRkRRRRRk..',
    '..kRrRRkRrRRRk..',
    '.kkRRRRkRRRRRkk.',
    'kRRkkkkkkkkkkRRk',
    'kRrkRRRRkRRRRRrk',
    'kRrkrrrrkrrrrRrk',
    'kRRkkkkkkkkkkRRk',
    'krrrrrrrrrrrrrrk',
    'kkkkkkkkkkkkkkkk',
    '.kNk........kNk.',
    '.kkk........kkk.',
    '................',
  ],
  stuhl: [
    '................',
    '....kkkkkkkk....',
    '....knnnnnnk....',
    '....knNNNNnk....',
    '....knnnnnnk....',
    '....knNNNNnk....',
    '....knnnnnnk....',
    '....knkkkknk....',
    '...kkkkkkkkkk...',
    '...ktttttttttk..',
    '...kkkkkkkkkkk..',
    '...knk....knk...',
    '...knk....knk...',
    '...knk....knk...',
    '...kkk....kkk...',
    '................',
  ],
  bettdecke: [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kyyyyyyyyyyyyk.',
    '.kywyyywyyywyYk.',
    'kyyyyyyyyyyyyyYk',
    'kyyykyyykyyykyYk',
    'kyyyyyyyyyyyyyYk',
    'kywyyywyyywyyyYk',
    'kyyyyyyyyyyyyYYk',
    '.kYYYYYYYYYYYYk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  bohrmaschine: [
    '................',
    '................',
    '....kkkkkkkk....',
    '...kYYYYYYYYkkk.',
    'kkkYwYYYYYYYkGGk',
    'kGGYYYYYYYYYkkkk',
    'kkkYYYYYYYYYk...',
    '...kkkkYYYkk....',
    '.......kYYk.....',
    '.......kKKk.....',
    '.......kKKk.....',
    '......kkkkkk....',
    '......kKKKKk....',
    '......kKggKk....',
    '......kkkkkk....',
    '................',
  ],
  // ------------------------------------------------------------- tier 5
  farbeimer: [
    '................',
    '....kkkkkkkk....',
    '...k........k...',
    '..k..........k..',
    '..kkkkkkkkkkkk..',
    '..kGwGGGGGGGgk..',
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwWk..',
    '..kwkkkkkkkwWk..',
    '..kwkGGGGGkwWk..',
    '..kwkkkkkkkwWk..',
    '..kwwwwwwwwwWk..',
    '..kwwwwwwwwwWk..',
    '..kWWWWWWWWWWk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  nagellack: [
    '................',
    '.......kk.......',
    '......kKKk......',
    '......kKKk......',
    '......kKKk......',
    '.....kkkkkk.....',
    '....kPwPPPPk....',
    '...kPwPPPPPPk...',
    '...kPwPPPPPPk...',
    '...kPwPPPPPPk...',
    '...kPPPPPPPPk...',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
    '................',
  ],
  rohrreiniger: [
    '................',
    '......kkkk......',
    '......kRRk......',
    '.....kkkkkk.....',
    '....kYYYYYYk....',
    '...kYwYYYYYYk...',
    '...kYwkkkkYYk...',
    '...kYwkoRkYYk...',
    '...kYwkRokYYk...',
    '...kYwkkkkYYk...',
    '...kYwYYYYYYk...',
    '...kYYYYYYYYk...',
    '...kYYYYYYYYk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  pflanzenschutz: [
    '................',
    '......kkkk......',
    '......kKKk......',
    '.....kkkkkk.....',
    '....keeeeeek....',
    '...keleeeeeek...',
    '...kelkkkkeek...',
    '...kelkokkeek...',
    '...kelkkokeek...',
    '...kelkkkkeek...',
    '...keleeeeeek...',
    '...keeeeeeeek...',
    '...kEEEEEEEEk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  medikamente: [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwWk..',
    '..kwwwRRwwwwWk..',
    '..kwwRRRRwwwWk..',
    '..kwwwRRwwwwWk..',
    '..kkkkkkkkkkkk..',
    '..kGkGkGkGkGgk..',
    '..kmwmwmwmwmgk..',
    '..kmPmPmwmwmgk..',
    '..kmwmwmwmwmgk..',
    '..kGGGGGGGGGgk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  thermometer: [
    '................',
    '..........kk....',
    '.........kwWk...',
    '........kwGWk...',
    '.......kwGwk....',
    '......kwGwk.....',
    '.....kwGwk......',
    '....kwGwk.......',
    '...kwGwk........',
    '..kwRwk.........',
    '.kRRRk..........',
    '.kRRRk..........',
    '..kkk...........',
    '................',
    '................',
    '................',
  ],
  energiesparlampe: [
    '.....kk..kk.....',
    '....kwWkkwWk....',
    '....kwWkkwWk....',
    '....kwWkkwWk....',
    '....kwWkkwWk....',
    '....kwWkkwWk....',
    '....kwWWWWWk....',
    '.....kwwwwk.....',
    '....kkkkkkkk....',
    '....kwwwwwWk....',
    '....kkkkkkkk....',
    '.....kGgGgk.....',
    '.....kgGgGk.....',
    '......kggk......',
    '.......kk.......',
    '................',
  ],
  lametta: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kKKKKKKKKKKk..',
    '..kmGmGmGmGmGk..',
    '..kGmGmGmGmGmk..',
    '..kmkmkGkmkmGk..',
    '..kGkGkmkGkGmk..',
    '..kmkmkGkmkmGk..',
    '..kGkGkmkGkGmk..',
    '...kk.kmk.kkmk..',
    '......kGk..kGk..',
    '......kmk..kmk..',
    '.......k...kk...',
    '................',
    '................',
    '................',
  ],
  verduenner: [
    '................',
    '......kkkk......',
    '......kKKk......',
    '....kkkkkkkk....',
    '...kGGGGGGGGk...',
    '...kGwGGGGGGk...',
    '...kGwwwwwwGk...',
    '...kGwRRRRwGk...',
    '...kGwRkkRwGk...',
    '...kGwRRRRwGk...',
    '...kGwwwwwwGk...',
    '...kGwGGGGGGk...',
    '...kggggggggk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
};

// Palette swaps for shapes that recur. X is the body colour, H its highlight,
// L the label's print.
const SWAPS = {
  glasflasche: { X: 'C', H: 'w', L: 'G' },
  'glasflasche.weiss': { X: 'C', H: 'w', L: 'G' },
  'glasflasche.gruen': { X: 'e', H: 'l', L: 'E' },
  'glasflasche.braun': { X: 'a', H: 'y', L: 'N' },
  'glasflasche.blau': { X: 'b', H: 'c', L: 'B' },
  pfandflasche_mehrweg: { X: 'e', H: 'l', L: 'r' },
};
// Glass colour is also carried as a texture — green-versus-brown is exactly the
// pair a colour-blind player loses (R12, AE11): green is striped, brown dotted,
// blue barred, clear plain.
const TEXTURE = {
  diag: (x, y) => (x + y) % 3 === 0,
  dots: (x, y) => x % 2 === 0 && y % 2 === 0,
  bars: x => x % 2 === 0,
};
const GLASS_TEXTURE = { 'glasflasche.gruen': ['diag', 'E'], 'glasflasche.braun': ['dots', 'N'],
                        'glasflasche.blau': ['bars', 'B'], pfandflasche_mehrweg: ['diag', 'E'] };
Object.entries(SWAPS).forEach(([id, map]) => {
  const tex = GLASS_TEXTURE[id];
  S[id] = BOTTLE.map((row, y) => [...row].map((ch, x) => {
    if (ch === 'X' && tex && TEXTURE[tex[0]](x, y)) return tex[1];
    return map[ch] || ch;
  }).join(''));
});

// Parts reuse the picture of what they are.
S['fernbedienung:batterien'] = S.batterien;
S['fernbedienung:geraet'] = S.fernbedienung;
S['bohrmaschine:akku'] = [
  '................',
  '................',
  '................',
  '................',
  '...kkkkkkkkkk...',
  '..kKKKKKKKKKKk..',
  '..kKggKKKKeeKk..',
  '..kKggKKKKelKk..',
  '..kKKKKKKKKKKk..',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
S['bohrmaschine:geraet'] = S.bohrmaschine;
S['joghurtbecher:becher'] = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..k..........k..',
  '..kkkkkkkkkkkk..',
  '...kwwwwwwwWk...',
  '...kwPPPPPwWk...',
  '...kwPwwwPwWk...',
  '...kwPPPPPwWk...',
  '....kwwwwwWk....',
  '....kwbbbbWk....',
  '....kwwwwwWk....',
  '.....kwwwWk.....',
  '.....kkkkkk.....',
  '................',
  '................',
];
S['joghurtbecher:deckel'] = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkkk.',
  '.kmGmGmGmGmGmGk.',
  '.kGwmGmGPPmGmGk.',
  '.kmGmGmPmmPmGmk.',
  '.kGmGmGmPPmGmGk.',
  '..kkkkkkkkkkkkkk',
  '...........kmk..',
  '............k...',
  '................',
  '................',
  '................',
];

export const ITEMS = S;

// ---------------------------------------------------------------- containers
// Containers are composed rather than drawn cell by cell: a bin is a lid, a
// body and a plate with an icon, and fourteen of them differ only in those.

function grid(w, h) { return Array.from({ length: h }, () => Array(w).fill('.')); }
function rect(g, x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = c;
}
function box(g, x, y, w, h, fill, line = 'k') {
  rect(g, x, y, w, h, line);
  rect(g, x + 1, y + 1, w - 2, h - 2, fill);
}
function put(g, x, y, rows) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && g[y + j]) g[y + j][x + i] = ch; }));
}
const rows = g => g.map(r => r.join(''));

// Icons sit on a plate on the container's front: 8 by 6, drawn in ink and the
// container's accent, so the picture survives greyscale (R12).
const ICON = {
  rest: ['..kkkk..', '.kkkkkk.', '..kggk..', '..kggk..', '..kggk..', '..kkkk..'],
  papier: ['kkkkkkk.', 'kwkkkwk.', 'kwwwwwkk', 'kwkkkwwk', 'kwwwwwwk', 'kkkkkkkk'],
  bio: ['....kkk.', '..kkeek.', '.kelleek', '.keleek.', 'kkkkk...', 'k.......'],
  gelb: ['...kk...', '..kYYk..', '..kkkk..', '.kYwYYk.', '.kYwYYk.', '.kkkkkk.'],
  pfand: ['.kkkkk..', 'k.....k.', 'k..kkkkk', 'k...kkk.', '.k...k..', '..kkk...'],
  batt: ['...kk...', '.kkkkkk.', '.kYYYYk.', '.kYYYYk.', '.kkkkkk.', '.kGGGGk.'],
  plug: ['.k...k..', '.k...k..', 'kkkkkkk.', 'kgggggk.', '.kgggk..', '...k....'],
  glass: ['...kk...', '...kk...', '..kXXk..', '.kXXXXk.', '.kXXXXk.', '.kkkkkk.'],
  can: ['.kkkkkk.', '.kGGGGk.', '.kgggg k', '.kGGGGk.', '.kggggk.', '.kkkkkk.'],
  shirt: ['.kk..kk.', 'kXXkkXXk', 'kXXXXXXk', '.kXXXXk.', '.kXXXXk.', '.kkkkkk.'],
  tv: ['kkkkkkkk', 'kbbbbbck', 'kbbbbcbk', 'kkkkkkkk', '...kk...', '.kkkkkk.'],
  chair: ['.kk.....', '.kk.....', '.kkkkkk.', '.knnnnk.', '.k....k.', '.k....k.'],
  hazard: ['...kk...', '..kYYk..', '..kkYk..', '.kYkYYk.', 'kYYYYYYk', 'kkkkkkkk'],
  flask: ['..kkk...', '..kgk...', '.kgggk..', 'kgeeegk.', 'keeeeek.', 'kkkkkkk.'],
};

function plate(g, x, y, icon, accent) {
  box(g, x, y, 10, 8, 'w');
  put(g, x + 1, y + 1, ICON[icon].map(r => r.replace(/X/g, accent || 'g').replace(/ /g, '.')));
}

function wheelie(lid, lidShade, icon) {
  const g = grid(24, 24);
  box(g, 3, 6, 18, 15, 'K');
  rect(g, 4, 7, 1, 13, 'g');
  rect(g, 19, 7, 1, 13, 'd');
  box(g, 2, 2, 20, 5, lid);
  rect(g, 3, 5, 18, 1, lidShade);
  rect(g, 8, 1, 8, 1, 'k');
  plate(g, 7, 9, icon);
  box(g, 4, 20, 4, 3, 'g');
  box(g, 16, 20, 4, 3, 'g');
  return rows(g);
}

function igloo(body, shade, icon, accent, texture) {
  const g = grid(24, 24);
  box(g, 2, 5, 20, 17, body);
  if (texture) {
    for (let y = 6; y < 21; y++) for (let x = 4; x < 20; x++) if (TEXTURE[texture](x, y)) g[y][x] = shade;
  }
  rect(g, 3, 6, 1, 15, 'w');
  rect(g, 20, 6, 1, 15, shade);
  box(g, 4, 2, 16, 4, shade);
  box(g, 9, 3, 6, 2, 'k');
  plate(g, 7, 9, icon, accent);
  rect(g, 2, 21, 20, 1, 'k');
  box(g, 3, 21, 3, 2, 'K');
  box(g, 18, 21, 3, 2, 'K');
  return rows(g);
}

function crate(body, shade, icon, accent) {
  const g = grid(24, 24);
  box(g, 1, 14, 22, 9, 'n');
  rect(g, 2, 15, 20, 1, 't');
  box(g, 5, 6, 14, 9, body);
  rect(g, 6, 7, 12, 1, shade);
  box(g, 9, 5, 6, 2, 'k');
  plate(g, 7, 15, icon, accent);
  return rows(g);
}

function skip(body, shade, icon, cargo) {
  const g = grid(24, 24);
  for (let j = 0; j < 12; j++) rect(g, 1 + Math.floor(j / 4), 9 + j, 22 - 2 * Math.floor(j / 4), 1, j === 0 ? 'k' : body);
  for (let j = 0; j < 12; j++) {
    const x = 1 + Math.floor(j / 4), w = 22 - 2 * Math.floor(j / 4);
    g[9 + j][x] = 'k'; g[9 + j][x + w - 1] = 'k';
  }
  rect(g, 3, 21, 18, 1, 'k');
  rect(g, 2, 10, 20, 1, shade);
  put(g, 3, 3, cargo);
  plate(g, 7, 12, icon);
  box(g, 4, 21, 3, 3, 'K');
  box(g, 17, 21, 3, 3, 'K');
  return rows(g);
}

const CARGO = {
  elektro: ['....kkkkkk......', '...kbbbbcbk.kk..', '...kbbbcbbkkGGk.', '..kkkkkkkkkGGGk.', '.kGGGk.kGGGGGGk.', '.kGwGk.kGkGkGGk.'],
  sperr: ['.kkk.......kkk..', '.knk.......knk..', '.knkkkkkkkkknk..', '.kRRRRRRRRRRRk..', 'kRrrrrrrrrrrrRk.', 'kkkkkkkkkkkkkkk.'],
};

const C = {
  restmuell: wheelie('k', 'K', 'rest'),
  papier: wheelie('b', 'B', 'papier'),
  bio: wheelie('n', 'N', 'bio'),
  gelbe_tonne: wheelie('Y', 'a', 'gelb'),
  glas_weiss: igloo('w', 'G', 'glass', 'C'),
  glas_gruen: igloo('e', 'E', 'glass', 'e', 'diag'),
  glas_braun: igloo('a', 'N', 'glass', 'a', 'dots'),
  kunststoff: igloo('Y', 'a', 'gelb'),
  metall: igloo('G', 'g', 'can'),
  altkleider: igloo('R', 'r', 'shirt', 'b'),
  batteriebox: crate('e', 'E', 'batt'),
  elektro_ruecknahme: crate('b', 'B', 'plug'),
  elektroschrott: skip('b', 'B', 'tv', CARGO.elektro),
  batterien: igloo('e', 'E', 'batt'),
  sperrmuell: skip('o', 'a', 'chair', CARGO.sperr),
};

C.pfandautomat = (() => {
  const g = grid(24, 24);
  box(g, 3, 1, 18, 22, 'G');
  rect(g, 4, 2, 1, 20, 'w');
  rect(g, 19, 2, 1, 20, 'g');
  box(g, 6, 3, 12, 5, 'E');
  rect(g, 8, 5, 6, 1, 'l');
  box(g, 7, 10, 10, 8, 'K');
  box(g, 9, 12, 6, 4, 'k');
  rect(g, 10, 13, 4, 2, 'd');
  rect(g, 7, 19, 10, 2, 'k');
  rect(g, 8, 19, 8, 1, 'g');
  return rows(g);
})();

C.giftmobil = (() => {
  const g = grid(24, 24);
  box(g, 1, 6, 15, 13, 'w');
  rect(g, 2, 7, 13, 1, 'W');
  box(g, 15, 9, 8, 10, 'R');
  box(g, 17, 10, 5, 4, 'C');
  put(g, 4, 8, ICON.hazard);
  rect(g, 1, 18, 22, 1, 'k');
  box(g, 3, 18, 5, 5, 'K');
  rect(g, 5, 20, 1, 1, 'G');
  box(g, 16, 18, 5, 5, 'K');
  rect(g, 18, 20, 1, 1, 'G');
  return rows(g);
})();

C.problemstoffannahme = (() => {
  const g = grid(24, 24);
  box(g, 0, 13, 24, 10, 'n');
  rect(g, 1, 14, 22, 1, 't');
  box(g, 2, 3, 6, 10, 'R');
  rect(g, 3, 6, 4, 1, 'k');
  rect(g, 3, 9, 4, 1, 'k');
  box(g, 9, 5, 6, 8, 'Y');
  put(g, 10, 6, ['.kk.', 'kYYk', 'kkYk', 'kkkk'].map(r => r));
  box(g, 16, 2, 6, 11, 'e');
  rect(g, 17, 5, 4, 1, 'k');
  rect(g, 17, 8, 4, 1, 'k');
  plate(g, 7, 15, 'flask');
  return rows(g);
})();

export const CONTAINERS = C;

// ------------------------------------------------------------------ scenery
// The finale's tree, and the four places it can go.
export const TREE = (() => {
  const g = grid(32, 44);
  // Four tiers, each a triangle that overlaps the one above, drawn top to
  // bottom so the wider tier covers the narrower one's base.
  [[1, 10, 6], [7, 11, 9], [14, 12, 12], [21, 14, 15]].forEach(([top, height, base]) => {
    for (let r = 0; r < height; r++) {
      const half = Math.round(1 + (base - 1) * r / (height - 1));
      const y = top + r;
      rect(g, 16 - half, y, half * 2, 1, r === height - 1 ? 'E' : 'e');
      g[y][16 - half] = 'k';
      g[y][16 + half - 1] = 'k';
      if (half > 2 && r < height - 1) { g[y][16 - half + 1] = 'l'; if (r % 3 === 1) g[y][16 - half + 2] = 'l'; }
    }
    rect(g, 16 - base, top + height - 1, base * 2, 1, 'k');
  });
  rect(g, 15, 0, 2, 1, 'k');
  box(g, 13, 34, 6, 7, 'n');
  rect(g, 14, 35, 1, 5, 't');
  return rows(g);
})();

// What has to come off the tree before it can go anywhere (AWM: abschmücken
// und von Plastik befreien). Small enough to sit on the tree's branches.
export const DECOR = {
  kugel: ['..kk..', '.kRRk.', 'kRwRRk', 'kRRRRk', 'kRRRrk', '.kkkk.'],
  kugel_gold: ['..kk..', '.kYYk.', 'kYwYYk', 'kYYYYk', 'kYYYak', '.kkkk.'],
  lametta: ['kmkGkmk', 'kGkmkGk', 'kmkGkmk', '.kGkmk.', '.kmk.k.', '..k....'],
  lichter: ['k.....k', '.kk.kk.', 'kYk.kYk', 'kyk.kyk', '.k...k.'],
  kerze: ['..k...', '.kYk..', '..k...', '.kwk..', '.kwk..', 'kGGGk.'],
  netz: ['k.k.k.k.k', '.k.k.k.k.', 'k.k.k.k.k', '.k.k.k.k.', 'k.k.k.k.k'],
  stern: ['...k...', '..kYk..', 'kkYYYkk', '.kYYYk.', '.kYkYk.', 'kk...kk'],
};

export const ROUTES = {
  wertstoffhof: (() => {
    const g = grid(24, 24);
    box(g, 1, 8, 22, 14, 'G');
    for (let x = 3; x < 22; x += 3) rect(g, x, 9, 1, 12, 'g');
    box(g, 4, 2, 16, 6, 'e');
    rect(g, 6, 4, 12, 2, 'w');
    box(g, 8, 14, 8, 8, 'K');
    return rows(g);
  })(),
  sammelstelle: (() => {
    const g = grid(24, 24);
    rect(g, 11, 6, 2, 17, 'K');
    box(g, 3, 1, 18, 9, 'w');
    put(g, 5, 2, ['...k..', '..kek.', '.keeek', 'keeeee', '..kk..']);
    put(g, 12, 2, ['...k..', '..kek.', '.keeek', 'keeeee', '..kk..']);
    rect(g, 0, 22, 24, 2, 'g');
    put(g, 2, 14, ['..kk..', '.keek.', 'keeeek', '.keek.', 'keeeek', '..nn..', '..nn..', '..nn..']);
    put(g, 16, 14, ['..kk..', '.keek.', 'keeeek', '.keek.', 'keeeek', '..nn..', '..nn..', '..nn..']);
    return rows(g);
  })(),
  schule: (() => {
    const g = grid(24, 24);
    box(g, 2, 9, 20, 13, 'y');
    for (let y = 2; y < 9; y++) rect(g, 12 - (y - 1) * 1.5, y, (y - 1) * 3, 1, 'r');
    box(g, 9, 14, 6, 8, 'n');
    box(g, 4, 11, 4, 4, 'c');
    box(g, 16, 11, 4, 4, 'c');
    box(g, 10, 4, 4, 4, 'w');
    rect(g, 11, 5, 1, 2, 'k'); rect(g, 12, 6, 1, 1, 'k');
    return rows(g);
  })(),
  strasse: (() => {
    const g = grid(24, 24);
    rect(g, 0, 15, 24, 9, 'g');
    rect(g, 0, 19, 24, 1, 'w');
    for (let x = 1; x < 24; x += 5) rect(g, x, 19, 3, 1, 'g');
    put(g, 3, 4, ['...kk...', '..keek..', '.keeeek.', '..keek..', '.keeeek.', 'keeeeeek', '...nn...', '...nn...', '...nn...', '...nn...', '...nn...']);
    box(g, 13, 2, 10, 10, 'R');
    box(g, 15, 4, 6, 6, 'w');
    for (let i = 0; i < 6; i++) g[4 + i][15 + i] = 'R';
    return rows(g);
  })(),
};

// The city behind the falling items: two onion domes are enough to say Munich.
export const SKYLINE = (() => {
  const g = grid(96, 28);
  const roof = (x, w, h, c) => { box(g, x, 28 - h, w, h, c); };
  roof(0, 14, 12, 'W'); roof(12, 10, 16, 'm'); roof(56, 12, 13, 'W'); roof(66, 14, 10, 'm'); roof(78, 18, 14, 'W');
  // Frauenkirche: two towers with domes
  [[28, 'n'], [42, 'n']].forEach(([x]) => {
    box(g, x, 8, 8, 20, 'a');
    rect(g, x + 1, 9, 1, 18, 'o');
    box(g, x + 2, 12, 4, 4, 'N');
    box(g, x + 1, 2, 6, 7, 'E');
    rect(g, x + 2, 3, 1, 4, 'e');
    rect(g, x + 3, 0, 2, 2, 'k');
  });
  box(g, 34, 16, 10, 12, 'a');
  for (let x = 2; x < 96; x += 4) for (let y = 18; y < 26; y += 4) {
    if (g[y][x] !== '.' && g[y][x] !== 'k' && g[y][x + 1] !== 'k' && g[y + 1] && g[y + 1][x] !== 'k') rect(g, x, y, 2, 2, 'c');
  }
  return rows(g);
})();
