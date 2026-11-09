export const categories = [
  {
    id: "trees",
    name: "Ялинки",
    caption: "Там, де починається свято",
    image: "/trees.webp",
  },
  {
    id: "decor",
    name: "Різдвяні прикраси",
    caption: "Маленькі деталі великої радості",
    image: "/hero.webp",
  },
  {
    id: "wreaths",
    name: "Вінки",
    caption: "Тепла зустріч біля ваших дверей",
    image: "/wreaths.webp",
  },
  {
    id: "treats",
    name: "Новорічні смаколики",
    caption: "Ікра до особливого столу",
    image: "/treats.webp",
  },
];
export function categoryId(value = "") {
  if (categories.some((c) => c.id === value)) return value;
  if (/ікр|смакол|делікат/i.test(value)) return "treats";
  if (/він|віно/i.test(value)) return "wreaths";
  if (/ялинки|сосн|литі|штучн/i.test(value)) return "trees";
  return "decor";
}
export const money = (value) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value) +
  " ₴";
export const productUrl = (p) =>
  "/product/" + encodeURIComponent(p.slug || p.id);
export const demoProducts = [
  {
    id: "tree-forest",
    name: "Ялинка «Лісова казка»",
    category: "trees",
    price: 4290,
    detail:
      "Демонстраційний товар. Пишна ялинка для затишних сімейних свят. Фактичні розміри, матеріал і комплектацію продавець додає до каталогу.",
    image: "/trees.webp",
  },
  {
    id: "ruby",
    name: "Куля «Гранат»",
    category: "decor",
    price: 290,
    detail:
      "Демонстраційний товар. Рубінове скло з виразними рельєфними гранями. Діаметр 8 см.",
    image: "/art/0.svg",
  },
  {
    id: "drop",
    name: "Підвіска «Крапля»",
    category: "decor",
    price: 340,
    detail:
      "Демонстраційний товар. Золотиста підвіска видовженої форми. Висота 12 см.",
    image: "/art/1.svg",
  },
  {
    id: "star",
    name: "Зірка «Вечірня»",
    category: "decor",
    price: 260,
    detail: "Демонстраційний товар. Зірка кольору шампанського. Ширина 9 см.",
    image: "/art/2.svg",
  },
  {
    id: "wreath",
    name: "Вінок «Різдвяна зустріч»",
    category: "wreaths",
    price: 1290,
    detail:
      "Демонстраційний товар. Різдвяний вінок для оформлення оселі. Комплектацію та розміри потрібно уточнити в каталозі.",
    image: "/wreaths.webp",
  },
  {
    id: "caviar",
    name: "Ікра до святкового столу",
    category: "treats",
    price: 790,
    detail:
      "Демонстраційний товар. Перед продажем необхідно вказати виробника, вид ікри, склад, вагу, термін придатності та температурний режим.",
    image: "/treats.webp",
  },
].map((p) => ({ ...p, images: [p.image], available: true, slug: p.id }));
