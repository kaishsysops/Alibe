// Alibe's category tree: the starting set, in the order people see it at every
// level (most useful first, never alphabetical). prisma/seed.ts writes it to the
// database once per TREE_VERSION; after that staff edit categories in the app
// (Profile > Categories), so the database is the truth and this is the template.
//
// Depth is unlimited: any node can have children. Slugs are unique across the
// whole tree and never change once used (listings and saved searches point at them).
//
// attributes: the questions Sell asks for this category and the filters Search
// shows for it. Children inherit their ancestors' attributes (a child can
// redefine one by using the same key).
// keywords: extra words that mean this category (search synonyms, auto-categorise).

export const TREE_VERSION = 4;

export type AttributeDef = {
  key: string;
  label: string;
  type: "select" | "number";
  options?: string[];
  // Words in a title that mean an option, e.g. iPhone -> Apple.
  aliases?: Record<string, string[]>;
  unit?: string;
};

export type CategoryNode = {
  name: string;
  slug: string;
  icon?: string;
  keywords?: string[];
  attributes?: AttributeDef[];
  children?: CategoryNode[];
};

// ---- shared attribute definitions ---------------------------------------------

const phoneBrand: AttributeDef = {
  key: "brand",
  label: "Brand",
  type: "select",
  options: ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme", "OnePlus", "Google", "Honor", "Nokia", "Motorola", "Other"],
  aliases: { Apple: ["iphone", "ipad", "apple"], Samsung: ["galaxy", "samsung"], Xiaomi: ["redmi", "poco", "xiaomi", "mi "], Google: ["pixel"], Huawei: ["huawei", "nova"] },
};
const storage: AttributeDef = { key: "storage", label: "Storage", type: "select", options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB"] };
const ram: AttributeDef = { key: "ram", label: "Memory (RAM)", type: "select", options: ["2 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "32 GB", "64 GB"] };
const laptopBrand: AttributeDef = {
  key: "brand",
  label: "Brand",
  type: "select",
  options: ["Apple", "HP", "Dell", "Lenovo", "Asus", "Acer", "MSI", "Microsoft", "Samsung", "Huawei", "Other"],
  aliases: { Apple: ["macbook", "imac", "mac mini", "apple"], Microsoft: ["surface"], Lenovo: ["thinkpad", "ideapad", "legion"], Dell: ["xps", "alienware", "inspiron", "latitude"], HP: ["hp ", "pavilion", "elitebook", "omen"], Asus: ["rog", "zenbook", "vivobook"] },
};
const tabletBrand: AttributeDef = { ...phoneBrand, options: ["Apple", "Samsung", "Xiaomi", "Huawei", "Lenovo", "Amazon", "Microsoft", "Other"], aliases: { Apple: ["ipad"], Amazon: ["kindle", "fire"], Microsoft: ["surface"] } };
const tvSize: AttributeDef = { key: "screen", label: "Screen size", type: "number", unit: "inch" };
const tvBrand: AttributeDef = { key: "brand", label: "Brand", type: "select", options: ["Samsung", "LG", "Sony", "TCL", "Hisense", "Xiaomi", "Panasonic", "Other"] };
const consoleType: AttributeDef = {
  key: "platform",
  label: "Platform",
  type: "select",
  options: ["PlayStation 5", "PlayStation 4", "Xbox Series", "Xbox One", "Nintendo Switch", "PC", "Other"],
  aliases: { "PlayStation 5": ["ps5", "playstation 5"], "PlayStation 4": ["ps4", "playstation 4"], "Xbox Series": ["xbox series"], "Nintendo Switch": ["switch", "nintendo"] },
};
const motorcycleMake: AttributeDef = {
  key: "make",
  label: "Make",
  type: "select",
  options: ["Honda", "Yamaha", "Suzuki", "TVS", "Vespa", "Piaggio", "Bajaj", "Hero", "Kymco", "SYM", "Kawasaki", "Electric (other)", "Other"],
  aliases: { Honda: ["honda", "dio", "pcx", "click", "wave"], Yamaha: ["yamaha", "nmax", "aerox", "fascino", "ray zr", "mio"], Suzuki: ["suzuki", "burgman", "access"], TVS: ["tvs", "ntorq", "jupiter", "wego"], Vespa: ["vespa"] },
};
const carMake: AttributeDef = {
  key: "make",
  label: "Make",
  type: "select",
  options: ["Toyota", "Honda", "Nissan", "Hyundai", "Kia", "Suzuki", "Mitsubishi", "BYD", "Tesla", "Mercedes-Benz", "BMW", "Other"],
  aliases: { Toyota: ["toyota", "prius", "corolla", "hiace", "vitz", "aqua"], Nissan: ["nissan", "leaf", "note"], BYD: ["byd", "atto", "dolphin"] },
};
const year: AttributeDef = { key: "year", label: "Year", type: "number" };
const mileage: AttributeDef = { key: "mileage", label: "Mileage", type: "number", unit: "km" };
const engine: AttributeDef = { key: "engine", label: "Engine size", type: "number", unit: "cc" };
const fuel: AttributeDef = { key: "fuel", label: "Fuel", type: "select", options: ["Petrol", "Diesel", "Electric", "Hybrid"], aliases: { Electric: ["electric", " ev ", "e-bike", "ebike"], Hybrid: ["hybrid"] } };
const boatLength: AttributeDef = { key: "length", label: "Length", type: "number", unit: "ft" };
const bedrooms: AttributeDef = { key: "bedrooms", label: "Bedrooms", type: "select", options: ["Studio", "1", "2", "3", "4", "5+"] };
const bathrooms: AttributeDef = { key: "bathrooms", label: "Bathrooms", type: "select", options: ["1", "2", "3", "4+"] };
const furnished: AttributeDef = { key: "furnished", label: "Furnished", type: "select", options: ["Furnished", "Semi-furnished", "Unfurnished"] };
const area: AttributeDef = { key: "area", label: "Size", type: "number", unit: "sq ft" };
const clothingSize: AttributeDef = { key: "size", label: "Size", type: "select", options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"] };
const shoeSize: AttributeDef = { key: "size", label: "Size (EU)", type: "select", options: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] };
const kidsAge: AttributeDef = { key: "age", label: "Age", type: "select", options: ["0-6 months", "6-12 months", "1-2 years", "3-4 years", "5-7 years", "8-12 years", "13+ years"] };
const jobType: AttributeDef = { key: "jobType", label: "Job type", type: "select", options: ["Full-time", "Part-time", "Contract", "Temporary", "Internship"], aliases: { "Part-time": ["part time", "part-time"], "Full-time": ["full time", "full-time"] } };
const acCapacity: AttributeDef = { key: "btu", label: "Capacity", type: "select", options: ["9000 BTU", "12000 BTU", "18000 BTU", "24000 BTU", "Other"] };

// ---- the tree -------------------------------------------------------------------

export const CATEGORY_TREE: CategoryNode[] = [
  {
    name: "Electronics",
    slug: "electronics",
    icon: "smartphone",
    keywords: ["electronic", "gadget", "device"],
    children: [
      { name: "Mobile phones", slug: "phones", icon: "smartphone", keywords: ["phone", "mobile", "iphone", "galaxy", "smartphone", "redmi", "pixel", "handphone"], attributes: [phoneBrand, storage] },
      {
        name: "Phone accessories",
        slug: "phone-accessories",
        icon: "cable",
        children: [
          { name: "Cases & covers", slug: "phone-cases", keywords: ["case", "cover", "skin", "housing", "back cover"] },
          { name: "Screen protectors", slug: "screen-protectors", keywords: ["screen protector", "screen protection", "tempered glass", "screen guard", "privacy glass"] },
          { name: "Chargers & cables", slug: "chargers-cables", keywords: ["charger", "cable", "usb", "type-c", "lightning", "adapter", "data cable", "wireless charger"] },
          { name: "Power banks", slug: "power-banks", keywords: ["power bank", "powerbank"] },
          { name: "Phone parts & repair", slug: "phone-parts", keywords: ["lcd", "display", "digitizer", "battery", "charging port", "flex cable", "camera module", "ear speaker", "back glass"] },
          { name: "Holders, stands & selfie sticks", slug: "phone-holders", keywords: ["holder", "stand", "selfie stick", "tripod", "mount"] },
          { name: "Phone numbers", slug: "phone-numbers", keywords: ["number", "sim", "vip number", "dhiraagu number", "ooredoo number"] },
        ],
      },
      {
        name: "Computers & laptops",
        slug: "computers",
        icon: "laptop",
        children: [
          { name: "Laptops", slug: "laptops", icon: "laptop", keywords: ["laptop", "notebook", "macbook", "chromebook", "thinkpad"], attributes: [laptopBrand, ram, storage] },
          { name: "Desktop computers", slug: "desktops", icon: "monitor", keywords: ["desktop", "pc", "gaming pc", "imac", "mac mini", "cpu tower"], attributes: [laptopBrand, ram, storage] },
          { name: "Monitors", slug: "monitors", keywords: ["monitor", "gaming monitor", "computer screen"] },
          { name: "Computer parts", slug: "computer-parts", keywords: ["ram", "ssd", "hard drive", "hdd", "graphics card", "gpu", "processor", "motherboard", "power supply", "psu", "memory"] },
          { name: "Keyboards & mice", slug: "keyboards-mice", keywords: ["keyboard", "mouse", "mice", "mouse pad"] },
          { name: "Printers & ink", slug: "printers", keywords: ["printer", "scanner", "ink", "toner", "cartridge"] },
          { name: "Networking & Wi-Fi", slug: "networking", keywords: ["router", "wifi", "modem", "access point", "switch", "mesh", "dongle"] },
          { name: "Storage & USB drives", slug: "storage-drives", keywords: ["pen drive", "flash drive", "usb drive", "external hard drive", "memory card", "sd card", "card reader", "usb hub"] },
          { name: "Software", slug: "software", keywords: ["software", "windows", "office", "license", "antivirus"] },
        ],
      },
      {
        name: "Tablets & e-readers",
        slug: "tablets",
        icon: "tablet",
        children: [
          { name: "Tablets", slug: "tablets-ipads", keywords: ["tablet", "ipad", "galaxy tab", "kindle"], attributes: [tabletBrand, storage] },
          { name: "Tablet accessories", slug: "tablet-accessories", keywords: ["ipad case", "tablet case", "stylus", "apple pencil", "tablet keyboard"] },
        ],
      },
      {
        name: "Audio",
        slug: "audio",
        icon: "headphones",
        children: [
          { name: "Headphones & earbuds", slug: "headphones", keywords: ["headphone", "earbuds", "airpods", "headset", "earphone", "bluetooth headset", "buds"] },
          { name: "Speakers", slug: "speakers", keywords: ["speaker", "bluetooth speaker", "jbl", "soundbar", "subwoofer"] },
          { name: "Home theatre & hi-fi", slug: "home-theatre", keywords: ["home theater", "home theatre", "amplifier", "receiver", "hi-fi"] },
          { name: "Music players & radios", slug: "music-players", keywords: ["mp3", "ipod", "radio", "walkman"] },
        ],
      },
      {
        name: "TVs & projectors",
        slug: "tv-video",
        icon: "tv",
        children: [
          { name: "Televisions", slug: "televisions", keywords: ["tv", "television", "smart tv", "led tv", "oled"], attributes: [tvBrand, tvSize] },
          { name: "Projectors", slug: "projectors", keywords: ["projector", "mini projector"] },
          { name: "TV boxes & accessories", slug: "tv-accessories", keywords: ["tv accessories", "tv box", "android box", "fire stick", "remote", "wall mount", "tv bracket", "satellite", "dish"] },
        ],
      },
      {
        name: "Cameras & drones",
        slug: "cameras",
        icon: "camera",
        children: [
          { name: "Cameras", slug: "digital-cameras", keywords: ["camera", "dslr", "mirrorless", "gopro", "camcorder", "canon", "nikon", "sony alpha"] },
          { name: "Lenses", slug: "lenses", keywords: ["lens", "lenses"] },
          { name: "Drones", slug: "drones", keywords: ["drone", "dji", "mavic"] },
          { name: "Camera accessories", slug: "camera-accessories", keywords: ["tripod", "flash", "gimbal", "camera bag", "studio light", "monopod"] },
          { name: "Security cameras & CCTV", slug: "security-cameras", keywords: ["cctv", "security camera", "surveillance", "ip camera", "dvr", "nvr", "doorbell camera", "alarm"] },
        ],
      },
      {
        name: "Video games & consoles",
        slug: "gaming",
        icon: "gamepad",
        attributes: [consoleType],
        children: [
          { name: "Consoles", slug: "consoles", keywords: ["console", "ps5", "ps4", "playstation", "xbox", "nintendo switch"] },
          { name: "Games", slug: "video-games", keywords: ["game", "games", "cd game", "digital game"] },
          { name: "Controllers & accessories", slug: "gaming-accessories", keywords: ["controller", "joystick", "gamepad", "gaming headset", "gaming chair", "steering wheel"] },
        ],
      },
      { name: "Smart watches & wearables", slug: "wearables", icon: "watch", keywords: ["smart watch", "smartwatch", "apple watch", "fitness band", "galaxy watch", "mi band"] },
      { name: "Other electronics", slug: "other-electronics", icon: "cpu", keywords: ["electronic component", "arduino", "battery", "batteries", "universal remote", "laser pointer"] },
    ],
  },
  {
    name: "Vehicles & boats",
    slug: "vehicles",
    icon: "car",
    keywords: ["vehicle"],
    children: [
      { name: "Motorcycles & scooters", slug: "motorcycles", icon: "bike", keywords: ["motorcycle", "motorbike", "scooter", "bike", "cycle", "moped", "dio", "nmax", "pcx", "yamaha", "vespa", "r15", "aerox", "burgman", "ntorq", "fascino"], attributes: [motorcycleMake, year, engine, mileage, fuel] },
      { name: "Cars & vans", slug: "cars", icon: "car", keywords: ["car", "van", "suv", "sedan", "toyota", "hiace", "prius", "corolla", "nissan", "hyundai", "kia", "byd", "tesla", "mercedes", "bmw", "porsche"], attributes: [carMake, year, mileage, fuel] },
      { name: "Pickups & lorries", slug: "pickups-lorries", icon: "truck", keywords: ["pickup", "lorry", "truck", "rashu pickup", "canter", "tipper"], attributes: [carMake, year, mileage, fuel] },
      { name: "Bicycles & e-bikes", slug: "bicycles", icon: "bicycle", keywords: ["bicycle", "e-bike", "ebike", "mountain bike", "electric bike", "bmx"] },
      {
        name: "Boats & marine",
        slug: "boats",
        icon: "ship",
        children: [
          { name: "Dhoani", slug: "dhoani", keywords: ["dhoani", "dhoni", "vadhu foshi", "fishing boat"], attributes: [boatLength, year] },
          { name: "Speedboats", slug: "speedboats", keywords: ["speedboat", "speed boat", "launch"], attributes: [boatLength, year] },
          { name: "Dinghies & small boats", slug: "dinghies", keywords: ["dinghy", "bokkura", "kayak", "canoe", "inflatable boat"] },
          { name: "Jet skis", slug: "jet-skis", keywords: ["jet ski", "jetski", "pwc", "sea doo", "waverunner"] },
          { name: "Boat engines", slug: "marine-engines", keywords: ["outboard", "boat engine", "marine engine", "yamaha outboard", "suzuki outboard"] },
          { name: "Marine equipment", slug: "marine-equipment", keywords: ["anchor", "life jacket", "navigation", "gps", "marine", "rope", "buoy"] },
        ],
      },
      {
        name: "Fishing gear",
        slug: "fishing",
        icon: "fish",
        children: [
          { name: "Rods & reels", slug: "rods-reels", keywords: ["rod", "reel", "fishing rod"] },
          { name: "Lures, hooks & line", slug: "lures-hooks", keywords: ["lure", "hook", "jig", "fishing line", "braid", "popper"] },
          { name: "Fish finders", slug: "fish-finders", keywords: ["fish finder", "sonar", "echo sounder"] },
        ],
      },
      {
        name: "Parts & accessories",
        slug: "vehicle-parts",
        icon: "wrench",
        children: [
          { name: "Motorcycle parts", slug: "motorcycle-parts", keywords: ["cover set", "exhaust", "brake", "suspension", "headlight", "mirror", "engine parts", "bike parts"] },
          { name: "Car parts", slug: "car-parts", keywords: ["car parts", "car battery", "engine", "spare parts"] },
          { name: "Car accessories", slug: "car-accessories", keywords: ["car accessories", "dash cam", "car charger", "car holder", "seat cover", "car stereo"] },
          { name: "Tyres & wheels", slug: "tyres-wheels", keywords: ["tyre", "tire", "wheel", "rim", "alloy"] },
          { name: "Helmets & riding gear", slug: "helmets", keywords: ["helmet", "riding gear", "raincoat", "gloves"] },
        ],
      },
    ],
  },
  {
    name: "Property",
    slug: "property",
    icon: "home",
    keywords: ["house", "flat", "apartment", "rent", "property"],
    children: [
      { name: "Apartments & houses for rent", slug: "rent-homes", icon: "building", keywords: ["apartment", "flat", "house for rent", "flat for rent", "apartment for rent", "studio apartment"], attributes: [bedrooms, bathrooms, furnished, area] },
      { name: "Rooms for rent", slug: "rooms", icon: "bed", keywords: ["room", "room for rent", "kudhin baithibbaadhinun", "bed space", "partition"], attributes: [furnished] },
      { name: "Roommates", slug: "roommates", icon: "users", keywords: ["roommate", "room mate", "sharing", "flatmate"] },
      { name: "Homes for sale", slug: "homes-for-sale", icon: "home", keywords: ["flat for sale", "house for sale", "apartment for sale", "home for sale", "townhouse"], attributes: [bedrooms, bathrooms, area] },
      { name: "Guest houses & short stays", slug: "guest-houses", icon: "hotel", keywords: ["guest house", "guesthouse", "short stay", "hotel", "night", "accommodation", "airbnb"] },
      { name: "Land", slug: "land", icon: "map", keywords: ["land", "plot", "lease", "island lease"], attributes: [area] },
      { name: "Offices, shops & warehouses", slug: "commercial", icon: "store", keywords: ["office", "shop", "warehouse", "commercial", "space", "godown", "cafe space"], attributes: [area] },
    ],
  },
  {
    name: "Home & appliances",
    slug: "home-garden",
    icon: "leaf",
    keywords: ["home", "household"],
    children: [
      {
        name: "Kitchen appliances",
        slug: "kitchen-appliances",
        icon: "cooking-pot",
        children: [
          { name: "Fridges & freezers", slug: "fridges", keywords: ["fridge", "refrigerator", "freezer", "chiller"] },
          { name: "Cookers & ovens", slug: "cookers-ovens", keywords: ["cooker", "stove", "oven", "hob", "gas cooker", "induction", "microwave", "convection"] },
          { name: "Blenders & mixers", slug: "blenders", keywords: ["blender", "mixer", "juicer", "food processor", "grinder"] },
          { name: "Rice cookers & steamers", slug: "rice-cookers", keywords: ["rice cooker", "steamer", "pressure cooker", "slow cooker"] },
          { name: "Kettles, coffee & tea", slug: "kettles-coffee", keywords: ["kettle", "coffee machine", "coffee maker", "espresso", "water heater"] },
          { name: "Air fryers, grills & toasters", slug: "fryers-grills", keywords: ["air fryer", "fryer", "grill", "toaster", "sandwich maker", "waffle"] },
          { name: "Water dispensers & filters", slug: "water-dispensers", keywords: ["water dispenser", "water cooler", "water filter", "purifier"] },
        ],
      },
      {
        name: "Washing & cleaning",
        slug: "laundry-cleaning",
        icon: "washing-machine",
        children: [
          { name: "Washing machines & dryers", slug: "washing-machines", keywords: ["washing machine", "washer", "dryer", "front load", "top load"] },
          { name: "Vacuum cleaners", slug: "vacuums", keywords: ["vacuum", "robot vacuum", "hoover"] },
          { name: "Irons & steamers", slug: "irons", keywords: ["iron", "ironing board", "garment steamer"] },
          { name: "Cleaning supplies", slug: "cleaning-supplies", keywords: ["mop", "broom", "detergent", "cleaning", "bin", "laundry basket", "hanger", "drying rack", "pest control"] },
        ],
      },
      {
        name: "Cooling & air",
        slug: "cooling",
        icon: "fan",
        children: [
          { name: "Air conditioners", slug: "air-conditioners", keywords: ["ac", "air conditioner", "aircon", "split ac", "inverter ac"], attributes: [acCapacity] },
          { name: "Fans", slug: "fans", keywords: ["fan", "ceiling fan", "stand fan", "table fan", "rechargeable fan"] },
          { name: "Humidifiers & air purifiers", slug: "air-purifiers", keywords: ["humidifier", "air purifier", "dehumidifier", "diffuser"] },
          { name: "Showers & water heaters", slug: "water-heaters", keywords: ["water heater", "geyser", "shower", "heater"] },
        ],
      },
      { name: "Cookware & dining", slug: "cookware", icon: "utensils", keywords: ["pot", "pan", "cookware", "plates", "cups", "glasses", "cutlery", "knife", "bakeware", "dinner set", "tableware", "lunch box", "storage container"] },
      { name: "Lighting", slug: "lighting", icon: "lamp", keywords: ["light", "lamp", "bulb", "led", "chandelier", "flashlight", "torch", "spotlight", "string light", "solar light"] },
      { name: "Home decor", slug: "home-decor", icon: "frame", keywords: ["decor", "curtain", "blind", "mirror", "clock", "carpet", "rug", "cushion", "painting", "frame", "vase", "candle", "wallpaper", "sticker"] },
      { name: "Bathroom", slug: "bathroom", icon: "bath", keywords: ["toilet", "basin", "vanity", "tap", "towel", "soap dispenser", "bathroom"] },
      { name: "Garden & plants", slug: "garden", icon: "sprout", keywords: ["plant", "tree", "garden", "flower", "seeds", "pot plant", "gardening"] },
      {
        name: "Tools & DIY",
        slug: "tools",
        icon: "hammer",
        children: [
          { name: "Power tools", slug: "power-tools", keywords: ["power tools", "drill", "grinder", "saw", "power tool", "impact driver", "makita", "bosch", "dewalt"] },
          { name: "Hand tools", slug: "hand-tools", keywords: ["hand tools", "tools", "tools equipment", "hammer", "screwdriver", "spanner", "wrench", "tool box", "toolkit", "pliers"] },
          { name: "Electrical supplies", slug: "electrical-supplies", keywords: ["wire", "switch", "socket", "extension", "breaker", "electrical"] },
          { name: "Building materials", slug: "building-materials", keywords: ["cement", "tiles", "marble", "timber", "wood", "steel", "roofing", "paint", "door", "window", "bricks", "sand", "aggregate"] },
          { name: "Generators & pumps", slug: "generators-pumps", keywords: ["generator", "pump", "compressor", "water pump", "motor"] },
        ],
      },
      { name: "Food & groceries", slug: "food", icon: "apple", keywords: ["food", "fish", "tuna", "vegetables", "fruits", "honey", "cake", "snacks", "rihaakuru", "homemade", "seafood"] },
      { name: "Sewing & crafts", slug: "sewing", icon: "scissors", keywords: ["sewing machine", "yarn", "fabric", "thread", "craft"] },
    ],
  },
  {
    name: "Furniture",
    slug: "furniture",
    icon: "sofa",
    keywords: ["furniture"],
    children: [
      { name: "Sofas & armchairs", slug: "sofas", icon: "sofa", keywords: ["sofa", "couch", "armchair", "sofa bed", "recliner", "bean bag", "sectional"] },
      { name: "Beds & mattresses", slug: "beds", icon: "bed", keywords: ["bed", "mattress", "bed frame", "bunk bed", "king bed", "queen bed"] },
      { name: "Wardrobes & storage", slug: "wardrobes-storage", icon: "archive", keywords: ["wardrobe", "cupboard", "cabinet", "drawer", "shoe rack", "bookshelf", "shelf", "storage box", "rack"] },
      { name: "Tables & dining", slug: "tables", icon: "table", keywords: ["table", "dining table", "dining set", "coffee table", "side table"] },
      { name: "Chairs & stools", slug: "chairs", icon: "armchair", keywords: ["chair", "stool", "bench", "rocking chair"] },
      { name: "Desks & office furniture", slug: "office-furniture", icon: "briefcase", keywords: ["desk", "office chair", "study table", "computer table", "conference table", "filing cabinet"] },
      { name: "TV units", slug: "tv-units", icon: "tv", keywords: ["tv rack", "tv unit", "tv stand", "tv cabinet"] },
      { name: "Dressing tables & mirrors", slug: "dressing-tables", icon: "frame", keywords: ["dressing table", "dresser", "vanity table"] },
      { name: "Kids' furniture", slug: "kids-furniture", icon: "baby", keywords: ["kids bed", "kids table", "baby cot", "crib", "kids chair"] },
      { name: "Outdoor furniture & joali", slug: "outdoor-furniture", icon: "sun", keywords: ["joali", "jolhi", "outdoor", "garden chair", "swing", "hammock"] },
      { name: "Bedding & pillows", slug: "bedding", icon: "bed", keywords: ["pillow", "bedsheet", "blanket", "duvet", "mattress topper"] },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    icon: "shirt",
    keywords: ["clothes", "clothing", "fashion"],
    children: [
      { name: "Women's clothing", slug: "womens-clothing", icon: "shirt", keywords: ["dress", "abaya", "skirt", "blouse", "women", "ladies", "hijab", "kurutha", "leggings", "lingerie"], attributes: [clothingSize] },
      { name: "Men's clothing", slug: "mens-clothing", icon: "shirt", keywords: ["men", "shirt", "t-shirt", "trousers", "jeans", "shorts", "mens"], attributes: [clothingSize] },
      { name: "Kids' clothing", slug: "kids-clothing", icon: "shirt", keywords: ["kids clothes", "boys", "girls", "children clothes"], attributes: [kidsAge] },
      { name: "Traditional wear", slug: "traditional-wear", icon: "shirt", keywords: ["buruga", "shawl", "libaas", "dhivehi libaas", "feyli", "mundu", "salwar", "saree"] },
      { name: "School uniforms", slug: "uniforms", icon: "graduation", keywords: ["uniform", "school uniform"] },
      { name: "Shoes", slug: "shoes", icon: "footprints", keywords: ["shoes", "sneakers", "sandals", "slippers", "boots", "heels", "nike", "adidas", "crocs"], attributes: [shoeSize] },
      { name: "Bags & luggage", slug: "bags", icon: "shopping-bag", keywords: ["bag", "handbag", "purse", "backpack", "luggage", "suitcase", "travel bag", "school bag", "wallet"] },
      { name: "Watches", slug: "watches", icon: "watch", keywords: ["watch", "rolex", "casio", "seiko", "g-shock"] },
      { name: "Jewellery", slug: "jewellery", icon: "gem", keywords: ["jewellery", "jewelry", "necklace", "ring", "earrings", "bracelet", "gold", "silver"] },
      { name: "Accessories", slug: "fashion-accessories", icon: "glasses", keywords: ["sunglasses", "belt", "cap", "hat", "umbrella", "hair accessories", "tie", "scarf"] },
      { name: "Sportswear & swimwear", slug: "sportswear", icon: "shirt", keywords: ["swimwear", "rash guard", "jersey", "gym wear", "tracksuit", "burkini"] },
    ],
  },
  {
    name: "Health & beauty",
    slug: "health-beauty",
    icon: "heart-pulse",
    keywords: ["beauty", "health"],
    children: [
      { name: "Skin care", slug: "skin-care", keywords: ["skin care", "skincare", "moisturizer", "serum", "sunscreen", "cleanser", "toner", "face wash", "acne"] },
      { name: "Hair care", slug: "hair-care", keywords: ["hair", "shampoo", "conditioner", "hair dryer", "straightener", "curler", "hair oil"] },
      { name: "Makeup", slug: "makeup", keywords: ["makeup", "lipstick", "foundation", "mascara", "eyeliner", "palette", "lip gloss"] },
      { name: "Fragrances", slug: "fragrances", keywords: ["perfume", "fragrance", "attar", "oud", "cologne", "body spray"] },
      { name: "Shavers & trimmers", slug: "shavers", keywords: ["shaver", "trimmer", "clipper", "razor", "epilator", "wax"] },
      { name: "Personal care", slug: "personal-care", keywords: ["toothbrush", "oral care", "feminine", "deodorant", "nail", "manicure"] },
      { name: "Health & medical", slug: "medical", keywords: ["blood pressure", "glucose", "thermometer", "first aid", "wheelchair", "mask", "sanitizer", "medical", "test strips"] },
      { name: "Vitamins & supplements", slug: "supplements", keywords: ["vitamin", "supplement", "protein", "whey", "weight loss", "collagen"] },
      { name: "Massage & relaxation", slug: "massage", keywords: ["massage", "massager", "massage gun", "foot spa"] },
    ],
  },
  {
    name: "Baby & kids",
    slug: "baby-kids",
    icon: "baby",
    keywords: ["baby", "kids", "children"],
    children: [
      { name: "Strollers & car seats", slug: "strollers", keywords: ["stroller", "pram", "car seat", "walker", "baby carrier"] },
      { name: "Feeding", slug: "baby-feeding", keywords: ["bottle", "breast pump", "high chair", "steriliser", "baby food", "formula"] },
      { name: "Nursery & bedding", slug: "nursery", keywords: ["cot", "crib", "baby bed", "playpen", "nursery", "baby mattress"] },
      { name: "Bathing & diapers", slug: "diapering", keywords: ["diaper", "nappy", "baby bath", "wipes"] },
      { name: "Toys", slug: "toys", keywords: ["toy", "toys", "doll", "lego", "teddy", "puzzle", "educational toy", "rc car", "remote control car"], attributes: [kidsAge] },
      { name: "Maternity", slug: "maternity", keywords: ["maternity", "pregnancy", "nursing"] },
    ],
  },
  {
    name: "Sports & hobbies",
    slug: "sports-hobbies",
    icon: "trophy",
    keywords: ["sport", "sports", "hobby"],
    children: [
      { name: "Gym & fitness", slug: "fitness", icon: "dumbbell", keywords: ["gym", "dumbbell", "treadmill", "weights", "exercise bike", "yoga", "fitness", "bench press"] },
      {
        name: "Water sports & diving",
        slug: "water-sports",
        icon: "waves",
        children: [
          { name: "Diving & snorkelling", slug: "diving", keywords: ["dive", "diving", "snorkel", "mask", "fins", "bcd", "regulator", "wetsuit", "dive computer"] },
          { name: "Surfing & paddle boards", slug: "surfing", keywords: ["surf", "surfboard", "paddle board", "sup", "bodyboard", "kitesurf", "wakeboard"] },
          { name: "Swimming", slug: "swimming", keywords: ["swim", "goggles", "swimming"] },
        ],
      },
      { name: "Football & team sports", slug: "team-sports", icon: "trophy", keywords: ["football", "boots", "basketball", "volleyball", "cricket", "jersey", "futsal", "ball"] },
      { name: "Racket sports", slug: "racket-sports", icon: "trophy", keywords: ["badminton", "tennis", "table tennis", "racket", "padel", "squash"] },
      { name: "Scooters & skating", slug: "skating", icon: "bike", keywords: ["kick scooter", "skateboard", "roller skates", "hoverboard", "self balancing"] },
      { name: "Camping & outdoors", slug: "outdoors", icon: "tent", keywords: ["tent", "camping", "cooler box", "hiking", "binoculars"] },
      {
        name: "Music & instruments",
        slug: "music",
        icon: "music",
        children: [
          { name: "Guitars & strings", slug: "guitars", keywords: ["guitar", "ukulele", "violin", "bass"] },
          { name: "Keyboards & pianos", slug: "pianos", keywords: ["piano", "keyboard", "organ", "synth"] },
          { name: "Drums & bodu beru", slug: "drums", keywords: ["drum", "bodu beru", "percussion", "cajon"] },
          { name: "Audio & recording", slug: "recording", keywords: ["microphone", "mic", "audio interface", "mixer", "karaoke", "dj", "studio"] },
        ],
      },
      { name: "Board games & puzzles", slug: "board-games", icon: "dice", keywords: ["board game", "chess", "carrom", "cards", "puzzle", "monopoly"] },
      { name: "RC & models", slug: "rc-models", icon: "plane", keywords: ["rc", "remote control", "drone toy", "model", "diecast", "hot wheels"] },
      { name: "Collectibles & antiques", slug: "collectibles", icon: "gem", keywords: ["collectible", "antique", "coin", "stamp", "souvenir", "memorabilia", "vintage"] },
      { name: "Gifts & party", slug: "gifts", icon: "gift", keywords: ["gift", "party", "balloons", "decoration", "hamper"] },
    ],
  },
  {
    name: "Books, office & school",
    slug: "books-office",
    icon: "book-open",
    keywords: ["book", "office", "school"],
    children: [
      { name: "Books", slug: "books", icon: "book-open", keywords: ["book", "novel", "fiction", "quran", "textbook", "comic", "manga"] },
      { name: "School books & supplies", slug: "school-supplies", icon: "graduation", keywords: ["textbook", "school", "exercise book", "calculator", "geometry box", "o level", "a level"] },
      { name: "Stationery", slug: "stationery", icon: "pen", keywords: ["pen", "pencil", "paper", "notebook", "marker", "tape", "glue", "stapler", "file"] },
      { name: "Art supplies", slug: "art-supplies", icon: "palette", keywords: ["paint", "canvas", "brush", "colour pencils", "sketch"] },
      { name: "Office equipment", slug: "office-equipment", icon: "printer", keywords: ["shredder", "copier", "laminator", "projector screen", "whiteboard"] },
    ],
  },
  {
    name: "Pets & animals",
    slug: "pets",
    icon: "paw",
    keywords: ["pet", "animal"],
    children: [
      { name: "Cats", slug: "cats", keywords: ["cat", "kitten", "persian"] },
      { name: "Birds", slug: "birds", keywords: ["bird", "parrot", "lovebird", "budgie", "pigeon", "chicken", "hen"] },
      { name: "Fish & aquariums", slug: "aquariums", keywords: ["aquarium", "fish tank", "goldfish", "guppy", "tank filter"] },
      { name: "Other animals", slug: "other-animals", keywords: ["rabbit", "hamster", "goat", "turtle"] },
      { name: "Pet food & supplies", slug: "pet-supplies", keywords: ["cat food", "pet food", "litter", "cage", "pet carrier", "collar"] },
    ],
  },
  {
    name: "Business & industrial",
    slug: "business",
    icon: "factory",
    keywords: ["business", "industrial", "commercial"],
    children: [
      { name: "Restaurant & café equipment", slug: "restaurant-equipment", icon: "utensils", keywords: ["restaurant", "cafe", "commercial fridge", "ice machine", "display fridge", "deep fryer", "coffee machine", "oven", "chiller", "beverage"] },
      { name: "Shop & POS equipment", slug: "pos-retail", icon: "store", keywords: ["pos", "barcode", "receipt printer", "cash drawer", "label printer", "display rack", "shelving", "mannequin"] },
      { name: "Industrial tools & machinery", slug: "machinery", icon: "hammer", keywords: ["machine", "machinery", "welding", "compressor", "industrial", "forklift"] },
      { name: "Businesses for sale", slug: "businesses-for-sale", icon: "briefcase", keywords: ["business for sale", "shop for sale", "cafe for sale", "website for sale", "running business"] },
    ],
  },
  {
    name: "Services",
    slug: "services",
    icon: "wrench",
    keywords: ["service", "services"],
    children: [
      {
        name: "Home repairs & building",
        slug: "home-services",
        icon: "hammer",
        children: [
          { name: "AC servicing & repair", slug: "ac-service", keywords: ["ac service", "ac servicing", "ac repair", "aircon servicing", "ac installation", "ac cleaning"] },
          { name: "Electrical & wiring", slug: "electrician", keywords: ["electrician", "wiring", "electrical work"] },
          { name: "Plumbing", slug: "plumbing", keywords: ["plumber", "plumbing", "pipe", "leak"] },
          { name: "Carpentry & furniture making", slug: "carpentry", keywords: ["carpenter", "carpentry", "furniture making", "cabinet making"] },
          { name: "Building & renovation", slug: "construction", keywords: ["construction", "building", "renovation", "mason", "painting", "tiling", "welding", "architect", "interior design"] },
          { name: "Appliance repair", slug: "appliance-repair", keywords: ["washing machine repair", "fridge repair", "dhonna machine", "tv repair", "repair"] },
        ],
      },
      { name: "Cleaning & housekeeping", slug: "cleaning-services", icon: "sparkles", keywords: ["cleaning", "housekeeping", "maid", "laundry", "pest control"] },
      { name: "Tuition & classes", slug: "tuition", icon: "graduation", keywords: ["tuition", "tutor", "class", "lessons", "quran class", "driving class", "training", "coaching"] },
      { name: "Moving, delivery & cargo", slug: "moving", icon: "truck", keywords: ["movers", "moving", "delivery", "courier", "cargo", "transport", "logistics"] },
      { name: "Phone & computer repair", slug: "tech-repair", icon: "smartphone", keywords: ["phone repair", "unlocking", "computer repair", "laptop repair", "screen replacement", "networking", "camera repair"] },
      { name: "Design, photo & printing", slug: "creative-services", icon: "camera", keywords: ["graphic design", "web design", "photography", "videography", "printing", "signboard", "logo", "software development", "web hosting"] },
      { name: "Business services", slug: "business-services", icon: "briefcase", keywords: ["accounting", "audit", "legal", "lawyer", "consulting", "marketing", "advertising", "recruitment", "secretarial"] },
      { name: "Events & catering", slug: "events", icon: "party", keywords: ["catering", "wedding", "party planner", "event", "decoration", "sound and lighting", "dj", "venue", "cake order"] },
      { name: "Rentals & trips", slug: "rentals", icon: "ship", keywords: ["rent", "rental", "boat rental", "car rental", "motorcycle rental", "picnic", "fishing trip", "excursion", "speedboat hire"] },
      { name: "Beauty & wellness", slug: "beauty-services", icon: "sparkles", keywords: ["salon", "spa", "henna", "massage service", "barber", "bridal makeup"] },
      { name: "Other services", slug: "other-services", icon: "wrench", keywords: ["service"] },
    ],
  },
  {
    name: "Jobs",
    slug: "jobs",
    icon: "briefcase",
    keywords: ["job", "vacancy", "hiring", "work", "career"],
    attributes: [jobType],
    children: [
      { name: "Resort & hospitality", slug: "hospitality-jobs", keywords: ["resort", "hotel", "waiter", "chef", "cook", "housekeeper", "front office", "barista"] },
      { name: "Office & admin", slug: "office-jobs", keywords: ["admin", "accountant", "receptionist", "office", "secretary", "hr"] },
      { name: "Sales & shops", slug: "sales-jobs", keywords: ["sales", "cashier", "shop assistant", "marketing"] },
      { name: "Drivers & delivery", slug: "driver-jobs", keywords: ["driver", "delivery rider", "captain", "boat crew"] },
      { name: "Construction & technical", slug: "technical-jobs", keywords: ["technician", "electrician", "mason", "welder", "mechanic", "engineer"] },
      { name: "IT & design", slug: "it-jobs", keywords: ["developer", "programmer", "designer", "it support"] },
      { name: "Teaching & health", slug: "teaching-health-jobs", keywords: ["teacher", "nurse", "doctor", "tutor", "caregiver"] },
      { name: "Other jobs", slug: "other-jobs", keywords: ["job"] },
    ],
  },
  { name: "Other", slug: "other", icon: "package", keywords: ["other", "misc", "free"] },
];

// ---- helpers shared by the server and seed --------------------------------------

export function flattenTree(nodes: CategoryNode[], parentSlug: string | null = null, out: Array<CategoryNode & { parentSlug: string | null; sortOrder: number }> = []) {
  nodes.forEach((n, i) => {
    out.push({ ...n, parentSlug, sortOrder: i });
    if (n.children) flattenTree(n.children, n.slug, out);
  });
  return out;
}
