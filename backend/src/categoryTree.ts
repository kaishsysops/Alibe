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

export const TREE_VERSION = 6;

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
      { name: "Lighting", slug: "lighting", icon: "lamp", keywords: ["lights", "lamp", "bulb", "led", "chandelier", "flashlight", "torch", "spotlight", "string light", "solar light"] },
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

// ---- more words per category ----------------------------------------------------
// Everyday names for things people sell, so "lantern", "seashells" or "rice"
// land somewhere sensible without AI. Merged into each category's keywords
// when the tree is written (never replacing words staff added).
export const EXTRA_KEYWORDS: Record<string, string[]> = {
  phones: ["nokia", "oppo", "vivo", "realme", "oneplus", "huawei", "infinix", "tecno", "feature phone", "dual sim"],
  "phone-cases": ["magsafe case", "silicone case", "wallet case", "flip cover", "bumper"],
  "chargers-cables": ["fast charger", "charging cable", "usb c", "usb-c", "car charger", "wall charger", "magsafe charger", "adapter plug", "multi plug"],
  "phone-parts": ["replacement screen", "back panel", "phone battery", "motherboard phone"],
  laptops: ["macbook air", "macbook pro", "gaming laptop", "ultrabook", "thinkpad", "zenbook", "vivobook", "ideapad", "pavilion", "elitebook", "chromebook"],
  desktops: ["all in one", "computer set", "cpu", "gaming rig", "workstation"],
  monitors: ["led monitor", "curved monitor", "4k monitor", "144hz"],
  "computer-parts": ["nvme", "ram stick", "ddr4", "ddr5", "rtx", "gtx", "radeon", "ryzen", "intel core", "cpu cooler", "pc case", "fan rgb"],
  printers: ["inkjet", "laser printer", "photocopier", "epson", "canon printer", "hp printer", "brother printer", "ink tank"],
  networking: ["wifi router", "4g router", "5g router", "mifi", "extender", "lan cable", "ethernet"],
  "storage-drives": ["usb", "flash disk", "ssd external", "hdd external", "micro sd"],
  "tablets-ipads": ["ipad air", "ipad pro", "ipad mini", "galaxy tab", "android tablet", "drawing tablet", "e-reader"],
  headphones: ["earphones", "earpods", "beats", "sony wh", "noise cancelling", "neckband", "gaming headset"],
  speakers: ["boombox", "party speaker", "portable speaker", "marshall", "bose", "sound system", "subwoofer", "amp"],
  televisions: ["led tv", "smart television", "android tv", "lg tv", "samsung tv", "tcl"],
  projectors: ["projector screen", "beamer"],
  "digital-cameras": ["camera body", "film camera", "polaroid", "instax", "action camera", "insta360", "fujifilm"],
  drones: ["dji mini", "dji air", "fpv"],
  "camera-accessories": ["ring light", "softbox", "camera strap", "sd card camera", "lens filter", "underwater housing"],
  "security-cameras": ["wifi camera", "baby monitor", "smart doorbell", "intercom", "door lock", "smart lock"],
  consoles: ["ps3", "xbox 360", "switch lite", "steam deck", "game boy", "handheld console"],
  "video-games": ["fifa", "fc 24", "fc 25", "gta", "call of duty", "game disc", "game cd"],
  "gaming-accessories": ["dualsense", "joy con", "racing wheel", "gaming mouse", "gaming keyboard", "vr headset", "oculus", "quest"],
  wearables: ["fitbit", "garmin", "smart band", "smart ring", "airtag", "tracker"],
  "other-electronics": ["calculator", "walkie talkie", "radio", "extension cord", "ups", "inverter", "solar panel", "battery charger", "voltage stabilizer", "led strip"],
  motorcycles: ["moped", "e-scooter", "electric scooter", "zuma", "jog", "lead", "beat", "vario", "nmax", "mio", "honda click", "pcx 160", "adv"],
  cars: ["car for sale", "sedan", "hatchback", "suv", "kia", "picanto", "i10", "vitz", "alto", "swift", "buggy", "golf cart"],
  "pickups-lorries": ["dyna", "hilux", "pickup truck", "lorry", "truck", "tipper", "crane truck", "van cargo"],
  bicycles: ["cycle", "bike for kids", "fixie", "road bike", "folding bike"],
  dhoani: ["fishing vessel", "bokkura", "dhoni boat", "launch boat"],
  speedboats: ["boat for sale", "yacht", "catamaran", "ferry boat"],
  dinghies: ["kayak", "paddle boat", "rubber boat", "zodiac"],
  "marine-engines": ["outboard motor", "mercury", "yamaha 40", "suzuki 140", "inboard", "boat motor"],
  "marine-equipment": ["life jacket", "life vest", "mooring rope", "boat cover", "gps marine", "echo sounder", "boat seat", "bilge pump", "propeller"],
  "rods-reels": ["fishing rod", "spinning reel", "jigging reel", "shimano", "daiwa", "penn", "handline"],
  "lures-hooks": ["jig", "squid jig", "popper lure", "sinker", "swivel", "fishing net", "cast net", "bait"],
  "motorcycle-parts": ["side mirror", "brake pad", "chain sprocket", "air filter", "spark plug", "seat cover bike", "carrier box", "top box"],
  "car-parts": ["bumper", "headlight", "brake", "radiator", "alternator", "car seat cover"],
  "car-accessories": ["dashcam", "car perfume", "phone holder car", "car vacuum", "jump starter"],
  "tyres-wheels": ["tube", "tyre", "tire", "rims", "wheel cover"],
  helmets: ["full face helmet", "half helmet", "rain coat", "riding jacket", "gloves bike"],
  "rent-homes": ["2 bedroom", "3 bedroom", "1 bedroom", "2br", "3br", "1br", "bhk", "penthouse", "villa rent", "house rent", "flat rent"],
  rooms: ["single room", "shared room", "room available", "partition room", "staff room", "bed space"],
  "homes-for-sale": ["flat sale", "apartment sale", "villa sale", "house sale"],
  "guest-houses": ["hotel room", "resort", "guesthouse", "per night", "booking"],
  land: ["plot", "lease land", "island for lease", "agricultural land"],
  commercial: ["shop space", "office space", "warehouse", "store room", "cafe space", "restaurant space", "commercial space"],
  fridges: ["refrigerator", "mini fridge", "deep freezer", "double door fridge", "side by side"],
  "cookers-ovens": ["gas stove", "cooktop", "hob", "microwave oven", "electric oven", "induction cooker", "gas cylinder", "lpg"],
  blenders: ["juicer", "mixer grinder", "food processor", "hand blender", "stand mixer", "chopper"],
  "rice-cookers": ["rice cooker", "pressure cooker", "multi cooker", "slow cooker", "steamer"],
  "kettles-coffee": ["electric kettle", "coffee machine", "nespresso", "coffee grinder", "tea maker"],
  "fryers-grills": ["air fryer", "deep fryer", "bbq grill", "griller", "sandwich maker", "toaster", "waffle maker", "popcorn maker"],
  "water-dispensers": ["water purifier", "ro filter", "water cooler", "dispenser"],
  "washing-machines": ["front load", "top load", "dryer", "washer dryer"],
  vacuums: ["vacuum cleaner", "robot vacuum", "steam mop", "pressure washer"],
  "cleaning-supplies": ["detergent", "mop bucket", "broom", "trash bin", "dustbin", "laundry basket", "cloth hanger", "drying rack", "insect killer", "mosquito"],
  "air-conditioners": ["air conditioner", "split ac", "inverter ac", "portable ac", "ac unit", "window ac"],
  fans: ["ceiling fan", "stand fan", "table fan", "wall fan", "exhaust fan", "tower fan", "rechargeable fan", "air cooler"],
  "water-heaters": ["geyser", "water heater", "shower heater", "instant heater"],
  cookware: ["frying pan", "pot set", "non stick", "wok", "knife set", "cutting board", "plates", "bowls", "mugs", "glasses", "cutlery set", "spoons", "flask", "thermos", "water bottle", "lunch box", "tupperware", "baking tray", "cake mould", "dinner set", "tea set"],
  lighting: ["lantern", "lanterns", "lamp", "lamps", "lights", "bulb", "led bulb", "tube light", "flashlight", "torch", "headlamp", "spotlight", "floodlight", "solar light", "fairy lights", "string lights", "night light", "desk lamp", "floor lamp", "chandelier", "pendant light", "emergency light", "camping lantern", "candle lamp"],
  "home-decor": ["seashell", "seashells", "shell", "shells", "sea shell", "conch", "coral", "coral art", "driftwood", "decor", "decoration", "ornament", "vase", "artificial flowers", "wall art", "painting", "canvas print", "photo frame", "mirror", "wall clock", "clock", "rug", "carpet", "doormat", "curtains", "blinds", "cushion", "cushion cover", "table runner", "candle", "candles", "candle holder", "incense", "diffuser", "figurine", "statue", "showpiece", "wind chime", "dream catcher", "home fragrance", "wallpaper", "wall sticker", "lacquer work", "liyelaa jehun"],
  bathroom: ["shower head", "bath mat", "towel rack", "toilet seat", "wash basin", "mixer tap", "bathroom cabinet", "bucket", "water tank"],
  garden: ["plants", "plant", "plant pot", "flower pot", "seeds", "soil", "fertilizer", "hose", "garden tools", "lawn mower", "grass cutter", "coconut tree", "palm", "orchid", "bonsai", "succulent", "cactus", "hydroponic", "planter"],
  "power-tools": ["cordless drill", "angle grinder", "circular saw", "jigsaw", "sander", "heat gun", "rotary hammer", "chainsaw", "welding machine", "nail gun"],
  "hand-tools": ["tools", "toolbox", "spanner set", "socket set", "screwdrivers", "measuring tape", "spirit level", "ladder", "wheelbarrow", "crowbar", "saw", "axe", "machete"],
  "electrical-supplies": ["cable", "wires", "switch board", "db box", "circuit breaker", "plug", "socket", "extension board", "conduit"],
  "building-materials": ["plywood", "blocks", "coral stone", "roofing sheet", "gi sheet", "rebar", "pipes", "pvc pipe", "door frame", "window frame", "glass sheet", "aluminium", "paint bucket", "primer", "tile adhesive", "grout"],
  "generators-pumps": ["generator", "genset", "water pump", "pressure pump", "air compressor", "motor pump", "submersible pump", "solar inverter"],
  food: ["rice", "flour", "sugar", "dried fish", "valhoamas", "rihaakuru", "tuna", "fresh fish", "reef fish", "lobster", "crab", "octopus", "chicken", "eggs", "bread", "bakery", "cake", "cupcakes", "cookies", "short eats", "hedhikaa", "bajiya", "gulha", "kulhi boakibaa", "bondibaiy", "chips", "snacks", "sweets", "chocolate", "coffee beans", "tea", "spices", "chili", "lemon", "coconut", "coconut oil", "kurumba", "banana", "papaya", "breadfruit", "mango", "watermelon", "vegetables", "fruits", "juice", "drinks", "water bottles", "honey", "jam", "pickle", "homemade food", "catering food", "frozen food", "meal"],
  sewing: ["sewing machine", "fabric", "cloth material", "thread", "needle", "embroidery", "knitting", "crochet", "beads", "craft supplies"],
  sofas: ["couch", "sofa set", "l shape sofa", "recliner", "loveseat", "ottoman", "bean bag"],
  beds: ["single bed", "double bed", "queen bed", "king bed", "bunk bed", "bed frame", "mattress", "spring mattress", "foam mattress", "sofa cum bed"],
  "wardrobes-storage": ["wardrobe", "almirah", "cupboard", "cabinet", "chest of drawers", "shoe rack", "bookshelf", "shelf", "storage box", "plastic drawers", "kitchen cabinet", "display cabinet"],
  tables: ["dining table", "coffee table", "side table", "center table", "folding table", "glass table", "console table"],
  chairs: ["chair", "plastic chair", "stool", "bar stool", "rocking chair", "dining chair", "folding chair", "bench"],
  "office-furniture": ["office desk", "study desk", "gaming desk", "office chair", "ergonomic chair", "filing cabinet", "reception counter"],
  "outdoor-furniture": ["hammock", "joali", "jolhi", "swing", "garden chair", "sun lounger", "beach chair", "outdoor table", "umbrella stand", "gazebo"],
  bedding: ["bedsheet", "bed sheet", "pillow", "pillows", "blanket", "duvet", "comforter", "quilt", "mosquito net", "mattress protector", "towels"],
  "womens-clothing": ["dress", "abaya", "hijab", "scarf", "kurti", "blouse", "crop top", "skirt", "leggings", "jeans women", "nightwear", "saree", "salwar", "maxi", "jumpsuit", "bridal dress", "wedding dress", "party dress", "ladies"],
  "mens-clothing": ["shirt", "t-shirt", "tshirt", "polo", "trousers", "pants", "shorts", "jeans", "hoodie", "jacket", "suit", "blazer", "sarong", "mundu", "kurta men", "gents"],
  "kids-clothing": ["baby clothes", "kids dress", "boys shirt", "girls dress", "romper", "school clothes"],
  shoes: ["sandals", "slippers", "flip flops", "sneakers", "running shoes", "football boots", "heels", "boots", "loafers", "crocs", "school shoes", "shoe"],
  bags: ["handbag", "purse", "backpack", "school bag", "laptop bag", "travel bag", "suitcase", "luggage", "duffel bag", "wallet", "clutch", "tote bag", "sling bag", "pouch"],
  watches: ["wrist watch", "wristwatch", "analog watch", "digital watch", "casio", "seiko", "citizen", "g shock", "rolex"],
  jewellery: ["gold chain", "necklace", "bracelet", "bangles", "earrings", "ring", "rings", "pendant", "anklet", "nose ring", "silver", "pearl", "jewelry set", "bridal jewellery"],
  "fashion-accessories": ["sunglasses", "glasses frame", "belt", "cap", "hat", "umbrella", "hair clip", "scrunchie", "tie", "brooch", "keychain"],
  sportswear: ["jersey", "gym clothes", "sports bra", "rash guard", "swimsuit", "swimwear", "burkini", "tracksuit", "boardshorts"],
  "skin-care": ["sunscreen", "sunblock", "serum", "moisturiser", "moisturizer", "face cream", "face wash", "toner", "body lotion", "whitening cream", "sheet mask", "aloe vera", "cerave", "the ordinary"],
  "hair-care": ["shampoo", "conditioner", "hair oil", "hair dryer", "straightener", "curling iron", "hair mask", "hair color", "wig", "hair extensions"],
  makeup: ["lipstick", "foundation", "concealer", "mascara", "eyeliner", "eyeshadow", "blush", "makeup kit", "brushes", "nail polish", "false lashes"],
  fragrances: ["perfume", "attar", "oud", "cologne", "body mist", "deodorant", "bakhoor", "incense oud"],
  shavers: ["trimmer", "shaver", "clipper", "razor", "epilator", "beard trimmer", "philips trimmer"],
  "personal-care": ["toothbrush", "electric toothbrush", "toothpaste", "sanitary pads", "soap", "body wash", "nail cutter"],
  medical: ["bp machine", "blood pressure monitor", "glucometer", "thermometer", "oximeter", "nebulizer", "wheelchair", "walker", "crutches", "first aid kit", "face mask", "hearing aid"],
  supplements: ["whey protein", "protein powder", "creatine", "vitamins", "multivitamin", "fish oil", "omega 3", "collagen", "weight gainer"],
  massage: ["massage chair", "massager", "massage gun", "foot massager", "neck massager"],
  strollers: ["pram", "stroller", "baby car seat", "walker baby", "baby carrier", "baby bouncer", "rocker"],
  "baby-feeding": ["feeding bottle", "breast pump", "high chair", "baby food", "formula milk", "sterilizer", "bottle warmer", "sippy cup"],
  nursery: ["baby cot", "crib", "baby bed", "playpen", "baby mattress", "baby monitor"],
  diapering: ["diapers", "nappies", "wipes", "baby bath tub", "changing mat"],
  toys: ["toy", "toys", "doll", "barbie", "lego", "blocks", "teddy bear", "soft toy", "puzzle", "toy car", "rc car", "remote car", "kids bike", "tricycle", "slide", "play tent", "action figure", "hot wheels"],
  maternity: ["maternity dress", "pregnancy pillow", "nursing bra"],
  fitness: ["dumbbell", "dumbbells", "kettlebell", "barbell", "weight plates", "treadmill", "exercise bike", "spin bike", "elliptical", "yoga mat", "resistance band", "pull up bar", "bench press", "home gym", "skipping rope", "boxing gloves", "punching bag"],
  diving: ["scuba", "bcd", "regulator", "dive computer", "wetsuit", "mask and snorkel", "snorkel set", "fins", "dive torch", "spearfishing", "speargun"],
  surfing: ["surfboard", "sup board", "paddle board", "bodyboard", "kitesurf", "kite", "wakeboard", "skimboard", "leash"],
  swimming: ["goggles", "swim cap", "floaties", "pool float", "inflatable pool"],
  "team-sports": ["football", "soccer ball", "basketball", "volleyball", "cricket bat", "goal post", "shin guards", "futsal ball", "netball"],
  "racket-sports": ["badminton racket", "shuttlecock", "tennis racket", "table tennis", "ping pong", "padel racket"],
  skating: ["skateboard", "roller skates", "kick scooter", "hoverboard", "inline skates"],
  outdoors: ["tent", "camping", "sleeping bag", "cooler", "ice box", "binoculars", "telescope", "picnic", "hiking bag"],
  guitars: ["acoustic guitar", "electric guitar", "bass guitar", "ukulele", "violin", "guitar amp"],
  pianos: ["digital piano", "keyboard piano", "casio keyboard", "yamaha keyboard", "midi keyboard"],
  drums: ["drum set", "bodu beru", "cajon", "tabla", "darbuka"],
  recording: ["microphone", "condenser mic", "audio interface", "mixer audio", "dj controller", "studio monitor", "karaoke machine", "sound card"],
  "board-games": ["chess", "carrom board", "uno", "monopoly", "playing cards", "jigsaw", "scrabble", "ludo", "rubiks cube"],
  "rc-models": ["rc plane", "rc boat", "rc helicopter", "model kit", "diecast", "model car"],
  collectibles: ["seashell", "seashells", "shells", "conch shell", "coral", "souvenir", "souvenirs", "antique", "antiques", "vintage", "coins", "old coins", "stamps", "banknotes", "rufiyaa notes", "memorabilia", "trading cards", "pokemon cards", "figurines", "artwork", "handicraft", "handmade", "carving", "wood carving", "lacquer", "thudu kunaa", "mat weaving"],
  gifts: ["gift box", "gift hamper", "gift set", "balloons", "party decoration", "birthday decoration", "wedding gift", "eid gift", "greeting card", "wrapping paper", "personalised gift"],
  books: ["novel", "novels", "book", "books", "quran", "islamic books", "dhivehi book", "story book", "comics", "manga", "magazine", "cookbook", "dictionary", "bible"],
  "school-supplies": ["school books", "textbooks", "workbook", "exercise books", "calculator scientific", "geometry set", "past papers", "igcse", "o level books", "a level books", "grade 1", "grade 10"],
  stationery: ["pens", "pencils", "notebook", "diary", "planner", "highlighter", "markers", "stapler", "file folder", "envelopes", "paper a4", "a4 paper", "sticky notes", "glue stick"],
  "art-supplies": ["paints", "acrylic paint", "watercolor", "canvas", "easel", "sketchbook", "brushes art", "crayons", "colour pencils"],
  "office-equipment": ["printer office", "shredder", "laminator", "binding machine", "projector office", "whiteboard", "notice board", "safe box", "money counter"],
  cats: ["cat", "kitten", "persian cat", "cat for adoption"],
  birds: ["parrot", "lovebirds", "budgies", "cockatiel", "pigeons", "live chicken", "hen", "rooster", "duck", "bird cage"],
  aquariums: ["aquarium", "fish tank", "aquarium fish", "goldfish", "betta", "air pump aquarium"],
  "other-animals": ["rabbit", "hamster", "guinea pig", "turtle", "tortoise", "goat"],
  "pet-supplies": ["cat food", "cat litter", "litter box", "pet bed", "pet carrier", "scratching post", "bird food", "fish food", "collar", "leash pet"],
  "restaurant-equipment": ["commercial blender", "ice maker", "display chiller", "chest freezer", "commercial oven", "pizza oven", "coffee machine commercial", "juice dispenser", "shawarma machine", "griddle", "bain marie", "stainless table", "restaurant chairs"],
  "pos-retail": ["pos machine", "pos system", "barcode scanner", "receipt printer", "cash register", "label printer", "display rack", "mannequin", "shop shelves", "weighing scale"],
  machinery: ["concrete mixer", "excavator", "forklift", "industrial machine", "lathe", "welding plant", "boat lift"],
  "businesses-for-sale": ["shop for sale", "cafe for sale", "business sale", "running business", "franchise", "website for sale"],
  "ac-service": ["ac servicing", "ac repair", "ac installation", "ac gas"],
  electrician: ["electrical work", "wiring work", "electrician service"],
  plumbing: ["plumber", "plumbing work", "pipe repair"],
  carpentry: ["carpenter", "furniture repair", "custom furniture", "woodwork"],
  construction: ["construction work", "renovation", "painting service", "tiling work", "masonry", "interior design", "architect", "building contractor"],
  "appliance-repair": ["repair", "washing machine repair", "fridge repair", "tv repair", "dhonna machine maraamathu", "generator repair"],
  "cleaning-services": ["cleaning service", "house cleaning", "deep cleaning", "sofa cleaning", "laundry service", "pest control service"],
  tuition: ["tuition", "tutor", "private class", "home tuition", "quran classes", "math tuition", "english classes", "driving lessons", "swimming lessons", "music lessons", "online classes"],
  moving: ["movers", "shifting", "delivery service", "cargo service", "pickup service", "courier service", "transport service"],
  "tech-repair": ["phone repair", "screen replacement", "laptop repair", "computer repair", "software installation", "unlocking", "data recovery"],
  "creative-services": ["graphic design", "logo design", "web design", "website", "app development", "photography", "photographer", "videography", "video editing", "printing service", "sticker printing", "signboard"],
  "business-services": ["accounting", "bookkeeping", "tax", "lawyer", "legal", "consultancy", "marketing", "social media", "recruitment", "visa service", "translation"],
  events: ["catering", "wedding planner", "event planning", "decoration service", "party planning", "dj service", "sound system rent", "tent rental", "cake orders", "photo booth"],
  rentals: ["for rent daily", "car rental", "rent a car", "bike rental", "boat hire", "speedboat rent", "excursion", "sandbank trip", "snorkeling trip", "fishing trip", "picnic island", "equipment rental"],
  "beauty-services": ["salon", "spa", "barber", "haircut", "henna", "bridal makeup", "nail art", "massage service", "facial", "waxing"],
  "hospitality-jobs": ["waiter", "waitress", "chef", "cook", "commis", "barista", "bartender", "housekeeping", "room attendant", "front office", "resort job", "hotel job", "spa therapist", "dive instructor"],
  "office-jobs": ["admin", "administrator", "accountant", "receptionist", "secretary", "clerk", "hr officer", "data entry"],
  "sales-jobs": ["sales", "salesman", "cashier", "shop assistant", "sales executive", "marketing executive", "promoter"],
  "driver-jobs": ["driver", "delivery rider", "rider", "captain", "boat crew", "launch driver", "pickup driver"],
  "technical-jobs": ["technician", "electrician job", "mason", "welder", "mechanic", "engineer", "ac technician", "plumber job", "carpenter job", "labour"],
  "it-jobs": ["developer", "programmer", "web developer", "it support", "designer job", "network admin"],
  "teaching-health-jobs": ["teacher", "nurse", "doctor", "caregiver", "nanny", "tutor job", "lecturer"],
};
