import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { persistSession: false } });

const reportId = "652de740-9315-4b82-ad5a-946fadfc5e20";

const { data: row } = await admin
  .from("reports")
  .select("shopping, colors, extras, capsule_images, profile")
  .eq("id", reportId)
  .single();

const shopping = row?.shopping ?? [];
const colors = row?.colors;
const extras = row?.extras;
const capsuleImages = row?.capsule_images ?? [];

console.log("=== palette best ===");
for (const c of colors?.best ?? []) {
  console.log(`  ${c.name} ${c.hex}${c.role ? ` [${c.role}]` : ""}`);
}
console.log("=== palette avoid ===");
for (const c of colors?.avoid ?? []) {
  console.log(`  ${c.name} ${c.hex}`);
}

console.log("\n=== shopping (outerwear / jackets / blazers) ===");
for (const s of shopping) {
  const cat = (s.category || "").toLowerCase();
  const title = (s.title || "").toLowerCase();
  if (
    /jacket|blazer|coat|outer|suit|overshirt|cardigan/.test(cat) ||
    /jacket|blazer|coat|suit/.test(title)
  ) {
    console.log(
      JSON.stringify(
        {
          title: s.title,
          category: s.category,
          color: s.color,
          why: s.why?.slice?.(0, 120),
        },
        null,
        2,
      ),
    );
  }
}

console.log("\n=== all shopping titles/colors ===");
for (const s of shopping) {
  console.log(`  [${s.category}] ${s.title} — color=${s.color}`);
}

// Try to reconstruct capsule matrix if extras has it
const capsule =
  extras?.capsule ??
  extras?.Capsule ??
  extras?.outfitMatrix ??
  null;
console.log("\n=== extras.capsule keys ===", extras ? Object.keys(extras) : null);
if (capsule) {
  console.log("capsule:", JSON.stringify(capsule, null, 2).slice(0, 4000));
}

console.log("\n=== capsule_images paths ===");
capsuleImages.forEach((p, i) => console.log(`  ${i}: ${p}`));
