// Picks an icon for a product from its name (English plus a few Polish/German stems).
// Matches the start of a word, so "oat" matches "oats" and "oatmeal". A trailing $ means the whole word ("gin$" matches Gin, not Ginger).
// Order matters: the first rule that matches wins, so specific groups (sweets and brands) come before broad ones (milk, nuts).
const rules = [
  ['egg', ['egg', 'jaj', 'jaja', 'eier']],
  ['fish', ['fish', 'salmon', 'tuna', 'cod', 'herring', 'shrimp', 'prawn', 'mackerel', 'sardine', 'ryb', 'łosoś', 'losos', 'tuńczyk', 'makrel', 'śledź', 'krewetk', 'lachs', 'thunfisch']],
  ['meat', ['chicken', 'turkey', 'beef', 'pork', 'ham', 'bacon', 'sausage', 'meat', 'steak', 'salami', 'kebab', 'burger', 'kurczak', 'indyk', 'wołow', 'wieprz', 'szynk', 'kiełb', 'mięs', 'parówk', 'fleisch', 'wurst', 'schinken', 'hähnchen']],
  ['carrot', ['sweet potato', 'batat', 'carrot', 'potato', 'beet', 'pumpkin', 'marchew', 'ziemniak', 'burak', 'dyni', 'möhre', 'karotte', 'kartoffel']],
  ['sweet', [
    // sweets in general
    'chocolate', 'cookie', 'biscuit', 'cake', 'candy', 'candies', 'sweet', 'sugar', 'honey', 'jam', 'ice cream', 'waffle', 'wafer', 'donut', 'doughnut', 'muffin', 'brownie', 'pudding', 'marshmallow', 'lollipop', 'gummy', 'gummies', 'jelly', 'caramel', 'toffee', 'praline', 'candy bar', 'chewing gum', 'gum', 'protein bar', 'energy bar', 'cereal bar',
    'czekolad', 'ciastk', 'ciasto', 'cukier', 'miód', 'lody', 'słodycz', 'baton', 'wafel', 'gofr', 'pączek', 'babka', 'sernik', 'tort', 'budyń', 'galaretk', 'żelk', 'pianki', 'cukierk', 'lizak', 'guma do żucia', 'karmel', 'draż', 'ptasie mleczko', 'kisiel', 'marmolad', 'dżem', 'powidła',
    'schokolade', 'keks', 'kuchen', 'zucker', 'bonbon', 'gummibär', 'kaugummi',
    // brands
    'orbit', 'wedel', 'wawel', 'milka', 'milky way', 'snickers', 'mars', 'twix', 'bounty', 'kinder', 'ferrero', 'nutella', 'haribo', 'lindt', 'toblerone', 'oreo', 'lion', 'prince polo', 'princessa', 'goplana', 'jutrzenka', 'alpen gold', 'mentos', 'tic tac', 'wrigley', 'airwaves', 'trident', 'center shock', 'chupa chups', 'fruittella', 'mamba', 'toffifee', 'raffaello', 'merci', 'lindor', 'ritter sport', 'cadbury', 'm&m', 'kitkat', 'kit kat', 'hellena', 'delicje', 'grześki', 'lubisie', 'krakuski', 'jeżyki', 'chocopie', 'balisto', 'duplo', 'hanuta', 'knoppers', 'daim', 'bueno', 'skittles', 'werther', 'ptasie', 'solidarność', 'terravita', 'goplana', 'laciate', 'sedita', 'solidarnosc', 'e. wedel',
  ]],
  ['nut', ['nut', 'peanut', 'almond', 'cashew', 'walnut', 'hazelnut', 'pistach', 'pecan', 'orzech', 'orzeszk', 'migdał', 'nuss', 'erdnuss', 'mandel']],
  ['milk', ['milk', 'yogurt', 'yoghurt', 'cheese', 'cream', 'butter', 'kefir', 'skyr', 'quark', 'whey', 'mozzarella', 'feta', 'mleko', 'jogurt', 'ser', 'śmietan', 'masło', 'twaróg', 'maślank', 'milch', 'käse', 'joghurt', 'sahne']],
  ['coffee', ['coffee', 'tea', 'juice', 'cola', 'water', 'drink', 'beer', 'wine', 'smoothie', 'lemonade', 'soda', 'energy drink', 'tonic', 'cider', 'vodka', 'whisky', 'whiskey', 'rum$', 'gin$', 'kombucha', 'espresso', 'latte', 'cappuccino',
    // soft-drink brands
    'coca-cola', 'coca cola', 'coke', 'pepsi', '7up', '7 up', 'seven up', 'sprite', 'fanta', 'mirinda', 'schweppes', 'dr pepper', 'dr. pepper', 'mountain dew', 'red bull', 'monster', 'burn$', 'rockstar', 'lipton', 'nestea', 'fuze', 'oshee', 'cappy', 'tymbark', 'hortex', 'kubuś', 'kubus', 'tonic', 'żywiec', 'cisowianka', 'nałęczowianka', 'muszynianka', 'evian', 'volvic', 'perrier', 'san pellegrino', 'gatorade', 'powerade', 'lipton', 'ice tea', 'iced tea', 'nescafe', 'nescafé', 'jacobs', 'tchibo', 'lavazza', 'costa', 'starbucks', 'lech', 'tyskie', 'żubr', 'heineken', 'carlsberg', 'corona',
    'kawa', 'herbata', 'sok', 'woda', 'napój', 'piwo', 'wino', 'lemoniad', 'kaffee', 'saft', 'wasser', 'getränk']],
  ['cherry', ['berry', 'berries', 'strawberr', 'raspberr', 'blueberr', 'cherr', 'grape', 'currant', 'forest fruit', 'jagod', 'malin', 'wiśni', 'czereśn', 'truskaw', 'porzeczk', 'winogron', 'beere', 'erdbeer', 'kirsch']],
  ['apple', [
    'apple', 'pear', 'banana', 'orange', 'mandarin', 'tangerine', 'clementine', 'grapefruit', 'lemon', 'lime', 'mango', 'peach', 'nectarine', 'apricot', 'plum', 'kiwi', 'melon', 'watermelon', 'pineapple', 'papaya', 'avocado', 'coconut', 'pomegranate', 'fig', 'dates', 'fruit',
    'jabł', 'gruszk', 'banan', 'pomarańcz', 'mandarynk', 'grejpfrut', 'cytryn', 'limonk', 'brzoskwin', 'morel', 'śliwk', 'arbuz', 'ananas', 'awokado', 'kokos', 'granat', 'owoc',
    'apfel', 'birne', 'zitrone', 'pfirsich', 'obst',
  ]],
  ['leaf', [
    'salad', 'lettuce', 'spinach', 'kale', 'broccoli', 'cabbage', 'cucumber', 'tomato', 'pepper', 'onion', 'garlic', 'zucchini', 'courgette', 'mushroom', 'celery', 'asparagus', 'cauliflower', 'radish', 'leek', 'corn', 'peas', 'beans', 'lentil', 'chickpea', 'hummus', 'vegetable', 'veggie',
    'sałat', 'szpinak', 'brokuł', 'kapust', 'ogór', 'pomidor', 'papryk', 'cebul', 'czosnek', 'cukini', 'grzyb', 'pieczark', 'seler', 'szparag', 'kalafior', 'rzodkiew', 'por', 'kukurydz', 'groch', 'fasol', 'soczewic', 'ciecierzyc', 'warzyw',
    'gemüse', 'salat', 'gurke', 'tomate', 'pilz', 'zwiebel',
  ]],
  ['grain', ['bread', 'toast', 'bun', 'roll', 'bagel', 'oat', 'barley', 'jęczmień', 'rice', 'pasta', 'noodle', 'spaghetti', 'cereal', 'muesli', 'granola', 'flour', 'wheat', 'rye', 'quinoa', 'couscous', 'tortilla', 'cracker', 'crisp', 'chleb', 'bułk', 'płatki', 'ryż', 'makaron', 'mąk', 'kasz', 'pieczyw', 'brot', 'brötchen', 'haferflocken', 'nudel', 'reis', 'mehl']],
  ['droplet', ['oil', 'olive', 'sauce', 'ketchup', 'mayo', 'dressing', 'vinegar', 'mustard', 'olej', 'oliwa', 'sos', 'majonez', 'ocet', 'musztard', 'öl', 'soße']],
];

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (w) => (w.endsWith('$') ? esc(w.slice(0, -1)) + '(?![\\p{L}])' : esc(w));
const compiled = rules.map(([icon, words]) => [icon, new RegExp(`(?:^|[^\\p{L}])(?:${words.map(alt).join('|')})`, 'iu')]);

export function foodIcon(item) {
  if (item?.source === 'recipe') return 'recipe';
  const text = item?.name ?? '';
  for (const [icon, re] of compiled) if (re.test(text)) return icon;
  return 'utensils';
}
