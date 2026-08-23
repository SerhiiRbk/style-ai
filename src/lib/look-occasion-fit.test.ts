import assert from "node:assert/strict";
import test from "node:test";
import { lookOccasionIdFromContext } from "./look-contexts";
import {
  isOccasionCasualBeltTitle,
  isOccasionCasualShirtTitle,
  isOccasionCasualShoeTitle,
  isOccasionCasualTrouserTitle,
  isOccasionCrossbodyBagTitle,
  isOccasionTravelBagTitle,
  isDressFootwearTitle,
  isRainUtilityFootwearTitle,
  isLeatherUpperFootwear,
  isSuedeFootwearTitle,
  prefersLeatherFootwear,
  isWorkDressShirtTitle,
  lookOccasionAppliesToBag,
  lookOccasionAppliesToBelt,
  lookOccasionAppliesToGarment,
  lookOccasionAppliesToShirt,
  lookOccasionAppliesToShoe,
  lookOccasionIsTailored,
  lookOccasionQueryHint,
  prefersSuedeFootwear,
  prefersLoaferFootwear,
  isLoaferTitle,
  clauseAsksLinen,
  workDefaultShirtColor,
  prefersChinoTrousers,
  prefersWoolTrousers,
  isChinoTitle,
  isNonDressShirtTitle,
  isNonButtonShirtTitle,
  isWorkFashionShirtTitle,
} from "./look-occasion-fit";

test("Work / meetings context resolves to work", () => {
  assert.equal(lookOccasionIdFromContext("Work / meetings"), "work");
  assert.equal(lookOccasionIdFromContext("work"), "work");
  assert.equal(lookOccasionIdFromContext("Weekend"), "weekend");
});

test("work and formal are tailored occasions", () => {
  assert.equal(lookOccasionIsTailored("work"), true);
  assert.equal(lookOccasionIsTailored("formal"), true);
  assert.equal(lookOccasionIsTailored("weekend"), false);
  assert.equal(lookOccasionAppliesToGarment("work", "chinos"), true);
  assert.equal(lookOccasionAppliesToGarment("work", "shirt"), true);
  assert.equal(lookOccasionAppliesToGarment("work", "belt"), true);
  assert.equal(lookOccasionAppliesToGarment("work", "derby"), true);
  assert.equal(lookOccasionAppliesToGarment("work", "messenger bag"), true);
  assert.equal(lookOccasionAppliesToBelt("belt"), true);
  assert.equal(lookOccasionAppliesToShoe("derbies"), true);
  assert.equal(lookOccasionAppliesToShoe("boots"), true);
  assert.equal(lookOccasionAppliesToShoe("chelsea"), true);
  assert.equal(lookOccasionAppliesToGarment("work", "knit"), false);
  assert.equal(lookOccasionAppliesToShirt("shirt"), true);
  assert.equal(lookOccasionAppliesToShirt("oxford"), true);
  assert.equal(lookOccasionAppliesToShirt("chinos"), false);
  assert.equal(lookOccasionAppliesToBag("messenger bag"), true);
  assert.equal(lookOccasionAppliesToBag("chinos"), false);
});

test("linen relaxed trousers are casual unless the look asked for them", () => {
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Cotton/linen Relaxed Fit Trousers",
      "sage cotton chinos",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualTrouserTitle("Cotton Chinos", "sage cotton chinos"),
    false,
  );
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Linen Blend Trousers",
      "mushroom linen-blend trousers",
    ),
    false,
  );
  assert.equal(
    isOccasionCasualTrouserTitle("Relaxed Fit Chinos", "sage cotton chinos"),
    true,
  );
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Denim Chino Bermuda Shorts",
      "muted navy high-waist pleated wool trousers",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Ripped Loose Fit Jeans",
      "muted navy high-waist pleated wool trousers",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualTrouserTitle(
      "Reserved Suit Trousers With Pressed Crease",
      "greige worsted trousers",
      {
        fit: "relaxed",
        materialFamily: "viscose",
        description: "Loose-fit trousers made of fabric with viscose and elastane",
      },
    ),
    true,
  );
});

