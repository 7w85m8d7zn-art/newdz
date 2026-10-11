import type { Menu } from "@/types/menu"

type MenuProductSeed = readonly [name: string, slug: string, price: number]

const categorySeeds: ReadonlyArray<{
  id: string
  name: string
  products: ReadonlyArray<MenuProductSeed>
}> = [
  {
    id: "cat-dondurmalar",
    name: "Dondurmalar",
    products: [
      ["Fıstıklı Dondurma", "fistikli-dondurma", 700],
      ["Ballı ve Bademli", "balli-ve-bademli", 700],
      ["Meyveli Dondurma Çeşitleri", "meyveli-dondurma-cesitleri", 550],
      ["Sade Dondurma", "sade-dondurma", 400],
    ],
  },
  {
    id: "cat-baklava-kg",
    name: "Baklava (kg)",
    products: [
      ["Şöbiyet", "sobiyet", 800],
      ["Soğuk Baklava", "soguk-baklava", 700],
      ["Fıstıkzade", "fistikzade", 800],
      ["Sarma", "sarma", 800],
      ["Havuç", "havuc", 800],
      ["Midye Baklava", "midye-baklava", 800],
      ["Fıstıklı Baklava", "fistikli-baklava", 700],
    ],
  },
  {
    id: "cat-dondurma-porsiyon",
    name: "Dondurma (Porsiyon)",
    products: [
      ["Sade Dondurma (Porsiyon)", "sade-dondurma-porsiyon", 80],
      ["Ballı ve Bademli (Porsiyon)", "balli-ve-bademli-porsiyon", 120],
      [
        "Meyveli Dondurma Çeşitleri (Porsiyon)",
        "meyveli-dondurma-cesitleri-porsiyon",
        100,
      ],
    ],
  },
  {
    id: "cat-porsiyon-tatli",
    name: "Porsiyon Tatlı",
    products: [
      ["Şöbiyet (Porsiyon)", "sobiyet-porsiyon", 200],
      ["Soğuk Baklava (Porsiyon)", "soguk-baklava-porsiyon", 150],
      ["Fıstıkzade (Porsiyon)", "fistikzade-porsiyon", 200],
      ["Sarma (Porsiyon)", "sarma-porsiyon", 200],
      ["Havuç (Porsiyon)", "havuc-porsiyon", 200],
      ["Midye Baklava (Porsiyon)", "midye-baklava-porsiyon", 200],
      ["Fıstıklı Baklava (Porsiyon)", "fistikli-baklava-porsiyon", 150],
      ["Şıllık", "sillik", 150],
    ],
  },
  {
    id: "cat-tepsi-tatli",
    name: "Tepsi Tatlı",
    products: [
      ["Cevizli Şıllık", "cevizli-sillik", 550],
      ["Fıstıklı Şıllık", "fistikli-sillik", 650],
      ["Katmer", "katmer", 650],
      ["Hasır", "hasir", 650],
      ["Kadayıf", "kadayif", 500],
    ],
  },
  {
    id: "cat-icecekler",
    name: "İçecekler",
    products: [
      ["Kola, Fanta vs.", "kola-fanta-vs", 70],
      ["Su", "su", 20],
    ],
  },
]

const karakopruMenu: Menu = {
  id: "menu-karakopru",
  name: "Karaköprü Menüsü",
  description: "Dondurmacı Zeki Karaköprü güncel menüsü.",
  categories: categorySeeds.map((category) => ({
    id: category.id,
    name: category.name,
    description: "",
    products: category.products.map(([name, slug, price]) => ({
      id: `product-${slug}`,
      name,
      description: "",
      price,
      imageUrl: `/menu-products/${slug}.jpg`,
      isActive: true,
    })),
  })),
}

export function buildDondurmaciMenu(): Menu {
  return karakopruMenu
}
