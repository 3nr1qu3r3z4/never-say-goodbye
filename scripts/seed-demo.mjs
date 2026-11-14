import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

if (process.env.NODE_ENV !== "development") {
  throw new Error("Demo seed data can only be created with NODE_ENV=development.");
}

if (process.env.SEED_DEMO_DATA !== "1") {
  throw new Error("Set SEED_DEMO_DATA=1 to confirm creating demo seed data.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL to the development database before seeding.");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(
  databaseUrl.hostname,
);
if (!isLocalDatabase && process.env.DEMO_SEED_ALLOW_REMOTE !== "1") {
  throw new Error(
    "Remote databases require DEMO_SEED_ALLOW_REMOTE=1 as an additional safeguard.",
  );
}

const sql = neon(process.env.DATABASE_URL);
const now = new Date().toISOString();
const demoPassword = "DemoMomentMaker2026!";

function hashDemoPassword() {
  const salt = randomBytes(16);
  const key = scryptSync(demoPassword, salt, 64);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

// Sample/demo users only. Reserved .test emails and stable IDs prevent collisions
// with real accounts; existing records are never updated. A NULL photo uses the
// application's built-in avatar placeholder.
const samples = [
  {
    key: "john-doe",
    email: "john.doe@demo.neversaygoodbye.test",
    firstName: "John",
    middleName: null,
    lastName: "Doe",
    displayName: "John Doe",
    membership: "tier-3",
    featured: true,
    descriptorOne: "Husband",
    descriptorTwo: "Father",
    descriptorThree: "Veteran",
    bio: "I value the small, everyday moments that bring a family closer. I enjoy sharing stories, celebrating milestones, and keeping our family connected.",
    location: "San Diego, California",
    personalMotto: "Be present for the moments that matter.",
  },
  {
    key: "mary-doe",
    email: "mary.doe@demo.neversaygoodbye.test",
    firstName: "Mary",
    middleName: "Elizabeth",
    lastName: "Doe",
    displayName: "Mary Doe",
    membership: "free",
    featured: false,
    descriptorOne: "Wife",
    descriptorTwo: "Mother",
    descriptorThree: "Teacher",
    bio: "A lifelong teacher, I find joy in family traditions, good books, and helping young people discover what they can become.",
    location: "Nashville, Tennessee",
    personalMotto: "Lead with patience and kindness.",
  },
  {
    key: "emma-doe",
    email: "emma.doe@demo.neversaygoodbye.test",
    firstName: "Emma",
    middleName: "Rose",
    lastName: "Doe",
    displayName: "Emma Doe",
    membership: "free",
    featured: false,
    descriptorOne: "Daughter",
    descriptorTwo: "Artist",
    descriptorThree: "Dreamer",
    bio: "I love making things by hand, taking long walks, and collecting the stories that make our family uniquely ours.",
    location: "Austin, Texas",
    personalMotto: "Make room for wonder.",
  },
  {
    key: "james-doe",
    email: "james.doe@demo.neversaygoodbye.test",
    firstName: "James",
    middleName: "Michael",
    lastName: "Doe",
    displayName: "James Doe",
    membership: "free",
    featured: false,
    descriptorOne: "Son",
    descriptorTwo: "Husband",
    descriptorThree: "Builder",
    bio: "Family, time outdoors, and making useful things are at the center of my life. I am always glad to hear a good story.",
    location: "Portland, Oregon",
    personalMotto: "Show up and lend a hand.",
  },
  {
    key: "robert-doe",
    email: "robert.doe@demo.neversaygoodbye.test",
    firstName: "Robert",
    middleName: "Thomas",
    lastName: "Doe",
    displayName: "Robert Doe",
    membership: "free",
    featured: false,
    descriptorOne: "Brother",
    descriptorTwo: "Grandfather",
    descriptorThree: "Gardener",
    bio: "I have spent a lifetime growing things, learning from family, and finding reasons to gather around the table.",
    location: "Dallas, Texas",
    personalMotto: "Good things grow with care.",
  },
];

const demoUsers = new Map();

for (const sample of samples) {
  const id = `demo-${sample.key}`;
  const rows = await sql`
    INSERT INTO users (
      id, email, password_hash, first_name, middle_name, last_name,
      display_name, display_style, membership, discoverability, featured,
      public_profile_photo, public_profile_bio, public_shared_moments,
      public_connected_lives, public_legacy_tree, public_future_moment_makers,
      public_personal_moments, private_moment_access_requests,
      tree_participation, family_contributions, connected_life_contributions,
      require_moment_approval, profile_photo_data, bio, descriptor_one,
      descriptor_two, descriptor_three, location, personal_motto,
      created_at, updated_at
    ) VALUES (
      ${id}, ${sample.email}, ${hashDemoPassword()}, ${sample.firstName},
      ${sample.middleName}, ${sample.lastName}, ${sample.displayName},
      'full-name', ${sample.membership}, 'searchable', ${sample.featured},
      TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'owner', TRUE, TRUE,
      TRUE, NULL, ${sample.bio}, ${sample.descriptorOne},
      ${sample.descriptorTwo}, ${sample.descriptorThree}, ${sample.location},
      ${sample.personalMotto}, ${now}, ${now}
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  const existing = rows[0]
    ? rows
    : await sql`
        SELECT id FROM users
        WHERE id = ${id} AND LOWER(email) = ${sample.email}
        LIMIT 1
      `;
  if (existing[0]) {
    demoUsers.set(sample.key, existing[0].id);
    console.log(`${rows[0] ? "Created" : "Kept existing"} demo user: ${sample.displayName}`);
  } else {
    console.warn(`Skipped ${sample.displayName}: a stable ID conflict exists.`);
  }
}

for (const sample of samples) {
  const userId = demoUsers.get(sample.key);
  if (!userId) continue;

  const treeId = `demo-tree-${sample.key}`;
  await sql`
    INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
    VALUES (
      ${treeId}, ${userId}, ${`${sample.lastName} Family Legacy Tree™`},
      ${now}, ${now}
    )
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
    SELECT id, ${userId}, 'owner', ${now}
    FROM legacy_trees
    WHERE id = ${treeId} AND owner_user_id = ${userId}
    ON CONFLICT DO NOTHING
  `;
}

const johnId = demoUsers.get("john-doe");
if (johnId) {
  const treeId = "demo-tree-doe-family";
  await sql`
    INSERT INTO legacy_trees (id, owner_user_id, name, created_at, updated_at)
    VALUES (${treeId}, ${johnId}, 'Doe Family Legacy Tree™', ${now}, ${now})
    ON CONFLICT DO NOTHING
  `;

  for (const sample of samples) {
    const userId = demoUsers.get(sample.key);
    if (!userId) continue;
    await sql`
      INSERT INTO legacy_tree_members (tree_id, user_id, role, joined_at)
      SELECT id, ${userId},
             ${sample.key === "john-doe" ? "owner" : "member"}, ${now}
      FROM legacy_trees
      WHERE id = ${treeId} AND owner_user_id = ${johnId}
      ON CONFLICT DO NOTHING
    `;
  }
}

console.log(
  `Demo seed complete. Demo sign-in password for newly created users: ${demoPassword}`,
);