test("work query hint steers away from linen relaxed", () => {
  assert.match(lookOccasionQueryHint("work") ?? "", /not linen/i);
  assert.match(
    lookOccasionQueryHint("work", "messenger bag") ?? "",
    /not travel bag/i,
  );
  assert.match(
    lookOccasionQueryHint("work", "shirt") ?? "",
    /not relaxed/i,
  );
  assert.equal(lookOccasionQueryHint("weekend"), null);
});

test("work query hint keeps linen and loafers when the look named them", () => {
  const linenShirt = lookOccasionQueryHint(
    "work",
    "shirt",
    "muted teal linen shirt",
  );
  assert.match(linenShirt ?? "", /linen/i);
  assert.doesNotMatch(linenShirt ?? "", /not linen/i);
  assert.equal(clauseAsksLinen("sage linen shirt"), true);
  const loafer = lookOccasionQueryHint(
    "work",
    "loafers",
    "warm grey suede loafers",
  );
  assert.match(loafer ?? "", /loafers/i);
  assert.match(loafer ?? "", /not derby/i);
  assert.equal(prefersLoaferFootwear("oatmeal suede loafers"), true);
  assert.equal(isLoaferTitle("Zara Suede Loafers"), true);
  assert.equal(isLoaferTitle("Valmonti Suede-Look Derby Shoes"), false);
});

test("chinos stay chinos unless the look asked for wool", () => {
  assert.equal(prefersChinoTrousers("chinos", "oatmeal cotton chinos"), true);
  assert.equal(prefersWoolTrousers("oatmeal cotton chinos"), false);
  assert.equal(prefersWoolTrousers("coffee worsted trousers"), true);
  assert.equal(isChinoTitle("Reserved Chino Slim Fit Trousers"), true);
  assert.equal(isChinoTitle("Zara Aaron Levine Wool Suit Trousers"), false);
  assert.equal(
    lookOccasionQueryHint("work", "chinos", "oatmeal cotton chinos"),
    "cotton chinos, not wool, not suit trousers, not relaxed fit, not drawstring",
  );
  assert.equal(isNonDressShirtTitle("Reserved Slim Fit Linen Shirt"), false);
  assert.equal(isNonDressShirtTitle("Zara Printed T-Shirt"), true);
  assert.equal(isNonButtonShirtTitle("Cotton Top", "tee"), true);
  assert.equal(isNonButtonShirtTitle("Printed T-Shirt", "shirt"), false);
  assert.equal(isChinoTitle("Stretch Trousers", "chinos"), true);
  assert.equal(isChinoTitle("Stretch Chinos", "jeans"), false);
});

test("work default shirt is blue on light trousers and white on dark brown", () => {
  assert.equal(workDefaultShirtColor("oatmeal"), "light blue");
  assert.equal(workDefaultShirtColor("cream chinos"), "light blue");
  assert.equal(workDefaultShirtColor("coffee"), "white");
  assert.equal(workDefaultShirtColor("brown"), "white");
  assert.equal(workDefaultShirtColor("camel"), "white");
  assert.equal(workDefaultShirtColor(null, "#e3d7c3"), "light blue");
  assert.equal(workDefaultShirtColor(null, "#453529"), "white");
});

test("relaxed viscose shirts are casual unless the look asked for them", () => {
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Relaxed Fit Poplin Shirt",
      "slate blue poplin shirt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Reserved Comfort Fit Viscose Shirt",
      "soft teal poplin shirt",
      { fit: "relaxed", materialFamily: "viscose" },
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Marks & Spencer Regular Fit Luxury Cotton Twill Shirt",
      "soft teal poplin shirt",
      { fit: "regular", materialFamily: "cotton" },
    ),
    false,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara 100% Linen Jacquard Striped Shirt",
      "sage linen shirt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Fluid Linen - Lyocell Shirt",
      "muted teal linen shirt",
    ),
    true,
  );
  assert.equal(
    isWorkFashionShirtTitle("Zara Fluid Linen - Lyocell Shirt", "linen"),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Linen Shirt",
      "soft teal linen shirt",
    ),
    false,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Poplin Bow Shirt Soshiotsuki X Zara",
      "soft teal poplin shirt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Washed Textured Oxford Shirt",
      "soft teal poplin shirt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Vintage-Effect Slogan Print T-Shirt",
      "camel poplin shirt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Reserved Regular Fit Cotton Shirt",
      "soft teal poplin shirt",
      {
        fit: "regular",
        materialFamily: "cotton",
        description:
          "Regular fit shirt made of cotton rich fabric. low stand up collar button fastening short sleeves patch chest pocket",
      },
    ),
    true,
  );
  assert.equal(
    isOccasionCasualShirtTitle(
      "Zara Poplin Check Shirt",
      "soft teal poplin shirt",
    ),
    true,
  );
});

