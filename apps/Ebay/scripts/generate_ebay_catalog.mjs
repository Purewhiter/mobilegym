import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd(), 'apps', 'Ebay', 'data');
const categoriesPath = path.join(root, 'categories.json');
const productsPath = path.join(root, 'products.json');

const params = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const perType = Number(params.perType ?? 120);
const seedBase = Number(params.seed ?? 42);

const LOCATIONS = ['中国', '美国', '澳大利亚', '英国', '德国', '日本'];

function randFactory(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const rand = randFactory(seedBase);

function priceBaseForType(typeId) {
  const map = {
    fan: 120,
    laptop: 5000,
    tv: 3500,
    watch: 1200,
    phone: 4000,
    tablet: 3000,
    camera: 4500,
    headphones: 800,
    sofa: 2000,
    lamp: 200,
    desk: 800,
    chair: 900,
    vacuum: 1500,
    sneaker: 600,
    dress: 300,
    sunglasses: 500,
    'watch-fashion': 900,
    bag: 2000,
    pickup: 120000,
    'radiator-fan': 800,
    tire: 1200,
    engine: 1000,
    dumbbell: 300,
    'yoga-mat': 150,
    bicycle: 2500,
    treadmill: 7000,
    'pet-bed': 300,
    'dog-food': 200,
    'cat-litter': 180,
    ticket: 3500,
    luggage: 1200,
    'gift-card': 500,
    voucher: 300,
    ring: 5000,
    necklace: 4500,
  };
  return map[typeId] ?? 500;
}

function generate() {
  const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  const items = [];
  let id = 1;
  const now = Date.now();

  for (const cat of categories) {
    for (const type of cat.types) {
      const base = priceBaseForType(type.id);
      const brands = type.brands ?? ['Generic'];
      for (let i = 0; i < perType; i++) {
        const brand = brands[i % brands.length];
        const tier = 1 + (i % 5);
        const price = Math.round((base * (0.6 + tier * 0.15) + rand() * base * 0.1) * 100) / 100;
        const shippingChoices = [0, 25, 45, 65];
        const shipping = shippingChoices[i % shippingChoices.length];
        const freeShipping = shipping === 0;
        const conditions = ['全新', '二手', '翻新'];
        const condition = conditions[i % conditions.length];
        const buyingFormats = ['buyItNow', 'auction', 'offer'];
        const buyingFormat = buyingFormats[i % buyingFormats.length];
        const distanceKm = Math.floor(rand() * 3000);
        const location = LOCATIONS[i % LOCATIONS.length];
        const dateListed = now - Math.floor(rand() * 90 * 24 * 3600 * 1000);
        const endingSoon = now + Math.floor(rand() * 90 * 24 * 3600 * 1000);
        const originalPrice = rand() > 0.6 ? Math.round(price * 1.2 * 100) / 100 : undefined;
        const isSponsored = rand() > 0.95;
        const sales = rand() > 0.7 ? `已售出 ${Math.floor(rand() * 2000)}+` : undefined;

        const title = `${brand} ${type.label} ${cat.label} ${i + 1}`;

        items.push({
          id: String(id++),
          title,
          categoryId: cat.id,
          categoryLabel: cat.label,
          typeId: type.id,
          typeLabel: type.label,
          brand,
          condition,
          price,
          originalPrice,
          shipping,
          freeShipping,
          buyingFormat,
          dateListed,
          endingSoon,
          distanceKm,
          location,
          sales,
          isSponsored,
          image: type.image,
        });
      }
    }
  }

  fs.writeFileSync(productsPath, JSON.stringify(items, null, 2));
  console.log(`Generated ${items.length} items into ${productsPath}`);
}

generate();