test("work belts drop stretch and braided cotton", () => {
  assert.equal(
    isOccasionCasualBeltTitle(
      "Marks & Spencer Stretch Woven Active Waist Belt",
      "slate blue woven belt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualBeltTitle(
      "Zara Braided Cotton Belt",
      "slate blue woven belt",
    ),
    true,
  );
  assert.equal(
    isOccasionCasualBeltTitle("Zara Leather Dress Belt", "greige leather belt"),
    false,
  );
  assert.equal(isWorkDressShirtTitle("Reserved Slim Fit Cotton Rich Shirt"), false);
  assert.equal(
    isWorkDressShirtTitle("Marks & Spencer Regular Fit Luxury Cotton Twill Shirt"),
    true,
  );
  assert.equal(
    isWorkDressShirtTitle("Zara Poplin Bow Shirt Soshiotsuki X Zara"),
    false,
  );
});

test("suede derbies are preferred when the look named suede", () => {
  assert.equal(prefersSuedeFootwear("dusty rose suede derbies"), true);
  assert.equal(
    isSuedeFootwearTitle("Gentleman Shoe Vintage Suede Dress Oxford", "leather"),
    true,
  );
  assert.equal(isSuedeFootwearTitle("Leather Oxford Shoes", "suede"), true);
  assert.equal(isSuedeFootwearTitle("Leather Oxford Shoes", "leather"), false);
  assert.equal(isDressFootwearTitle("Office Shoe", "derbies"), true);
  assert.equal(isDressFootwearTitle("Office Shoe", "sneakers"), false);
  assert.equal(isLoaferTitle("Leather Shoe", "loafers"), true);
  assert.equal(isLoaferTitle("Leather Shoe", "derbies"), false);
  assert.equal(
    isOccasionCasualShoeTitle("Reserved Suede Mule Shoes", "dusty rose suede derbies"),
    true,
  );
});

test("rain and rubber boots are utility unless the look asked for them", () => {
  assert.equal(
    isRainUtilityFootwearTitle(
      "Valmonti Men’s Waterproof Ankle Rain Boots Slip-Resistant Urban Footwear",
    ),
    true,
  );
  assert.equal(isRainUtilityFootwearTitle("Zara Leather Chelsea Boots"), false);
  assert.equal(prefersLeatherFootwear("rust leather boots"), true);
  assert.equal(prefersLeatherFootwear("warm grey suede loafers"), false);
  assert.equal(
    isOccasionCasualShoeTitle(
      "Waterproof Ankle Rain Boots",
      "rust leather boots",
    ),
    true,
  );
  assert.equal(
    isDressFootwearTitle("Leather Chelsea Boots", "boots", "leather"),
    true,
  );
  assert.equal(
    isDressFootwearTitle("Waterproof Ankle Rain Boots", "boots", "denim"),
    false,
  );
  assert.equal(
    isLeatherUpperFootwear("Leather Chelsea Boots", "leather"),
    true,
  );
  assert.equal(
    isLeatherUpperFootwear("Dark-Moss Suede Chelsea Boots", "suede"),
    false,
  );
});

test("travel bags are casual unless the look asked for them", () => {
  assert.equal(
    isOccasionTravelBagTitle(
      "Nappa Leather Detail Travel Bag",
      "greige leather messenger bag",
    ),
    true,
  );
  assert.equal(
    isOccasionTravelBagTitle("Leather Messenger Bag", "greige leather messenger bag"),
    false,
  );
  assert.equal(
    isOccasionTravelBagTitle("Canvas Weekender", "olive travel bag"),
    false,
  );
  assert.equal(
    isOccasionCrossbodyBagTitle(
      "Zara Leather Crossbody Bag",
      "oatmeal leather messenger bag",
      "messenger",
    ),
    true,
  );
  assert.equal(
    isOccasionCrossbodyBagTitle(
      "Zara Leather Messenger Bag",
      "oatmeal leather messenger bag",
      "messenger",
    ),
    false,
  );
});
